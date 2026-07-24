// 자동 일정(오토플랜) 알고리즘 코어 — UI 없음, 순수 함수만.
//
// 흐름: 취향 4문(빡빡함·이동수단·혼잡 허용·여정 끝) → 시작점에서 2지선다를 반복 제안.
// 매 라운드 두 후보 모두 "남은 스팟 수 안에 끝점에 도달 가능"(불변식)해서
// 어느 쪽을 골라도 루트가 망가지지 않는다. 선택 이력으로 카테고리 취향을 학습한다.
//
// 한계(정직성): 대중교통·도보는 라우팅 API가 없어 속도·반경 모델로만 반영(추정),
// 운영시간은 원천 포맷이 비정형이라 미반영. 혼잡도 없는 스팟(precompute 부재)은 제외.
//
// 상태는 JSON 직렬화 가능(localStorage 저장 대비). Math.random 금지 — seed 기반 결정적.

import { haversineKm } from "./alternatives";
import { HOUR_MAX } from "./constants";
import type { Congestion, ScheduleSlot, Spot } from "./types";

export type Pace = "relaxed" | "normal" | "packed";
export type Transport = "car" | "transit" | "walk";
export type Crowd = "calm" | "moderate" | "any";
export type EndAnchor =
  | { kind: "return" } // 시작점(숙소) 복귀
  | { kind: "point"; lat: number; lng: number; label: string } // 새 위치·공항 등
  | { kind: "free" }; // 제약 없음

export type PlanPrefs = {
  pace: Pace;
  transport: Transport;
  crowd: Crowd;
  end: EndAnchor;
};

export type LatLng = { lat: number; lng: number };

export type PlanStop = {
  spotId: number;
  hour: number;
  travelKm: number; // 직전 지점에서의 직선거리
  travelMin: number; // 이동수단 속도 모델 추정치
};

export type AutoPlanState = {
  date: string;
  prefs: PlanPrefs;
  seed: number;
  origin: LatLng;
  end: LatLng | null; // return→origin, point→좌표, free→null
  targetStops: number;
  hopHours: number; // 슬롯 간격(체류+이동 추정, 시간 단위)
  hourCursor: number; // 다음 제안 슬롯 시각
  point: LatLng; // 현재 기준점(마지막 선택 스팟)
  /** 시작점→끝점이 이 이동수단·스팟 수로 애초에 가능한가 — false면 UI가 사전 경고 */
  endFeasible: boolean;
  stops: PlanStop[];
  excluded: number[]; // 제안됐으나 선택되지 않은 스팟 (재등장 금지)
  catPicks: Record<string, number>; // 카테고리 취향 학습
  done: boolean;
  doneReason: "target" | "time" | "exhausted" | null;
};

export type Candidate = {
  spot: Spot;
  congestion: Congestion;
  hour: number;
  travelKm: number;
  travelMin: number;
  score: number;
};

export type PairOffer = {
  hour: number;
  a: Candidate;
  b: Candidate | null; // 후보가 1개뿐이면 단독 제안
  relax: number; // 이 제안에 쓰인 완화 단계 (0=기본)
};

// 제주국제공항 — 여정 끝 "공항" 프리셋
export const JEJU_AIRPORT: LatLng = { lat: 33.5066, lng: 126.4929 };

// 체감 속도(km/h): 대중교통은 대기 포함, 도보는 순보행
const SPEED: Record<Transport, number> = { car: 40, transit: 22, walk: 4 };
// 한 구간 최대 반경(km)
const MAX_HOP: Record<Transport, number> = { car: 22, transit: 11, walk: 2.8 };
// 스팟당 체류(시간)
const DWELL: Record<Pace, number> = { relaxed: 2, normal: 1.5, packed: 1 };
const MAX_STOPS: Record<Pace, number> = { relaxed: 4, normal: 6, packed: 8 };
// 혼잡 허용: hard = 절대 상한(완화 시 +1), soft = 선호 상한
const HARD_LEVEL: Record<Crowd, number> = { calm: 2, moderate: 3, any: 4 };
const SOFT_LEVEL: Record<Crowd, number> = { calm: 1, moderate: 2, any: 3 };
// 완화 사다리: 반경 배율 (relax 0/1/2)
const RELAX_RADIUS = [1, 1.5, 2] as const;
export const MAX_RELAX = 2;

