"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { type Alternative, findAlternatives } from "@/lib/alternatives";
import { SCHEDULE_COACH } from "@/lib/coach";
import { tapLight, tapMedium } from "@/lib/haptics";
import { type RouteData, fetchAlternativesLive, fetchRoute, simulateSchedule } from "@/lib/api";
import { CoachMark } from "./CoachMark";
import { RouteView } from "./RouteView";
import {
  HORIZON_END,
  HORIZON_START,
  HOUR_MAX,
  HOUR_MIN,
  catLabel,
  todayInHorizon,
} from "@/lib/constants";
import { fetchCongestionClient } from "@/lib/supabaseClient";
import type { Congestion, ScheduleSlot, Spot } from "@/lib/types";
import { LevelBadge, LevelDot, PressureBar } from "./LevelBadge";

const STORAGE_KEY = "jejunow:schedule";

type SpotPicker = { open: boolean; forHour: number | null };

export function ScheduleBuilder({ spots }: { spots: Spot[] }) {
  const [date, setDate] = useState(todayInHorizon());
  const [slots, setSlots] = useState<ScheduleSlot[]>([]);
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
  // 연속 슬롯 간 거리·시간 — 경로 칩에 미리 표시 (fetchRoute 캐시로 RouteView와 공유)
  const [routeMeta, setRouteMeta] = useState<Map<string, RouteData>>(new Map());

  const spotById = useMemo(() => new Map(spots.map((s) => [s.spot_id, s])), [spots]);

  // localStorage 복원 (외부 시스템 동기화 — 마이크로태스크로 지연해 cascading render 회피)
  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw) as { date: string; slots: ScheduleSlot[] };
          if (parsed.date >= HORIZON_START && parsed.date <= HORIZON_END) setDate(parsed.date);
          if (Array.isArray(parsed.slots)) setSlots(parsed.slots);
        }
      } catch {
        // 손상된 저장값은 무시
      }
      setLoaded(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);
  useEffect(() => {
    if (!loaded) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ date, slots }));
    } catch {
      // 저장 불가 환경 무시
    }
  }, [date, slots, loaded]);

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
      if (a && b) pairs.push([a, b]);
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
        if (r) m.set(k, r);
      }
      setRouteMeta(m);
    });
    return () => {
      cancelled = true;
    };
  }, [slots, spotById]);

  const filteredSpots = useMemo(() => {
    const q = query.trim();
    const pool = q ? spots.filter((s) => s.name.includes(q)) : spots.filter((s) => s.image_url);
    return pool.slice(0, 12);
  }, [spots, query]);

  function addSlot(spotId: number) {
    tapMedium();
    const hour = picker.forHour ?? nextFreeHour(slots);
    setSlots((prev) =>
      [...prev.filter((s) => s.hour !== hour), { hour, spotId }].sort((a, b) => a.hour - b.hour),
    );
    setPicker({ open: false, forHour: null });
    setQuery("");
  }

  function removeSlot(hour: number) {
    tapLight();
    setSlots((prev) => prev.filter((s) => s.hour !== hour));
  }

  function changeHour(from: number, to: number) {
    setSlots((prev) =>
      prev
        .map((s) => (s.hour === from ? { ...s, hour: to } : s))
        .sort((a, b) => a.hour - b.hour),
    );
  }

  return (
    <main className="space-y-6 px-5 pt-[calc(3rem+env(safe-area-inset-top,0px))]">
      <CoachMark id="schedule" steps={SCHEDULE_COACH} />
      <header>
        <h1 className="text-2xl font-bold text-ink">내 여행</h1>
        {/* 사용법 설명은 코치마크가 대신한다 (중복 제거) */}
        <input
          type="date"
          aria-label="여행 날짜"
          value={date}
          min={HORIZON_START}
          max={HORIZON_END}
          onChange={(e) => setDate(e.target.value)}
          className="mt-3 rounded-lg border border-line bg-card px-3 py-2 text-base text-ink shadow-card"
        />
      </header>

      <ol aria-label="일정 슬롯" className="relative space-y-3 pl-8">
        {slots.length > 1 ? (
          <span aria-hidden className="absolute bottom-5 left-[0.4375rem] top-5 w-0.5 bg-line" />
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
          const meta = prevSpot ? routeMeta.get(`${prevSpot.spot_id}:${spot.spot_id}`) : undefined;
          return (
            <li key={slot.hour} className="relative">
              {prevSpot ? (
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
                      · {(meta.distance_m / 1000).toFixed(1)}km · 약{" "}
                      {Math.max(1, Math.round(meta.duration_s / 60))}분
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
                    <p className="truncate font-semibold text-ink">{spot.name}</p>
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
                            {alt.spot.name}
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
            className="max-h-[80dvh] w-full max-w-md overflow-y-auto rounded-t-3xl border-t border-line bg-surface p-5"
            style={{ paddingBottom: "calc(1.25rem + env(safe-area-inset-bottom))" }}
          >
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-bold text-ink">스팟 선택</h2>
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
                    </span>
                  </button>
                </li>
              ))}
              {filteredSpots.length === 0 ? (
                <li className="p-3 text-sm text-dim">검색 결과가 없어요.</li>
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

function nextFreeHour(slots: ScheduleSlot[]): number {
  const used = new Set(slots.map((s) => s.hour));
  for (let h = 10; h <= HOUR_MAX; h += 2) {
    if (!used.has(h)) return h;
  }
  for (let h = HOUR_MIN; h <= HOUR_MAX; h += 1) {
    if (!used.has(h)) return h;
  }
  return HOUR_MIN;
}
