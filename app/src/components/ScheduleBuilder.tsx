"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { type Alternative, findAlternatives, haversineKm } from "@/lib/alternatives";
import { SCHEDULE_COACH } from "@/lib/coach";
import { tapLight, tapMedium } from "@/lib/haptics";
import {
  type RouteData,
  fetchAlternativesLive,
  fetchRoute,
  formatDuration,
  sameLocation,
  simulateSchedule,
} from "@/lib/api";
import { AutoPlanFlow } from "./AutoPlanFlow";
import { CoachMark } from "./CoachMark";
import { RouteView } from "./RouteView";
import { SharePlanSheet } from "./SharePlanSheet";
import {
  HORIZON_END,
  HORIZON_START,
  HOUR_MAX,
  HOUR_MIN,
  catLabel,
  spotDisplayName,
  todayInHorizon,
} from "@/lib/constants";
import { fetchCongestionClient } from "@/lib/supabaseClient";
import {
  type ScheduleStore,
  loadScheduleStore,
  makePlan,
  nextFreeHour,
  saveScheduleStore,
} from "@/lib/scheduleStore";
import type { Congestion, Plan, ScheduleSlot, Spot } from "@/lib/types";
import { LevelBadge, LevelDot, PressureBar } from "./LevelBadge";

type SpotPicker = { open: boolean; forHour: number | null };

const EMPTY_SLOTS: ScheduleSlot[] = [];

