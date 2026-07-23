"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { tapLight } from "@/lib/haptics";

// 상세 페이지 닫기 제스처 (iOS 관례 2종):
// ① 최상단에서 아래로 당기기 — 화면이 손가락을 따라 내려오고, 충분히 당기면 닫힌다
// ② 좌측 엣지→가운데 스와이프 (WKWebView 기본 백 제스처가 꺼져 있어 직접 구현)
// children을 감싸는 래퍼에 transform을 준다. 고정 하단 바는 transform 컨테이닝 블록에
// 걸리면 위치가 깨지므로 이 래퍼 밖(형제)에 둔다.
const EDGE_PX = 32;
const EDGE_MIN_DX = 50;
const PULL_START_DY = 12; // 당김 모드 진입 판정
const PULL_CLOSE_DY = 140; // 이만큼 당기면 닫힘
const PULL_FLICK_DY = 70; // 빠른 플릭이면 이 거리로도 닫힘
const PULL_FLICK_SPEED = 0.5; // px/ms

export function DetailDismiss({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let start: { x: number; y: number; t: number; scrollY: number } | null = null;
    let last: { x: number; y: number; t: number } | null = null;
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
      last = { x: t.clientX, y: t.clientY, t: e.timeStamp };
      pulling = false;
    }

    function onMove(e: TouchEvent) {
      const s = start;
      if (!s || e.touches.length !== 1) return;
      const t = e.touches[0];
      last = { x: t.clientX, y: t.clientY, t: e.timeStamp };
      const dx = t.clientX - s.x;
      const dy = t.clientY - s.y;
      if (!pulling) {
        // 당김 모드 진입: 최상단 + 아래로 + 수직 우세 (엣지 스와이프와는 배타)
        if (
          s.scrollY <= 2 &&
          window.scrollY <= 0 &&
          s.x > EDGE_PX &&
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

    function finishEdge(s: { x: number; y: number }, endX: number, endY: number): boolean {
      const dx = endX - s.x;
      const dy = endY - s.y;
      return s.x <= EDGE_PX && dx >= EDGE_MIN_DX && Math.abs(dx) > Math.abs(dy) * 1.2;
    }

    function onEnd(e: TouchEvent) {
      const s = start;
      start = null;
      if (!s) return;
      const t = e.changedTouches[0];
      const dy = t.clientY - s.y;
      const dt = Math.max(1, e.timeStamp - s.t);
      if (pulling) {
        pulling = false;
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
        return;
      }
      if (finishEdge(s, t.clientX, t.clientY)) close();
    }

    // iOS가 엣지 제스처를 자체 소비하면 touchend 대신 touchcancel이 온다 — 마지막 좌표로 판정
    function onCancel() {
      const s = start;
      start = null;
      if (pulling) {
        pulling = false;
        resetPull(true);
        return;
      }
      if (s && last && finishEdge(s, last.x, last.y)) close();
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
