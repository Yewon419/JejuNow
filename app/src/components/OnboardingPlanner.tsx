"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { HORIZON_END, HORIZON_START, todayInHorizon } from "@/lib/constants";
import { notifySuccess } from "@/lib/haptics";
import { loadScheduleStore, saveScheduleStore } from "@/lib/scheduleStore";

// 계획 여행자 2단계 — 여행 날짜를 먼저 받아 일정 화면에 채워 넘긴다.

export function OnboardingPlanner() {
  const router = useRouter();
  const [date, setDate] = useState(todayInHorizon());

  function go(withDate: boolean) {
    if (withDate) {
      notifySuccess();
      const store = loadScheduleStore();
      saveScheduleStore({ ...store, current: date });
    }
    router.replace("/schedule");
  }

  return (
    <div className="mt-8 space-y-3">
      <label className="block">
        <span className="mb-2 block text-sm font-semibold text-ink">여행 날짜</span>
        <input
          type="date"
          value={date}
          min={HORIZON_START}
          max={HORIZON_END}
          onChange={(e) => setDate(e.target.value)}
          className="w-full rounded-lg border border-line bg-card px-4 py-3 text-base text-ink shadow-card"
        />
      </label>

      <button
        type="button"
        onClick={() => go(true)}
        className="w-full cursor-pointer rounded-card bg-cta px-5 py-4 text-base font-bold text-on-cta transition-transform active:scale-[0.99]"
      >
        이 날짜로 일정 짜기
      </button>
      <button
        type="button"
        onClick={() => go(false)}
        className="w-full cursor-pointer rounded-card px-5 py-3 text-sm font-medium text-dim hover:text-ink"
      >
        나중에 정할게요
      </button>
    </div>
  );
}
