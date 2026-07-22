"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { formatKstDate, LEVEL_COLOR, spotDisplayName } from "@/lib/constants";
import type { Congestion, ScheduleSlot, Spot } from "@/lib/types";

const STORAGE_KEY = "jejunow:schedule";

type Plan = { date: string; slots: ScheduleSlot[] };

/** 담아둔 일정이 있으면 홈 최상단에 요약해 보여준다 (없으면 아무것도 그리지 않음) */
export function MyPlanCard({
  spots,
  congestion,
}: {
  spots: Spot[];
  congestion: Congestion[];
}) {
  const [plan, setPlan] = useState<Plan | null>(null);

  // localStorage 읽기(외부 시스템) — 마이크로태스크로 지연해 cascading render 회피
  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return;
        const parsed = JSON.parse(raw) as Partial<Plan>;
        if (!parsed.date || !Array.isArray(parsed.slots) || parsed.slots.length === 0) return;
        setPlan({ date: parsed.date, slots: parsed.slots });
      } catch {
        // 손상된 저장값 무시
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!plan) return null;

  const byId = new Map(spots.map((s) => [s.spot_id, s]));
  const congestionById = new Map(congestion.map((c) => [c.spot_id, c]));
  const items = plan.slots
    .map((sl) => ({ slot: sl, spot: byId.get(sl.spotId) }))
    .filter((x): x is { slot: ScheduleSlot; spot: Spot } => Boolean(x.spot))
    .sort((a, b) => a.slot.hour - b.slot.hour);

  if (items.length === 0) return null;

  return (
    <section aria-labelledby="myplan-heading">
      <div className="mb-3 flex items-baseline justify-between">
        <h2 id="myplan-heading" className="text-base font-bold text-ink">
          내 여행
        </h2>
        <Link href="/schedule" className="text-sm font-semibold text-primary">
          일정 보기
        </Link>
      </div>

      <Link
        href="/schedule"
        className="block rounded-card bg-card p-4 shadow-card transition-transform active:scale-[0.99]"
      >
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-ink">{formatKstDate(plan.date)}</p>
          <span className="text-xs font-medium text-dim">{items.length}곳</span>
        </div>
        <ul className="mt-3 space-y-2.5">
          {items.slice(0, 4).map(({ slot, spot }) => {
            const c = congestionById.get(spot.spot_id);
            return (
              <li key={`${slot.hour}-${spot.spot_id}`} className="flex items-center gap-3">
                <span className="w-9 shrink-0 text-xs font-semibold text-dim">{slot.hour}시</span>
                {/* 미니 썸네일 — 텍스트 나열이던 카드에 사진 리듬 부여 */}
                <span className="relative h-10 w-10 shrink-0 overflow-hidden rounded-xl bg-line">
                  {spot.image_url ? (
                    <Image
                      src={spot.image_url}
                      alt=""
                      fill
                      sizes="40px"
                      className="object-cover photo-warm"
                      unoptimized={spot.image_url.endsWith(".bmp")}
                    />
                  ) : null}
                </span>
                <span className="min-w-0 flex-1 truncate text-sm font-medium text-ink">
                  {spotDisplayName(spot.name)}
                </span>
                <span
                  className="h-2 w-2 shrink-0 rounded-full"
                  style={{ backgroundColor: c ? LEVEL_COLOR[c.level] : "var(--color-line)" }}
                  aria-hidden
                />
              </li>
            );
          })}
        </ul>
        {items.length > 4 ? (
          <p className="mt-2.5 text-xs text-dim">외 {items.length - 4}곳</p>
        ) : null}
      </Link>
    </section>
  );
}