const MIN_HOP_KM = 0.3; // 제자리 재제안 방지
const JITTER = 0.06; // 탐험 폭 (결정적 유사난수)

/** mulberry32 — 시드 결정적 유사난수 (Math.random 금지: 재현·테스트·React 순수성) */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 시드+스팟 고정 지터 — 같은 (seed, spot) 쌍은 항상 같은 값 (라운드 내 순위 안정) */
function jitterFor(seed: number, spotId: number): number {
  return mulberry32(seed * 31 + spotId)() * 2 - 1; // -1..1
}

function bearingDeg(from: LatLng, to: LatLng): number {
  const rad = Math.PI / 180;
  const y = Math.sin((to.lng - from.lng) * rad) * Math.cos(to.lat * rad);
  const x =
    Math.cos(from.lat * rad) * Math.sin(to.lat * rad) -
    Math.sin(from.lat * rad) * Math.cos(to.lat * rad) * Math.cos((to.lng - from.lng) * rad);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

function bearingDiff(a: number, b: number): number {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
}

/** 슬롯 간격(시간): 체류 + 평균 이동(반경 절반) 추정, 1~3시간 */
export function estHopHours(prefs: PlanPrefs): number {
  const travelH = MAX_HOP[prefs.transport] / 2 / SPEED[prefs.transport];
  return Math.min(3, Math.max(1, Math.round(DWELL[prefs.pace] + travelH)));
}

/** 목표 스팟 수 — 시간 창(시작~20시)과 빡빡함으로 결정.
 *  하한을 fit(창이 허용하는 실제 슬롯 수)로 둔다 — 이전엔 억지로 2로 올려
 *  "목표 2 표시 → 실제 1"의 불일치를 만들었다(시각이 20시에 붙으면 슬롯이 1개뿐). */
export function planTargets(prefs: PlanPrefs, startHour: number): { stops: number; hopHours: number } {
  const hopHours = estHopHours(prefs);
  const window = HOUR_MAX - startHour;
  const fit = Math.floor(window / hopHours) + 1; // 시작 슬롯 포함
  return { stops: Math.min(MAX_STOPS[prefs.pace], Math.max(1, fit)), hopHours };
}

/** 이 날짜·시작 시각에 남은 시간이 오토플랜에 충분한가 — 부족하면 UI가 내일을 권한다 */
export function scarceWindow(prefs: PlanPrefs, startHour: number): boolean {
  return planTargets(prefs, startHour).stops < Math.min(3, MAX_STOPS[prefs.pace]);
}

export function initAutoPlan(input: {
  date: string;
  startHour: number;
  origin: LatLng;
  prefs: PlanPrefs;
  seed: number;
}): AutoPlanState {
  const { stops, hopHours } = planTargets(input.prefs, input.startHour);
  const end =
    input.prefs.end.kind === "return"
      ? input.origin
      : input.prefs.end.kind === "point"
        ? { lat: input.prefs.end.lat, lng: input.prefs.end.lng }
        : null;
  const endFeasible =
    end === null ||
    haversineKm(input.origin.lat, input.origin.lng, end.lat, end.lng) <=
      (stops + 1) * MAX_HOP[input.prefs.transport] * RELAX_RADIUS[MAX_RELAX];
  return {
    date: input.date,
    prefs: input.prefs,
    seed: input.seed,
    origin: input.origin,
    end,
    targetStops: stops,
    hopHours,
    hourCursor: input.startHour,
    point: input.origin,
    endFeasible,
    stops: [],
    excluded: [],
    catPicks: {},
    done: false,
    doneReason: null,
  };
}

/** 위치 미허용 시 시작점 — 지역(제주시/서귀포시) 안에서 시드 랜덤 스팟 좌표 */
export function randomOrigin(spots: Spot[], seed: number, region?: string): LatLng {
  const pool = region ? spots.filter((s) => s.region === region) : spots;
  const list = pool.length > 0 ? pool : spots;
  const pick = list[Math.floor(mulberry32(seed)() * list.length)];
  return { lat: pick.lat, lng: pick.lng };
}

/** 이 후보 이후 실제로 남는 라운드 수 — 목표 스팟 수와 시간 창 중 먼저 끝나는 쪽 */
export function remainAfterPick(state: AutoPlanState): number {
  const byTarget = state.targetStops - state.stops.length - 1;
  const byTime = Math.floor((HOUR_MAX - state.hourCursor) / state.hopHours);
  return Math.max(0, Math.min(byTarget, byTime));
}

/** 남은 라운드 안에 끝점 도달이 가능한가 — "어느 쪽을 골라도 최적 루트" 불변식.
 *  시간 만료로 조기 종료돼도 꼬리가 풀리지 않게 시간 창 기준을 함께 쓰고,
 *  마지막 구간(스팟→끝점)은 완화 없이 기본 반경까지만 허용한다. */
function reachable(state: AutoPlanState, cand: LatLng, relax: number): boolean {
  if (!state.end) return true;
  const maxHop = MAX_HOP[state.prefs.transport];
  const dEnd = haversineKm(cand.lat, cand.lng, state.end.lat, state.end.lng);
  const budget = remainAfterPick(state) * maxHop * RELAX_RADIUS[relax] + maxHop;
  if (dEnd > budget) return false;
  // 방향성 앵커(공항·새 위치)는 끝점에서 멀어지는 후보를 막는다(회랑) — 고갈로 조기
  // 종료돼도 꼬리가 크게 풀리지 않게. 복귀 앵커는 나갔다 와야 하므로 미적용.
  if (state.prefs.end.kind === "point") {
    const dNow = haversineKm(state.point.lat, state.point.lng, state.end.lat, state.end.lng);
    if (dEnd > dNow + maxHop * 0.6) return false;
  }
  return true;
}

function scoreCandidate(
  state: AutoPlanState,
  spot: Spot,
  c: Congestion,
  travelKm: number,
  relax: number,
): number {
  const maxHop = MAX_HOP[state.prefs.transport] * RELAX_RADIUS[relax];
  const soft = SOFT_LEVEL[state.prefs.crowd];
  // 혼잡: 낮을수록 가점, 허용치 안이라도 soft 초과면 감점 ("상관없음"도 낮은 쪽 약선호)
  const crowdW = state.prefs.crowd === "any" ? 0.4 : 1.0;
  const crowd = crowdW * (1 - (c.level - 1) / 3) * (c.level <= soft ? 1 : 0.6);
  // 거리: 가까울수록 가점 (이전 장소와 가깝게)
  const dist = 0.8 * (1 - travelKm / maxHop);
  // 끝점 지향: 라운드가 진행될수록 끝점으로 전진하는 후보에 가중 (복귀 압력 램프)
  let endward = 0;
  if (state.end) {
    const now = haversineKm(state.point.lat, state.point.lng, state.end.lat, state.end.lng);
    const after = haversineKm(spot.lat, spot.lng, state.end.lat, state.end.lng);
    const progress = Math.max(-1, Math.min(1, (now - after) / MAX_HOP[state.prefs.transport]));
    const ramp = (state.stops.length + 1) / state.targetStops; // 초반 0.x → 막판 1
    endward = 0.9 * ramp * progress;
  }
  // 취향: 골랐던 카테고리 가점 (상한 2회)
  const cat = spot.cat2 ? 0.4 * (Math.min(state.catPicks[spot.cat2] ?? 0, 2) / 2) : 0;
  const imputed = c.is_imputed ? -0.15 : 0;
  const jitter = jitterFor(state.seed, spot.spot_id) * JITTER;
  return crowd + dist + endward + cat + imputed + jitter;
}

function candidatesAt(
  state: AutoPlanState,
  spots: Spot[],
  congestion: ReadonlyMap<number, Congestion>,
  hour: number,
  relax: number,
): Candidate[] {
  const maxHop = MAX_HOP[state.prefs.transport] * RELAX_RADIUS[relax];
  const hard = Math.min(4, HARD_LEVEL[state.prefs.crowd] + (relax >= 2 ? 1 : 0));
  const chosen = new Set(state.stops.map((s) => s.spotId));
  const excluded = new Set(state.excluded);
  const out: Candidate[] = [];
  for (const spot of spots) {
    if (chosen.has(spot.spot_id) || excluded.has(spot.spot_id)) continue;
    const c = congestion.get(spot.spot_id);
    if (!c || c.level > hard) continue;
    const travelKm = haversineKm(state.point.lat, state.point.lng, spot.lat, spot.lng);
    if (travelKm < MIN_HOP_KM || travelKm > maxHop) continue;
    if (!reachable(state, spot, relax)) continue;
    out.push({
      spot,
      congestion: c,
      hour,
      travelKm: Math.round(travelKm * 10) / 10,
      travelMin: Math.round((travelKm / SPEED[state.prefs.transport]) * 60),
      score: scoreCandidate(state, spot, c, travelKm, relax),
    });
  }
  return out.sort((x, y) => y.score - x.score);
}

/** 다음 2지선다 제안. 후보 부족 시 완화 사다리(반경 ×1.5 → 혼잡 +1)를 오르고,
 *  그래도 0개면 null (호출자가 finishPlan으로 종료). 상태는 변경하지 않는다. */
export function buildOffer(
  state: AutoPlanState,
  spots: Spot[],
  congestion: ReadonlyMap<number, Congestion>,
): PairOffer | null {
  if (state.done || state.hourCursor > HOUR_MAX) return null;
  for (let relax = 0; relax <= MAX_RELAX; relax++) {
    const cands = candidatesAt(state, spots, congestion, state.hourCursor, relax);
    if (cands.length === 0) continue;
    const a = cands[0];
    // B안은 A안과 "다른 선택"이어야 한다 — 카테고리가 다르거나 방향이 60° 이상 갈라지는 후보
    const aBearing = bearingDeg(state.point, { lat: a.spot.lat, lng: a.spot.lng });
    const b =
      cands.find(
        (x) =>
          x !== a &&
          (x.spot.cat2 !== a.spot.cat2 ||
            bearingDiff(aBearing, bearingDeg(state.point, { lat: x.spot.lat, lng: x.spot.lng })) > 60),
      ) ??
      cands[1] ??
      null;
    return { hour: state.hourCursor, a, b, relax };
  }
  return null;
}

function afterPick(state: AutoPlanState, picked: Candidate, other: Candidate | null): AutoPlanState {
  const stops = [
    ...state.stops,
    {
      spotId: picked.spot.spot_id,
      hour: picked.hour,
      travelKm: picked.travelKm,
      travelMin: picked.travelMin,
    },
  ];
  const catPicks = { ...state.catPicks };
  if (picked.spot.cat2) catPicks[picked.spot.cat2] = (catPicks[picked.spot.cat2] ?? 0) + 1;
  const nextHour = picked.hour + state.hopHours;
  const reachedTarget = stops.length >= state.targetStops;
  const outOfTime = nextHour > HOUR_MAX;
  return {
    ...state,
    seed: (state.seed * 1103515245 + 12345) % 2147483647, // 라운드마다 지터 갱신 (결정적)
    point: { lat: picked.spot.lat, lng: picked.spot.lng },
    stops,
    excluded: other ? [...state.excluded, other.spot.spot_id] : state.excluded,
    catPicks,
    hourCursor: nextHour,
    done: reachedTarget || outOfTime,
    doneReason: reachedTarget ? "target" : outOfTime ? "time" : null,
  };
}

export function chooseCandidate(
  state: AutoPlanState,
  offer: PairOffer,
  pick: "a" | "b",
): AutoPlanState {
  const picked = pick === "a" ? offer.a : offer.b;
  if (!picked) return state; // b 없는 단독 제안에 b 선택 — 방어
  const other = pick === "a" ? offer.b : offer.a;
  return afterPick(state, picked, other);
}

/** "둘 다 별로" — 두 후보 모두 제외하고 같은 시각을 다시 제안 */
export function skipOffer(state: AutoPlanState, offer: PairOffer): AutoPlanState {
  const excluded = [...state.excluded, offer.a.spot.spot_id];
  if (offer.b) excluded.push(offer.b.spot.spot_id);
  return {
    ...state,
    excluded,
    seed: (state.seed * 1103515245 + 12345) % 2147483647,
  };
}

/** 후보 고갈 등으로 더 제안할 수 없을 때 종료 확정 */
export function finishPlan(state: AutoPlanState): AutoPlanState {
  if (state.done) return state;
  return { ...state, done: true, doneReason: "exhausted" };
}

/** 기존 일정 포맷으로 변환 — ScheduleBuilder localStorage 계약과 호환 */
export function toScheduleSlots(state: AutoPlanState): ScheduleSlot[] {
  return state.stops.map((s) => ({ hour: s.hour, spotId: s.spotId }));
}
