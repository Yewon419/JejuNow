"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { notifySuccess } from "@/lib/haptics";
import { decodePlan } from "@/lib/planShare";
import { loadScheduleStore, makePlan, saveScheduleStore } from "@/lib/scheduleStore";

// 공유받은 계획을 내 시안 목록에 새로 담고 일정 화면으로 이동한다.
export function ImportPlanButton({ code }: { code: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  function importPlan() {
    const shared = decodePlan(code);
    if (!shared) return;
    setBusy(true);
    const store = loadScheduleStore();
    const plan = {
      ...makePlan(shared.name || "받은 시안", shared.date),
      slots: shared.slots,
      journey: shared.journey,
    };
    saveScheduleStore({ plans: [...store.plans, plan], currentId: plan.id });
    notifySuccess();
    router.push("/schedule");
  }

  return (
    <button
      type="button"
      onClick={importPlan}
      disabled={busy}
      className="w-full cursor-pointer rounded-card bg-cta px-5 py-3.5 text-base font-bold text-on-cta transition-transform active:scale-[0.99] disabled:opacity-60"
    >
      {busy ? "담는 중…" : "내 시안으로 담기"}
    </button>
  );
}
