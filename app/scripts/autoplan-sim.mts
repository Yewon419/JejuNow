// 오토플랜 알고리즘 시뮬레이션 — 실데이터(Supabase)로 불변식·품질 검증.
// 실행: $env:SUPABASE_URL/$env:SUPABASE_ANON_KEY 설정 후
//   npx tsx scripts/autoplan-sim.mts [YYYY-MM-DD]
// 조합(빡빡함3×이동3×혼잡3×끝3) × 시드 반복으로 랜덤 선택 플레이스루를 돌리고
// 각 플랜에서 검증: 시각 증가·중복 없음·구간 반경·혼잡 상한·끝점 도달·제외 재등장 금지.

import {
  JEJU_AIRPORT,
  buildOffer,
  chooseCandidate,
  finishPlan,
  initAutoPlan,
  randomOrigin,
  skipOffer,
  type AutoPlanState,
  type Crowd,
  type EndAnchor,
  type Pace,
  type PlanPrefs,
  type Transport,
} from "../src/lib/autoplan";
import { haversineKm } from "../src/lib/alternatives";
import type { Congestion, Spot } from "../src/lib/types";

const BASE = process.env.SUPABASE_URL;
const KEY = process.env.SUPABASE_ANON_KEY;
if (!BASE || !KEY) throw new Error("SUPABASE_URL / SUPABASE_ANON_KEY 환경변수 필요");

