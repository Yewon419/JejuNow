"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { getCurrentPosition } from "@/lib/geo";
import { tapMedium } from "@/lib/haptics";

// 즉흥 여행자 2단계 — 위치를 왜 쓰는지 먼저 알리고 권한을 요청한다.
// 대시보드에서 맥락 없이 시스템 팝업이 뜨는 것보다 낫고, 거부해도 괜찮다는 걸 알린다.
//
// ⚠ App Review 5.1.1(iv): 사전 안내 화면을 두면 그 뒤에는 **항상** 시스템 권한 요청으로
// 이어져야 한다. 팝업을 건너뛰는 우회 버튼("나중에 할게요")은 권한 요청을 미루게 만들어
// 지적받았다(2026-09-04). 거절은 시스템 팝업에서 하고, 거절해도 앱은 그대로 진행한다.
export function OnboardingSpontaneous() {
  const router = useRouter();
  const [asking, setAsking] = useState(false);

  function go() {
    router.replace("/dashboard");
  }

  function allow() {
    tapMedium();
    setAsking(true);
    getCurrentPosition(
      () => go(),
      () => go(), // 거부·미지원이어도 그대로 진행 — 일정·전역 기준으로 추천한다
      { timeout: 8000, maximumAge: 300_000 },
    );
  }

  return (
    <div className="mt-8">
      <button
        type="button"
        onClick={allow}
        disabled={asking}
        aria-busy={asking}
        className="w-full cursor-pointer rounded-card bg-cta px-5 py-4 text-base font-bold text-on-cta transition-transform active:scale-[0.99] disabled:opacity-60"
      >
        {/* 버튼 문구는 중립어만 — 권한 승인을 유도하는 표현도 5.1.1(iv) 위반 */}
        {asking ? "위치를 확인하는 중…" : "계속"}
      </button>
    </div>
  );
}