export function ScheduleBuilder({ spots }: { spots: Spot[] }) {
  // 다중 시안 저장소가 단일 소스 — 슬롯·날짜·여정은 현재 시안에서 파생한다.
  const [store, setStore] = useState<ScheduleStore>({ plans: [], currentId: null });
  const [congestionByHour, setCongestionByHour] = useState<Map<number, Map<number, Congestion>>>(
    new Map(),
  );
  const [picker, setPicker] = useState<SpotPicker>({ open: false, forHour: null });
  const [query, setQuery] = useState("");
  const [loaded, setLoaded] = useState(false);
  // 라이브 추론(/simulate) 결과 — null이면 precompute(congestionByHour)로 폴백
  const [liveByHour, setLiveByHour] = useState<Map<number, Map<number, Congestion>> | null>(null);
  const [liveAlts, setLiveAlts] = useState<Map<string, Alternative[]>>(new Map());
  // 인앱 경로 보기 (카카오내비 API → 우리 지도)
  const [routeView, setRouteView] = useState<{ from: Spot; to: Spot } | null>(null);
  // 자동 일정 짜기(오토플랜) 플로우
  const [autoOpen, setAutoOpen] = useState(false);
  // 링크·QR 공유 시트
  const [shareOpen, setShareOpen] = useState(false);
  // 현재 시안 삭제 인라인 확인
  const [confirmDelete, setConfirmDelete] = useState(false);
  // 연속 슬롯 간 거리·시간 — 경로 칩에 미리 표시 (fetchRoute 캐시로 RouteView와 공유)
  const [routeMeta, setRouteMeta] = useState<Map<string, RouteData>>(new Map());

  const spotById = useMemo(() => new Map(spots.map((s) => [s.spot_id, s])), [spots]);

  // 현재 시안에서 파생 (current가 안정적이면 slots 참조도 안정적 — 이펙트 의존성 안전)
  const current = store.plans.find((p) => p.id === store.currentId) ?? null;
  const date = current?.date ?? todayInHorizon();
  const slots = current?.slots ?? EMPTY_SLOTS;
  const journey = current?.journey ?? null;
  // 날짜 안에 시안 — 상위는 날짜, 그 아래 이 날짜에 속한 시안들
  const dailyPlans = store.plans.filter((p) => p.date === date);

  // localStorage 복원 (외부 시스템 동기화 — 마이크로태스크로 지연해 cascading render 회피).
  // 시안이 하나도 없으면 기본 시안을 만들어 항상 편집 대상이 있게 한다.
  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      const s = loadScheduleStore();
      if (s.plans.length === 0) {
        const p = makePlan("시안 1");
        setStore({ plans: [p], currentId: p.id });
      } else {
        setStore({ ...s, currentId: s.currentId ?? s.plans[0].id });
      }
      setLoaded(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // 저장소 변경 시 영속화 — 날짜를 훑다 만들어진 빈 시안은 현재 것만 남기고 정리
  useEffect(() => {
    if (!loaded) return;
    const pruned = store.plans.filter((p) => p.slots.length > 0 || p.id === store.currentId);
    saveScheduleStore({ plans: pruned, currentId: store.currentId });
  }, [store, loaded]);

  function updateCurrent(mutator: (p: Plan) => Plan) {
    setStore((s) => {
      if (s.currentId === null) return s;
      return { ...s, plans: s.plans.map((p) => (p.id === s.currentId ? mutator(p) : p)) };
    });
  }

  // 현재 날짜 안에 새 시안 — 이름은 그 날짜 안에서 번호 매김
  function createPlan() {
    tapLight();
    setConfirmDelete(false);
    setStore((s) => {
      const d = s.plans.find((p) => p.id === s.currentId)?.date ?? todayInHorizon();
      const nums = s.plans
        .filter((p) => p.date === d)
        .map((p) => {
          const m = p.name.match(/^시안 (\d+)$/);
          return m ? Number(m[1]) : 0;
        });
      const p = makePlan(`시안 ${Math.max(0, ...nums) + 1}`, d);
      return { plans: [...s.plans, p], currentId: p.id };
    });
  }

  // 시안 전환 — 빈 시안은 전환 대상만 남기고 정리한다. 저장 시에도 같은 규칙으로
  // 정리되므로, 여기서 state를 맞춰야 새로고침 후 칩 목록이 달라지지 않는다.
  function switchPlan(id: string) {
    tapLight();
    setConfirmDelete(false);
    setStore((s) => ({
      plans: s.plans.filter((p) => p.slots.length > 0 || p.id === id),
      currentId: id,
    }));
  }

  // 현재 시안 삭제 — 같은 날짜에 시안이 남으면 그리로, 없으면 그 날짜에 빈 시안 하나 생성
  function deleteCurrent() {
    tapLight();
    setConfirmDelete(false);
    setStore((s) => {
      const d = s.plans.find((p) => p.id === s.currentId)?.date ?? todayInHorizon();
      const rest = s.plans.filter((p) => p.id !== s.currentId);
      const restForDate = rest.filter((p) => p.date === d);
      if (restForDate.length > 0) {
        return { plans: rest, currentId: restForDate[0].id };
      }
      const p = makePlan("시안 1", d);
      return { plans: [...rest, p], currentId: p.id };
    });
  }

  // 날짜 전환. 빈 현재 시안은 새로 만들지 않고 날짜만 옮긴다 — 날짜 입력을 타이핑하면
  // 중간값마다 onChange가 터지는데, 그때 매번 새 시안을 만들면 빈 시안이 폭증한다.
  function changeDate(next: string) {
    tapLight();
    setConfirmDelete(false);
    setStore((s) => {
      const cur = s.plans.find((p) => p.id === s.currentId);
      if (cur && cur.date === next) return s;
      const forDate = s.plans.filter((p) => p.date === next && p.id !== s.currentId);
      if (forDate.length > 0) {
        // 그 날짜에 이미 시안이 있음 → 그리로. 현재가 빈 시안이면 버린다.
        const plans = cur && cur.slots.length === 0 ? s.plans.filter((p) => p.id !== cur.id) : s.plans;
        return { plans, currentId: forDate[0].id };
      }
      if (cur && cur.slots.length === 0) {
        // 현재가 빈 시안 → 날짜만 옮긴다 (새로 만들지 않음)
        return { ...s, plans: s.plans.map((p) => (p.id === cur.id ? { ...p, date: next } : p)) };
      }
      // 현재가 내용 있는 시안 → 그 시안은 원래 날짜에 두고, 새 날짜엔 빈 시안 생성
      const p = makePlan("시안 1", next);
      return { plans: [...s.plans, p], currentId: p.id };
    });
  }

  // 사용 중인 시간대 혼잡도 로드
  useEffect(() => {
    const hours = [...new Set(slots.map((s) => s.hour))];
    let cancelled = false;
    Promise.all(
      hours.map(async (h) => [h, new Map((await fetchCongestionClient(date, h)).map((c) => [c.spot_id, c]))] as const),
    )
      .then((entries) => {
        if (!cancelled) setCongestionByHour(new Map(entries));
      })
      .catch(() => {
        if (!cancelled) setCongestionByHour(new Map());
      });
    return () => {
      cancelled = true;
    };
  }, [date, slots]);

  // 라이브 추론 — 성공 시 precompute 값 대신 사용, 슬립·미배포 시 조용히 폴백
  useEffect(() => {
    let cancelled = false;
    simulateSchedule(date, slots).then(async (live) => {
      if (cancelled) return;
      setLiveByHour(live);
      const alts = new Map<string, Alternative[]>();
      if (live) {
        const crowded = slots.filter((s) => (live.get(s.hour)?.get(s.spotId)?.level ?? 1) >= 3);
        await Promise.all(
          crowded.map(async (s) => {
            const found = await fetchAlternativesLive(s.spotId, date, s.hour, spotById);
            if (found) alts.set(`${s.hour}:${s.spotId}`, found);
          }),
        );
      }
      if (cancelled) return;
      setLiveAlts(alts);
    });
    return () => {
      cancelled = true;
    };
  }, [date, slots, spotById]);

  // 연속 슬롯 쌍의 경로 메타 로드 (슬롯 변경 시)
  useEffect(() => {
    let cancelled = false;
    const pairs: [Spot, Spot][] = [];
    for (let i = 1; i < slots.length; i += 1) {
      const a = spotById.get(slots[i - 1].spotId);
      const b = spotById.get(slots[i].spotId);
      // 같은 지점(같은 스팟·같은 주차장)은 경로가 0km라 조회·표시 생략
      if (a && b && !sameLocation(a, b)) pairs.push([a, b]);
    }
    if (pairs.length === 0) return;
    Promise.all(
      pairs.map(async ([a, b]) => {
        const r = await fetchRoute(a, b);
        return [`${a.spot_id}:${b.spot_id}`, r] as const;
      }),
    ).then((entries) => {
      if (cancelled) return;
      const m = new Map<string, RouteData>();
      for (const [k, r] of entries) {
        if (r.ok) m.set(k, r.data);
      }
      setRouteMeta(m);
    });
    return () => {
      cancelled = true;
    };
  }, [slots, spotById]);

  // 추가 위치 바로 위 슬롯의 스팟 — 선택 시트를 이 스팟과 가까운 순으로 정렬(동선 이어붙이기)
  const pickerRefSpot = useMemo(() => {
    if (!picker.open) return undefined;
    const targetHour = picker.forHour ?? nextFreeHour(slots);
    const prev = slots
      .filter((s) => s.hour < targetHour)
      .sort((a, b) => b.hour - a.hour)[0];
    return prev ? spotById.get(prev.spotId) : undefined;
  }, [picker, slots, spotById]);

  const filteredSpots = useMemo(() => {
    const q = query.trim();
    const scheduled = new Set(slots.map((s) => s.spotId));
    const pool = (q ? spots.filter((s) => s.name.includes(q)) : spots.filter((s) => s.image_url))
      // 이미 일정에 담긴 곳은 제외 — 근처 순 정렬에서 자기 자신이 0.0km 1위로 뜨는 것 방지
      .filter((s) => !scheduled.has(s.spot_id));
    const ref = pickerRefSpot;
    if (!ref) return pool.slice(0, 12);
    return [...pool]
      .sort(
        (a, b) =>
          haversineKm(ref.lat, ref.lng, a.lat, a.lng) - haversineKm(ref.lat, ref.lng, b.lat, b.lng),
      )
      .slice(0, 12);
  }, [spots, query, slots, pickerRefSpot]);

  function addSlot(spotId: number) {
    tapMedium();
    const hour = picker.forHour ?? nextFreeHour(slots);
    updateCurrent((p) => ({
      ...p,
      slots: [...p.slots.filter((s) => s.hour !== hour), { hour, spotId }].sort(
        (a, b) => a.hour - b.hour,
      ),
    }));
    setPicker({ open: false, forHour: null });
    setQuery("");
  }

  function removeSlot(hour: number) {
    tapLight();
    updateCurrent((p) => {
      const next = p.slots.filter((s) => s.hour !== hour);
      // 스팟이 없으면 출발·도착 표시도 무의미
      return { ...p, slots: next, journey: next.length === 0 ? null : p.journey };
    });
  }

  function changeHour(from: number, to: number) {
    updateCurrent((p) => ({
      ...p,
      slots: p.slots.map((s) => (s.hour === from ? { ...s, hour: to } : s)).sort((a, b) => a.hour - b.hour),
    }));
  }

  return (
    <main className="mx-auto w-full max-w-full space-y-6 px-5 pt-[calc(0.75rem+env(safe-area-inset-top,0px))] md:max-w-2xl">
      <CoachMark id="schedule" steps={SCHEDULE_COACH} />
      <header className="space-y-3">
        {/* 제목 + 컴팩트 날짜 pill (탭하면 네이티브 날짜 선택) */}
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-2xl font-bold text-ink">내 여행</h1>
          <label className="relative inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded-full bg-card px-3.5 py-2 text-sm font-semibold text-ink shadow-card">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-4 w-4 text-primary" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" />
            </svg>
            <span className="tabular-nums">{shortDate(date)}</span>
            <input
              type="date"
              aria-label="여행 날짜"
              value={date}
              min={HORIZON_START}
              max={HORIZON_END}
              onChange={(e) => changeDate(e.target.value)}
              className="absolute inset-0 cursor-pointer opacity-0"
            />
          </label>
        </div>

        {/* 이 날짜의 시안 — 전환/추가. 활성 칩은 탭해서 이름 편집 (중복 입력 제거) */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          {dailyPlans.map((p) =>
            p.id === store.currentId ? (
              <input
                key={p.id}
                type="text"
                aria-label="시안 이름"
                value={current?.name ?? ""}
                onChange={(e) => updateCurrent((pp) => ({ ...pp, name: e.target.value }))}
                placeholder="시안 이름"
                className="shrink-0 rounded-full bg-ink px-3.5 py-1.5 text-base font-semibold text-white outline-none [field-sizing:content] min-w-[4rem] max-w-[13rem] placeholder:text-white/60"
              />
            ) : (
              <button
                key={p.id}
                type="button"
                onClick={() => switchPlan(p.id)}
                className="shrink-0 cursor-pointer rounded-full bg-card px-3.5 py-1.5 text-sm font-semibold text-dim shadow-card transition-colors hover:text-ink"
              >
                {p.name}
              </button>
            ),
          )}
          <button
            type="button"
            onClick={createPlan}
            className="shrink-0 cursor-pointer rounded-full border border-dashed border-line px-3 py-1.5 text-sm font-semibold text-dim transition-colors hover:border-primary hover:text-primary"
          >
            + 새 시안
          </button>
        </div>

        {/* 액션 한 줄 — 자동(주), 공유·삭제는 아이콘 */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              tapLight();
              setAutoOpen(true);
            }}
            className="flex-1 cursor-pointer rounded-lg bg-cta px-3.5 py-2.5 text-sm font-bold text-on-cta transition-transform active:scale-[0.98]"
          >
            자동으로 짜기
          </button>
          <button
            type="button"
            onClick={() => {
              tapLight();
              setShareOpen(true);
            }}
            disabled={slots.length === 0}
            aria-label="이 시안 공유"
            className="flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-lg border border-line bg-card text-ink shadow-card transition-transform active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-40"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-5 w-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M7.217 10.907a2.25 2.25 0 1 0 0 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186 9.566-5.314m-9.566 7.5 9.566 5.314m0 0a2.25 2.25 0 1 0 3.935 2.186 2.25 2.25 0 0 0-3.935-2.186Zm0-12.814a2.25 2.25 0 1 0 3.933-2.185 2.25 2.25 0 0 0-3.933 2.185Z" />
            </svg>
          </button>
          {confirmDelete ? (
            <span className="flex shrink-0 items-center gap-1.5">
              <button
                type="button"
                onClick={deleteCurrent}
                className="cursor-pointer rounded-lg bg-lv4/10 px-3 py-2.5 text-sm font-bold text-lv4"
              >
                삭제
              </button>
              <button
                type="button"
                onClick={() => setConfirmDelete(false)}
                className="cursor-pointer rounded-lg px-2 py-2.5 text-sm font-medium text-dim hover:text-ink"
              >
                취소
              </button>
            </span>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmDelete(true)}
              aria-label="이 시안 삭제"
              className="flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-lg border border-line bg-card text-dim shadow-card transition-transform active:scale-[0.97] hover:text-lv4"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-5 w-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
              </svg>
            </button>
          )}
        </div>
      </header>

      {autoOpen ? (
        <AutoPlanFlow
          spots={spots}
          date={date}
          existingCount={slots.length}
          onApply={(planDate, next, j) => {
            // 오토플랜이 내일로 짰을 수 있다 — 현재 시안의 날짜·슬롯·여정을 통째로 반영
            updateCurrent((p) => ({ ...p, date: planDate, slots: next, journey: j }));
          }}
          onClose={() => setAutoOpen(false)}
        />
      ) : null}

      {shareOpen && current ? (
        <SharePlanSheet
          plan={{ name: current.name, date: current.date, slots: current.slots, journey: current.journey }}
          onClose={() => setShareOpen(false)}
        />
      ) : null}

      <ol aria-label="일정 슬롯" className="relative space-y-3 pl-8">
        {slots.length > 1 || (journey && slots.length > 0) ? (
          <span aria-hidden className="absolute bottom-5 left-[0.4375rem] top-5 w-0.5 bg-line" />
        ) : null}
        {/* 오토플랜 여정의 출발 지점 — 타임라인 맨 위 */}
        {journey && slots.length > 0 ? (
          <li className="relative">
            <span className="absolute -left-8 top-0.5">
              <span className="block h-3.5 w-3.5 rounded-full border-2 border-white bg-ink shadow-sm" />
            </span>
            <p className="pt-0.5 text-xs font-semibold text-dim">출발 · {journey.origin.label}</p>
          </li>
        ) : null}
        {slots.map((slot, idx) => {
          const spot = spotById.get(slot.spotId);
          if (!spot) return null;
          const c =
            liveByHour?.get(slot.hour)?.get(slot.spotId) ??
            congestionByHour.get(slot.hour)?.get(slot.spotId);
          const crowded = c ? c.level >= 3 : false;
          const hourMap = congestionByHour.get(slot.hour) ?? new Map<number, Congestion>();
          const alternatives = crowded
            ? (liveAlts.get(`${slot.hour}:${slot.spotId}`)?.slice(0, 3) ??
              findAlternatives(spot, spots, hourMap, 3))
            : [];
          // 직전 슬롯 → 현재 슬롯 이동 경로 (인앱 지도, 실패 시 카카오맵 링크 폴백)
          const prevSpot = idx > 0 ? spotById.get(slots[idx - 1].spotId) : undefined;
          // 직전 슬롯과 같은 지점이면 경로 표시 자체를 없앤다(0km 무의미)
          const showRoute = prevSpot ? !sameLocation(prevSpot, spot) : false;
          const meta =
            showRoute && prevSpot ? routeMeta.get(`${prevSpot.spot_id}:${spot.spot_id}`) : undefined;
          return (
            <li key={slot.hour} className="relative">
              {showRoute && prevSpot ? (
                <button
                  type="button"
                  onClick={() => setRouteView({ from: prevSpot, to: spot })}
                  aria-label={`${prevSpot.name}에서 ${spot.name}까지 경로 보기`}
                  className="mb-3 inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-line bg-card px-3 py-1.5 text-xs font-semibold text-primary shadow-card transition-colors hover:border-primary"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-3.5 w-3.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 6.75V15m6-6v8.25m.503 3.498 4.875-2.437c.381-.19.622-.58.622-1.006V4.82c0-.836-.88-1.38-1.628-1.006l-3.869 1.934c-.317.159-.69.159-1.006 0L9.503 3.252a1.125 1.125 0 0 0-1.006 0L3.622 5.689C3.24 5.88 3 6.27 3 6.695V19.18c0 .836.88 1.38 1.628 1.006l3.869-1.934c.317-.159.69-.159 1.006 0l4.994 2.497c.317.158.69.158 1.006 0Z" />
                  </svg>
                  경로 보기
                  {meta ? (
                    <span className="font-medium text-dim">
                      · {(meta.distance_m / 1000).toFixed(1)}km · 약 {formatDuration(meta.duration_s)}
                    </span>
                  ) : null}
                </button>
              ) : null}
            <div className="relative">
              <span className="absolute -left-8 top-4">
                <LevelDot level={c?.level ?? 1} size={14} />
              </span>
            <div
              className={`rounded-card p-4 shadow-card ${
                crowded ? "bg-lv4/5 ring-1 ring-lv4/30" : "bg-card"
              }`}
            >
              <div className="flex items-center justify-between gap-3">
                {/* min-w-0: 이름 truncate가 작동하려면 flex 체인 전체에 필요 — 없으면 행이 카드 밖으로 넘침 */}
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <select
                    aria-label="시간 변경"
                    value={slot.hour}
                    onChange={(e) => changeHour(slot.hour, Number(e.target.value))}
                    className="shrink-0 rounded-lg border border-line bg-bg px-2 py-1.5 text-base font-semibold text-ink"
                  >
                    {Array.from({ length: HOUR_MAX - HOUR_MIN + 1 }, (_, i) => HOUR_MIN + i).map(
                      (h) => (
                        <option key={h} value={h} disabled={slots.some((s) => s.hour === h && s.hour !== slot.hour)}>
                          {h}시
                        </option>
                      ),
                    )}
                  </select>
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-ink">{spotDisplayName(spot.name)}</p>
                    <p className="text-xs text-dim">{catLabel(spot.cat2)}</p>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {c ? <LevelBadge level={c.level} imputed={c.is_imputed} /> : null}
                  <button
                    type="button"
                    onClick={() => removeSlot(slot.hour)}
                    aria-label={`${spot.name} 삭제`}
                    className="cursor-pointer rounded-full p-1.5 text-dim hover:text-lv4"
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-4.5 w-4.5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                    </svg>
                  </button>
                </div>
              </div>
              {c ? (
                <div className="mt-3">
                  <PressureBar pressure={c.pressure} level={c.level} />
                </div>
              ) : null}
              {crowded ? (
                <div className="mt-3 space-y-2 rounded-xl bg-bg p-3">
                  <p className="text-xs font-semibold text-lv3">
                    이 시간대는 붐빌 것으로 예측돼요. 같은 카테고리의 한적한 대안:
                  </p>
                  {alternatives.length > 0 ? (
                    <ul className="space-y-1.5">
                      {alternatives.map((alt) => (
                        <li key={alt.spot.spot_id} className="flex items-center justify-between gap-2">
                          <Link
                            href={`/spots/${alt.spot.spot_id}`}
                            className="min-w-0 truncate text-sm font-medium text-primary"
                          >
                            {spotDisplayName(alt.spot.name)}
                          </Link>
                          <span className="flex shrink-0 items-center gap-2 text-xs text-dim">
                            {alt.distanceKm}km
                            <LevelBadge level={alt.congestion.level} imputed={alt.congestion.is_imputed} />
                            <button
                              type="button"
                              onClick={() => addSlot(alt.spot.spot_id)}
                              className="cursor-pointer rounded-md border border-line px-2 py-1 font-medium text-ink hover:border-primary"
                            >
                              교체
                            </button>
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-xs text-dim">대안 데이터를 찾지 못했어요.</p>
                  )}
                </div>
              ) : null}
            </div>
            </div>
            </li>
          );
        })}

        {/* 오토플랜 여정의 도착 지점 — 타임라인 맨 아래 */}
        {journey?.end && slots.length > 0 ? (
          <li className="relative">
            <span className="absolute -left-8 top-0.5">
              <span className="block h-3.5 w-3.5 rounded-full border-2 border-white bg-cta shadow-sm" />
            </span>
            <p className="pt-0.5 text-xs font-semibold text-dim">도착 · {journey.end.label}</p>
          </li>
        ) : null}

        {/* 빈 일정: 막막한 백지 대신 안내 장면 (계획 여행자가 처음 오는 화면) */}
        {loaded && slots.length === 0 ? (
          <li className="animate-card-in rounded-card bg-card px-6 py-10 text-center shadow-card">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.4}
              className="mx-auto h-14 w-14 text-primary/60"
              aria-hidden
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25s-7.5-4.108-7.5-11.25a7.5 7.5 0 1 1 15 0Z"
              />
            </svg>
            <p className="mt-4 font-bold text-ink">아직 담은 곳이 없어요</p>
            <p className="mt-1 text-sm leading-relaxed text-dim">
              가고 싶은 곳을 시간대별로 담으면
              <br />그 시간에 얼마나 붐빌지 미리 알려드려요.
            </p>
          </li>
        ) : null}

        <button
          type="button"
          onClick={() => setPicker({ open: true, forHour: null })}
          data-coach="sched-add"
          className="relative w-full cursor-pointer rounded-card border border-dashed border-line bg-card/50 py-4 text-sm font-semibold text-dim transition-colors hover:border-primary hover:text-primary"
        >
          + 스팟 추가
        </button>
      </ol>

      {picker.open ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/60"
          role="dialog"
          aria-modal="true"
          aria-label="스팟 선택"
        >
          {/* viewport-fit=cover라 하단 시트는 홈 인디케이터 높이만큼 직접 띄운다 */}
          <div
            className="max-h-[80dvh] w-full max-w-md overflow-y-auto rounded-t-3xl border-t border-line bg-surface p-5 md:max-w-xl"
            style={{ paddingBottom: "calc(1.25rem + env(safe-area-inset-bottom))" }}
          >
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-bold text-ink">
                스팟 선택
                {pickerRefSpot ? (
                  <span className="ml-2 text-xs font-medium text-dim">
                    {spotDisplayName(pickerRefSpot.name)} 근처 순
                  </span>
                ) : null}
              </h2>
              <button
                type="button"
                onClick={() => setPicker({ open: false, forHour: null })}
                aria-label="닫기"
                className="cursor-pointer rounded-full p-1.5 text-dim hover:text-ink"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-5 w-5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <input
              type="search"
              autoFocus
              placeholder="스팟 이름 검색 (예: 성산일출봉)"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="mb-3 w-full rounded-lg border border-line bg-bg px-3 py-2.5 text-base text-ink placeholder:text-dim"
            />
            <ul className="space-y-1.5 pb-6">
              {filteredSpots.map((s) => (
                <li key={s.spot_id}>
                  <button
                    type="button"
                    onClick={() => addSlot(s.spot_id)}
                    className="w-full cursor-pointer rounded-xl border border-line bg-bg p-3 text-left hover:border-primary"
                  >
                    <span className="block text-sm font-semibold text-ink">{s.name}</span>
                    <span className="text-xs text-dim">
                      {s.region} · {catLabel(s.cat2)}
                      {pickerRefSpot
                        ? ` · ${(Math.round(haversineKm(pickerRefSpot.lat, pickerRefSpot.lng, s.lat, s.lng) * 10) / 10).toFixed(1)}km`
                        : ""}
                    </span>
                  </button>
                </li>
              ))}
              {filteredSpots.length === 0 ? (
                <li className="px-3 py-8 text-center">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="mx-auto h-9 w-9 text-dim/50" aria-hidden>
                    <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
                  </svg>
                  <p className="mt-2 text-sm text-dim">
                    「{query}」에 맞는 곳이 없어요.
                    <br />다른 이름으로 찾아보세요.
                  </p>
                </li>
              ) : null}
            </ul>
          </div>
        </div>
      ) : null}

      {routeView ? (
        <RouteView
          from={routeView.from}
          to={routeView.to}
          onClose={() => setRouteView(null)}
        />
      ) : null}
    </main>
  );
}

const WEEKDAY_SHORT = ["일", "월", "화", "수", "목", "금", "토"];

// 날짜 pill용 짧은 표기 — "7월 29일 (수)"
function shortDate(d: string): string {
  const [y, m, day] = d.split("-").map(Number);
  const wd = WEEKDAY_SHORT[new Date(Date.UTC(y, m - 1, day)).getUTCDay()];
  return `${m}월 ${day}일 (${wd})`;
}

