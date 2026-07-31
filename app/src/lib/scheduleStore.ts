// 일정 저장소 — 이름 붙인 하루 코스(시안)를 여러 개 보관하는 v3.
// v2(날짜별 단일 일정 {current, byDate})·v1(단일 {date, slots})은 읽을 때 이관.
// 소비자: ScheduleBuilder(읽기/쓰기), MyPlanCard·QuietNearby(현재 시안 읽기), OnboardingPlanner(시안 생성).
import {
  HORIZON_END,
  HORIZON_START,
  HOUR_MAX,
  HOUR_MIN,
  formatKstDate,
  todayInHorizon,
} from "./constants";
import type { Journey, Plan, ScheduleSlot } from "./types";

const STORAGE_KEY = "jejunow:schedule";

export type ScheduleStore = { plans: Plan[]; currentId: string | null };

function newId(): string {
  try {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
      return `p_${crypto.randomUUID()}`;
    }
  } catch {
    // 구형 웹뷰 — 폴백
  }
  return `p_${Date.now().toString(36)}_${Math.floor(Math.random() * 1e6).toString(36)}`;
}

function clampDate(date: string): string {
  if (date < HORIZON_START) return HORIZON_START;
  if (date > HORIZON_END) return HORIZON_END;
  return date;
}

/** 새 시안 하나 생성 (저장은 호출부 책임) */
export function makePlan(name: string, date?: string): Plan {
  return { id: newId(), name, date: clampDate(date ?? todayInHorizon()), slots: [], journey: null };
}

function isSlot(v: unknown): v is ScheduleSlot {
  return (
    typeof v === "object" &&
    v !== null &&
    typeof (v as ScheduleSlot).hour === "number" &&
    typeof (v as ScheduleSlot).spotId === "number"
  );
}

function isPlan(v: unknown): v is Plan {
  if (typeof v !== "object" || v === null) return false;
  const p = v as Plan;
  return (
    typeof p.id === "string" &&
    typeof p.name === "string" &&
    typeof p.date === "string" &&
    Array.isArray(p.slots) &&
    p.slots.every(isSlot)
  );
}

// v2 byDate 항목(슬롯 있고 호라이즌 내)만 시안으로 이관 — 이전에 화면에 보이던 데이터와 동일
function migrateV2(parsed: Record<string, unknown>): ScheduleStore {
  const byDate = parsed.byDate as Record<string, unknown>;
  const plans: Plan[] = [];
  let currentId: string | null = null;
  for (const [date, raw] of Object.entries(byDate)) {
    if (date < HORIZON_START || date > HORIZON_END) continue;
    if (typeof raw !== "object" || raw === null) continue;
    const slots = Array.isArray((raw as { slots: unknown }).slots)
      ? ((raw as { slots: ScheduleSlot[] }).slots.filter(isSlot))
      : [];
    if (slots.length === 0) continue;
    const journey = ((raw as { journey?: Journey }).journey ?? null) as Journey | null;
    const plan: Plan = { id: newId(), name: `${formatKstDate(date)} 코스`, date, slots, journey };
    plans.push(plan);
    if (parsed.current === date) currentId = plan.id;
  }
  if (plans.length > 0 && currentId === null) currentId = plans[0].id;
  return { plans, currentId };
}

function migrateV1(parsed: Record<string, unknown>): ScheduleStore {
  const date = typeof parsed.date === "string" ? clampDate(parsed.date) : null;
  const slots = Array.isArray(parsed.slots) ? (parsed.slots as unknown[]).filter(isSlot) : [];
  if (date === null || slots.length === 0) return { plans: [], currentId: null };
  const journey = (parsed.journey ?? null) as Journey | null;
  const plan: Plan = { id: newId(), name: `${formatKstDate(date)} 코스`, date, slots, journey };
  return { plans: [plan], currentId: plan.id };
}

export function loadScheduleStore(): ScheduleStore {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { plans: [], currentId: null };
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    if (parsed.v === 3 && Array.isArray(parsed.plans)) {
      const plans = (parsed.plans as unknown[])
        .filter(isPlan)
        // 지난 날짜 시안은 정리 (v2와 동일 규칙) — 안 하면 과거 여행이 영구 누적된다
        .filter((p) => p.date >= HORIZON_START)
        .map((p) => ({
          ...p,
          journey: p.journey ?? null,
        }));
      const currentId =
        typeof parsed.currentId === "string" && plans.some((p) => p.id === parsed.currentId)
          ? parsed.currentId
          : (plans[0]?.id ?? null);
      return { plans, currentId };
    }
    if (parsed.v === 2 && typeof parsed.byDate === "object" && parsed.byDate !== null) {
      return migrateV2(parsed);
    }
    return migrateV1(parsed);
  } catch {
    return { plans: [], currentId: null };
  }
}

export function saveScheduleStore(store: ScheduleStore): void {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ v: 3, plans: store.plans, currentId: store.currentId }),
    );
  } catch {
    // 저장 불가 환경 무시
  }
}

/** 다음 빈 시간대 — 오전 10시부터 2시간 간격 우선, 다 차면 순차 탐색 */
export function nextFreeHour(slots: ScheduleSlot[]): number {
  const used = new Set(slots.map((s) => s.hour));
  for (let h = 10; h <= HOUR_MAX; h += 2) {
    if (!used.has(h)) return h;
  }
  for (let h = HOUR_MIN; h <= HOUR_MAX; h += 1) {
    if (!used.has(h)) return h;
  }
  return HOUR_MIN;
}

/** 현재 선택된 시안 — 홈 「내 여행」 카드·근처 추천 기준점용. 비어 있으면 null. */
export function currentPlan(): { date: string; slots: ScheduleSlot[]; journey: Journey | null } | null {
  const store = loadScheduleStore();
  if (store.currentId === null) return null;
  const plan = store.plans.find((p) => p.id === store.currentId);
  if (!plan || plan.slots.length === 0) return null;
  return { date: plan.date, slots: plan.slots, journey: plan.journey };
}
