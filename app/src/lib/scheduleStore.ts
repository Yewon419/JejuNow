// 일정 저장소 — 날짜별 일정(v2). 이전 단일 일정(v1: {date, slots, journey?})은 읽을 때 이관.
// 소비자: ScheduleBuilder(읽기/쓰기), MyPlanCard·QuietNearby(현재 날짜 읽기), OnboardingPlanner(날짜 지정).
import { HORIZON_START } from "./constants";
import type { Journey, ScheduleSlot } from "./types";

const STORAGE_KEY = "jejunow:schedule";

export type DayPlan = { slots: ScheduleSlot[]; journey?: Journey };
export type ScheduleStore = { current: string | null; byDate: Record<string, DayPlan> };

function isDayPlan(v: unknown): v is DayPlan {
  return typeof v === "object" && v !== null && Array.isArray((v as DayPlan).slots);
}

export function loadScheduleStore(): ScheduleStore {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { current: null, byDate: {} };
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    let store: ScheduleStore;
    if (parsed.v === 2 && typeof parsed.byDate === "object" && parsed.byDate !== null) {
      const byDate: Record<string, DayPlan> = {};
      for (const [d, plan] of Object.entries(parsed.byDate as Record<string, unknown>)) {
        if (isDayPlan(plan)) byDate[d] = plan;
      }
      store = { current: typeof parsed.current === "string" ? parsed.current : null, byDate };
    } else {
      // v1 이관
      const date = typeof parsed.date === "string" ? parsed.date : null;
      const slots = Array.isArray(parsed.slots) ? (parsed.slots as ScheduleSlot[]) : [];
      const journey = (parsed.journey ?? null) as Journey | null;
      store =
        date !== null
          ? {
              current: date,
              byDate: { [date]: journey ? { slots, journey } : { slots } },
            }
          : { current: null, byDate: {} };
    }
    // 지난 날짜·빈 일정은 정리
    for (const [d, plan] of Object.entries(store.byDate)) {
      if (d < HORIZON_START || plan.slots.length === 0) delete store.byDate[d];
    }
    return store;
  } catch {
    return { current: null, byDate: {} };
  }
}

export function saveScheduleStore(store: ScheduleStore): void {
  try {
    const byDate: Record<string, DayPlan> = {};
    for (const [d, plan] of Object.entries(store.byDate)) {
      if (plan.slots.length > 0) byDate[d] = plan;
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ v: 2, current: store.current, byDate }));
  } catch {
    // 저장 불가 환경 무시
  }
}

/** 현재 선택된 날짜의 일정 — 홈 「내 여행」 카드·근처 추천 기준점용 */
export function currentDayPlan(): {
  date: string;
  slots: ScheduleSlot[];
  journey: Journey | null;
} | null {
  const store = loadScheduleStore();
  if (store.current === null) return null;
  const plan = store.byDate[store.current];
  if (!plan || plan.slots.length === 0) return null;
  return { date: store.current, slots: plan.slots, journey: plan.journey ?? null };
}