async function rest<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}/rest/v1/${path}`, {
    headers: { apikey: KEY as string, Authorization: `Bearer ${KEY}` },
  });
  if (!res.ok) throw new Error(`Supabase ${res.status} ${path}: ${await res.text()}`);
  return res.json() as Promise<T>;
}

const dateArg = process.argv[2];
const date =
  dateArg ?? new Date(Date.now() + 9 * 3600 * 1000 + 86400 * 1000).toISOString().slice(0, 10);

const spots = await rest<Spot[]>(
  "spots?select=spot_id,name,cat1,cat2,lat,lng,route_lat,route_lng,addr,opening_hours,image_url,is_outdoor,region&order=spot_id&limit=2000",
);
const congestionByHour = new Map<number, Map<number, Congestion>>();
for (let h = 9; h <= 20; h++) {
  const rows = await rest<(Congestion & { hour: number })[]>(
    `congestion_pred?select=spot_id,pressure,level,is_imputed&date=eq.${date}&hour=eq.${h}&limit=2000`,
  );
  congestionByHour.set(h, new Map(rows.map((r) => [r.spot_id, r])));
}
console.log(`데이터: spots ${spots.length}, ${date} 혼잡도 시간대 ${congestionByHour.size}개`);

// 검증 상수 — 코어와 동기 (알고리즘이 상수를 바꾸면 여기도 갱신)
const MAX_HOP: Record<Transport, number> = { car: 22, transit: 11, walk: 2.8 };
const HARD: Record<Crowd, number> = { calm: 2, moderate: 3, any: 4 };

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type RunResult = {
  state: AutoPlanState;
  offers: number;
  violations: string[];
};

function playthrough(prefs: PlanPrefs, seed: number, startHour: number): RunResult {
  const rng = mulberry32(seed);
  const origin = randomOrigin(spots, seed);
  let state = initAutoPlan({ date, startHour, origin, prefs, seed });
  const violations: string[] = [];
  const offeredNotChosen = new Set<number>();
  let offers = 0;
  let guard = 0;

  while (!state.done && guard++ < 50) {
    const cmap = congestionByHour.get(state.hourCursor);
    if (!cmap) break;
    const offer = buildOffer(state, spots, cmap);
    if (!offer) {
      state = finishPlan(state);
      break;
    }
    offers++;
    // 불변식: 제안된 후보 모두 검증 (어느 쪽을 골라도 안전해야 함)
    for (const cand of [offer.a, offer.b]) {
      if (!cand) continue;
      if (offeredNotChosen.has(cand.spot.spot_id))
        violations.push(`제외된 스팟 재등장: ${cand.spot.spot_id}`);
      const maxHop = MAX_HOP[prefs.transport] * [1, 1.5, 2][offer.relax];
      if (cand.travelKm > maxHop + 0.05)
        violations.push(`구간 반경 초과: ${cand.travelKm}km > ${maxHop}km (relax ${offer.relax})`);
      const hardCap = Math.min(4, HARD[prefs.crowd] + (offer.relax >= 2 ? 1 : 0));
      if (cand.congestion.level > hardCap)
        violations.push(`혼잡 상한 초과: lv${cand.congestion.level} > ${hardCap}`);
      if (state.end) {
        const byTarget = state.targetStops - state.stops.length - 1;
        const byTime = Math.floor((20 - state.hourCursor) / state.hopHours);
        const remainAfter = Math.max(0, Math.min(byTarget, byTime));
        const budget =
          remainAfter * MAX_HOP[prefs.transport] * [1, 1.5, 2][offer.relax] +
          MAX_HOP[prefs.transport];
        const dEnd = haversineKm(cand.spot.lat, cand.spot.lng, state.end.lat, state.end.lng);
        if (dEnd > budget + 0.05)
          violations.push(`끝점 도달 불변식 위반: ${dEnd.toFixed(1)}km > ${budget.toFixed(1)}km`);
      }
    }
    // 랜덤 플레이: 10% 스킵, 나머지 반반 선택
    const r = rng();
    if (r < 0.1) {
      offeredNotChosen.add(offer.a.spot.spot_id);
      if (offer.b) offeredNotChosen.add(offer.b.spot.spot_id);
      state = skipOffer(state, offer);
      continue;
    }
    const pick = offer.b && r < 0.55 ? "b" : "a";
    const other = pick === "a" ? offer.b : offer.a;
    if (other) offeredNotChosen.add(other.spot.spot_id);
    state = chooseCandidate(state, offer, pick);
  }

  // 플랜 전체 검증
  const seen = new Set<number>();
  let prevHour = -1;
  for (const s of state.stops) {
    if (seen.has(s.spotId)) violations.push(`중복 스팟: ${s.spotId}`);
    seen.add(s.spotId);
    if (s.hour <= prevHour) violations.push(`시각 비증가: ${prevHour} → ${s.hour}`);
    if (s.hour < startHour || s.hour > 20) violations.push(`시각 범위 밖: ${s.hour}`);
    prevHour = s.hour;
  }
  if (state.stops.length > state.targetStops)
    violations.push(`목표 초과: ${state.stops.length} > ${state.targetStops}`);
  return { state, offers, violations };
}

const PACES: Pace[] = ["relaxed", "normal", "packed"];
const TRANSPORTS: Transport[] = ["car", "transit", "walk"];
const CROWDS: Crowd[] = ["calm", "moderate", "any"];
const ENDS: EndAnchor[] = [
  { kind: "return" },
  { kind: "point", ...JEJU_AIRPORT, label: "제주국제공항" },
  { kind: "free" },
];
const SEEDS = [11, 42, 77, 2026];
const START_HOURS = [9, 14];

let runs = 0;
let totalViolations = 0;
let exhausted = 0;
const stopCounts: number[] = [];
const hopKms: number[] = [];
const finalLegKms: number[] = [];
const failSamples: string[] = [];
const exhaustedBy: Record<string, number> = {};
const zeroBy: Record<string, number> = {};
let maxFinalLeg = 0;
let maxFinalLegInfo = "";
let infeasibleInit = 0;
const finalLegByReason: Record<string, number[]> = {};

for (const pace of PACES)
  for (const transport of TRANSPORTS)
    for (const crowd of CROWDS)
      for (const end of ENDS)
        for (const seed of SEEDS)
          for (const startHour of START_HOURS) {
            const prefs: PlanPrefs = { pace, transport, crowd, end };
            const { state, violations } = playthrough(prefs, seed, startHour);
            runs++;
            if (!state.endFeasible) {
              infeasibleInit++;
              continue; // UI가 사전 경고로 걸러낼 조합 — 품질 통계에서 제외
            }
            stopCounts.push(state.stops.length);
            for (const s of state.stops) hopKms.push(s.travelKm);
            if (state.doneReason === "exhausted") {
              exhausted++;
              exhaustedBy[transport] = (exhaustedBy[transport] ?? 0) + 1;
            }
            if (state.stops.length === 0) zeroBy[transport] = (zeroBy[transport] ?? 0) + 1;
            if (state.end && state.stops.length > 0) {
              const last = state.stops[state.stops.length - 1];
              const spot = spots.find((x) => x.spot_id === last.spotId);
              if (spot) {
                const leg = haversineKm(spot.lat, spot.lng, state.end.lat, state.end.lng);
                finalLegKms.push(leg);
                const reason = state.doneReason ?? "?";
                (finalLegByReason[reason] ??= []).push(leg);
                if (leg > maxFinalLeg) {
                  maxFinalLeg = leg;
                  maxFinalLegInfo = `${pace}/${transport}/${crowd}/${end.kind}/종료=${state.doneReason}`;
                }
              }
            }
            if (violations.length > 0) {
              totalViolations += violations.length;
              if (failSamples.length < 8)
                failSamples.push(
                  `${pace}/${transport}/${crowd}/${end.kind}/seed${seed}/h${startHour}: ${violations[0]}`,
                );
            }
          }

const avg = (a: number[]): string =>
  a.length > 0 ? (a.reduce((x, y) => x + y, 0) / a.length).toFixed(2) : "-";
console.log(`\n플레이스루 ${runs}회`);
console.log(`불변식 위반: ${totalViolations}건`);
failSamples.forEach((f) => console.log("  ✗ " + f));
console.log(`스팟 수 평균 ${avg(stopCounts)} (min ${Math.min(...stopCounts)}, max ${Math.max(...stopCounts)})`);
console.log(`구간 거리 평균 ${avg(hopKms)}km`);
console.log(`끝점 앵커 플랜의 최종구간(마지막 스팟→끝점) 평균 ${avg(finalLegKms)}km, max ${finalLegKms.length > 0 ? Math.max(...finalLegKms).toFixed(1) : "-"}km`);
console.log(`  최종구간 최댓값 조합: ${maxFinalLegInfo}`);
for (const [reason, legs] of Object.entries(finalLegByReason))
  console.log(
    `  종료사유 ${reason}: 평균 ${avg(legs)}km, max ${Math.max(...legs).toFixed(1)}km (${legs.length}건)`,
  );
console.log(`여정 자체 불가(endFeasible=false, UI 사전 경고 대상): ${infeasibleInit}/${runs}`);
console.log(`후보 고갈 조기종료: ${exhausted}/${runs} (${((exhausted / runs) * 100).toFixed(1)}%) — 이동수단별 ${JSON.stringify(exhaustedBy)}`);
console.log(`스팟 0개 플랜: ${stopCounts.filter((n) => n === 0).length} — 이동수단별 ${JSON.stringify(zeroBy)}`);
