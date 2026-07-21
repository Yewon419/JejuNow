"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { resetAllCoach } from "@/lib/coach";
import { tapLight } from "@/lib/haptics";

export function SettingsActions() {
  const router = useRouter();
  const [coachReset, setCoachReset] = useState(false);

  function replayTutorial() {
    tapLight();
    resetAllCoach();
    setCoachReset(true);
  }

  function rechooseType() {
    try {
      localStorage.removeItem("jejunow:travelerType");
    } catch {
      // 저장 불가 환경 — 그래도 온보딩으로 보낸다
    }
    router.push("/");
  }

  return (
    <section className="space-y-3" aria-label="앱 설정">
      <button
        type="button"
        onClick={replayTutorial}
        className="w-full cursor-pointer rounded-card bg-card p-4 text-left shadow-card transition-transform active:scale-[0.99]"
      >
        <span className="block font-semibold text-ink">앱 사용법 다시 보기</span>
        <span className="mt-0.5 block text-sm text-dim">
          {coachReset
            ? "초기화했어요. 각 화면에 들어가면 안내가 다시 나옵니다."
            : "홈·지도·일정·상세 화면의 안내를 처음부터 다시 봅니다."}
        </span>
      </button>

      <button
        type="button"
        onClick={rechooseType}
        className="w-full cursor-pointer rounded-card bg-card p-4 text-left shadow-card transition-transform active:scale-[0.99]"
      >
        <span className="block font-semibold text-ink">여행자 유형 다시 고르기</span>
        <span className="mt-0.5 block text-sm text-dim">
          즉흥 여행자와 계획 여행자 중 다시 선택합니다.
        </span>
      </button>
    </section>
  );
}
