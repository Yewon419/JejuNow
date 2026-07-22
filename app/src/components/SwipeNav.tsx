"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { tapLight } from "@/lib/haptics";

// 좌우 스와이프로 오갈 탭 순서 — BottomNav의 TABS href 순서와 동기 유지
const TAB_ORDER = ["/dashboard", "/map", "/schedule"] as const;

// 수평 이동이 이 정도는 되어야 탭 전환(의도치 않은 짧은 터치 방지)
const SWIPE_MIN_X = 70;

/** 탭 화면을 좌우로 스와이프해 이웃 탭으로 이동한다(왼쪽=다음, 오른쪽=이전).
 *  지도 위에서는 카카오맵이 터치를 소비(stopPropagation)해 window까지 오지 않으므로
 *  지도 팬이 우선되고, 지도 밖 여백 스와이프만 탭을 전환한다. */
export function SwipeNav({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const start = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    function onStart(e: TouchEvent) {
      if (e.touches.length !== 1) {
        start.current = null;
        return;
      }
      const t = e.touches[0];
      start.current = { x: t.clientX, y: t.clientY };
    }
    function onEnd(e: TouchEvent) {
      const s = start.current;
      start.current = null;
      if (!s) return;
      const t = e.changedTouches[0];
      const dx = t.clientX - s.x;
      const dy = t.clientY - s.y;
      // 수평 스와이프가 명확할 때만(수직 스크롤·짧은 탭 제외)
      if (Math.abs(dx) < SWIPE_MIN_X || Math.abs(dx) < Math.abs(dy) * 2) return;
      const idx = TAB_ORDER.findIndex((p) => pathname.startsWith(p));
      if (idx === -1) return;
      const next = dx < 0 ? idx + 1 : idx - 1; // 왼쪽으로 밀면 다음 탭
      if (next < 0 || next >= TAB_ORDER.length) return;
      tapLight();
      router.push(TAB_ORDER[next]);
    }
    window.addEventListener("touchstart", onStart, { passive: true });
    window.addEventListener("touchend", onEnd, { passive: true });
    return () => {
      window.removeEventListener("touchstart", onStart);
      window.removeEventListener("touchend", onEnd);
    };
  }, [pathname, router]);

  return <>{children}</>;
}
