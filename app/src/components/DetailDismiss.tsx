"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { tapLight } from "@/lib/haptics";

// 상세 페이지 닫기 제스처 — 최상단에서 아래로 당기기(화면이 손가락을 따라 내려오고,
// 충분히 당기면 닫힌다). 좌측 엣지 백 스와이프는 JS로 구현하지 않는다: 시스템이 엣지
// 터치를 점유해 실기기에서 이벤트가 오지 않는다. 애플 표준대로 iOS 셸의 WKWebView
// 네이티브 제스처(allowsBackForwardNavigationGestures — SwipeBackViewController)가 담당.
// children을 감싸는 래퍼에 transform을 준다. 고정 하단 바는 transform 컨테이닝 블록에
// 걸리면 위치가 깨지므로 이 래퍼 밖(형제)에 둔다.
const PULL_START_DY = 12; // 당김 모드 진입 판정
const PULL_CLOSE_DY = 140; // 이만큼 당기면 닫힘
const PULL_FLICK_DY = 70; // 빠른 플릭이면 이 거리로도 닫힘
const PULL_FLICK_SPEED = 0.5; // px/ms

export function DetailDismiss({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let start: { x: number; y: number; t: number; scrollY: number } | null = null;
    let pulling = false;

    function close() {
      tapLight();
      if (window.history.length > 1) router.back();
      else router.push("/dashboard");
    }

    function resetPull(animate: boolean) {
      const el = wrapRef.current;
      if (!el) return;
      el.style.transition = animate ? "transform 0.2s ease-out" : "none";
      el.style.transform = "";
    }

    function onStart(e: TouchEvent) {
      if (e.touches.length !== 1) {
        start = null;
        return;
      }
      // 코치마크·경로 모달 등 오버레이가 스크롤을 잠근 동안엔 비활성
      if (document.body.style.overflow === "hidden") {
        start = null;
        return;
      }
      const t = e.touches[0];
      start = { x: t.clientX, y: t.clientY, t: e.timeStamp, scrollY: window.scrollY };
      pulling = false;
    }

    function onMove(e: TouchEvent) {
      const s = start;
      if (!s || e.touches.length !== 1) return;
      const t = e.touches[0];
      const dx = t.clientX - s.x;
      const dy = t.clientY - s.y;
      if (!pulling) {
        // 당김 모드 진입: 최상단 + 아래로 + 수직 우세
        if (
          s.scrollY <= 2 &&
          window.scrollY <= 0 &&
          dy > PULL_START_DY &&
          Math.abs(dy) > Math.abs(dx) * 1.2
        ) {
          pulling = true;
        }
      }
      if (pulling) {
        if (dy > 0) {
          e.preventDefault(); // 네이티브 스크롤·바운스가 함께 움직이지 않게
          const el = wrapRef.current;
          if (el) {
            el.style.transition = "none";
            el.style.transform = `translateY(${Math.round(dy * 0.55)}px)`;
          }
        } else {
          resetPull(false);
        }
      }
    }

    function onEnd(e: TouchEvent) {
      const s = start;
      start = null;
      if (!s || !pulling) return;
      pulling = false;
      const t = e.changedTouches[0];
      const dy = t.clientY - s.y;
      const dt = Math.max(1, e.timeStamp - s.t);
      const el = wrapRef.current;
      if (dy >= PULL_CLOSE_DY || (dy >= PULL_FLICK_DY && dy / dt >= PULL_FLICK_SPEED)) {
        if (el) {
          el.style.transition = "transform 0.22s ease-in";
          el.style.transform = "translateY(100dvh)";
        }
        setTimeout(close, 170);
      } else {
        resetPull(true);
      }
    }

    function onCancel() {
      start = null;
      if (pulling) {
        pulling = false;
        resetPull(true);
      }
    }

    window.addEventListener("touchstart", onStart, { passive: true });
    window.addEventListener("touchmove", onMove, { passive: false });
    window.addEventListener("touchend", onEnd, { passive: true });
    window.addEventListener("touchcancel", onCancel, { passive: true });
    return () => {
      window.removeEventListener("touchstart", onStart);
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("touchend", onEnd);
      window.removeEventListener("touchcancel", onCancel);
    };
  }, [router]);

  return <div ref={wrapRef}>{children}</div>;
}
