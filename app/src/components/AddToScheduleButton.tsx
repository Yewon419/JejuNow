"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { todayInHorizon } from "@/lib/constants";
import { tapMedium } from "@/lib/haptics";
import { loadScheduleStore, makePlan, nextFreeHour, saveScheduleStore } from "@/lib/scheduleStore";

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
    // 이미 담겨 있으면 그대로 이동, 아니면 다음 빈 시간에 추가.
    // 같은 시간 슬롯은 교체 — 일정이 꽉 찼을 때 중복 hour(React key 충돌)를 막는다.
    if (!current.slots.some((s) => s.spotId === spotId)) {
      plans = plans.map((p) => {
        if (p.id !== currentId) return p;
        const hour = nextFreeHour(p.slots);
        return {
          ...p,
          slots: [...p.slots.filter((s) => s.hour !== hour), { hour, spotId }].sort(
            (a, b) => a.hour - b.hour,
          ),
        };
      });
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
