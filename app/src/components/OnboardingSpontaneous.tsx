"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

// 즉흥 여행자 2단계 — 위치를 왜 쓰는지 먼저 알리고 권한을 요청한다.
// 대시보드에서 맥락 없이 시스템 팝업이 뜨는 것보다 낫고, 거부해도 괜찮다는 걸 알린다.
export function OnboardingSpontaneous() {
  const router = useRouter();
  const [asking, setAsking] = useState(false);

  function go() {
    router.replace("/dashboard");
  }

  function allow() {
    if (!navigator.geolocation) {
      go();
      return;
    }
    setAsking(true);
    navigator.geolocation.getCurrentPosition(
      () => go(),
      () => go(), // 거부해도 그대로 진행 — 일정·전역 기준으로 추천한다
      { timeout: 8000, maximumAge: 300_000 },
    );
  }

  return (
    <div className="mt-8 space-y-3">
      <button
        type="button"
        onClick={allow}
        disabled={asking}
        aria-busy={asking}
        className="w-full cursor-pointer rounded-card bg-cta px-5 py-4 text-base font-bold text-on-cta transition-transform active:scale-[0.99] disabled:opacity-60"
      >
        {asking ? "위치를 확인하는 중…" : "위치 허용하고 시작하기"}
      </button>
      <button
        type="button"
        onClick={go}
        className="w-full cursor-pointer rounded-card px-5 py-3 text-sm font-medium text-dim hover:text-ink"
      >
        나중에 할게요
      </button>
    </div>
  );
}
