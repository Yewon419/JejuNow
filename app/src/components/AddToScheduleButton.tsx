"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { HOUR_MAX, HOUR_MIN, todayInHorizon } from "@/lib/constants";
import { tapMedium } from "@/lib/haptics";
import { loadScheduleStore, makePlan, saveScheduleStore } from "@/lib/scheduleStore";
import type { ScheduleSlot } from "@/lib/types";

function nextFreeHour(slots: ScheduleSlot[]): number {
  const used = new Set(slots.map((s) => s.hour));
  for (let h = 10; h <= HOUR_MAX; h += 2) if (!used.has(h)) return h;
  for (let h = HOUR_MIN; h <= HOUR_MAX; h += 1) if (!used.has(h)) return h;
  return HOUR_MIN;
}

// 상세 하단 CTA — 현재 시안에 이 스팟을 담고 일정 화면으로 이동한다.
// (예전엔 단순 링크라 스팟이 담기지 않고 이동만 됐다)
export function AddToScheduleButton({ spotId }: { spotId: number }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  function add() {
    tapMedium();
    setBusy(true);
    const store = loadScheduleStore();
    let currentId = store.currentId;
    let plans = store.plans;
    let current = plans.find((p) => p.id === currentId);
    // 현재 시안이 없으면 오늘 날짜로 하나 만든다
    if (!current) {
      const p = makePlan("시안 1", todayInHorizon());
      plans = [...plans, p];
      currentId = p.id;
      current = p;
    }
    // 이미 담겨 있으면 그대로 이동, 아니면 다음 빈 시간에 추가
    if (!current.slots.some((s) => s.spotId === spotId)) {
      plans = plans.map((p) =>
        p.id === currentId
          ? {
              ...p,
              slots: [...p.slots, { hour: nextFreeHour(p.slots), spotId }].sort(
                (a, b) => a.hour - b.hour,
              ),
            }
          : p,
      );
    }
    saveScheduleStore({ plans, currentId });
    router.push("/schedule");
  }

  return (
    <button
      type="button"
      onClick={add}
      disabled={busy}
      className="shrink-0 cursor-pointer rounded-card bg-cta px-6 py-3.5 text-sm font-bold text-on-cta transition-transform active:scale-[0.97] disabled:opacity-60"
    >
      {busy ? "담는 중…" : "일정에 넣기"}
    </button>
  );
}
