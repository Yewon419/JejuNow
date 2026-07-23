"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { tapLight } from "@/lib/haptics";

// 상세 페이지 닫기 제스처 (iOS 관례 2종):
// ① 페이지 최상단에서 아래로 빠르게 당기기 (pull-to-dismiss)
// ② 좌측 끝(엣지)을 잡고 가운데로 밀기 (back 스와이프 — WKWebView 기본 제스처가 꺼져 있어 직접 구현)
const EDGE_PX = 24;
const EDGE_MIN_DX = 70;
const PULL_MIN_DY = 90;
const PULL_MIN_SPEED = 0.45; // px/ms — 천천히 당기는 스크롤 바운스와 구분

export function DetailDismiss() {
  const router = useRouter();

  useEffect(() => {
    let start: { x: number; y: number; t: number; scrollY: number } | null = null;

    function close() {
      tapLight();
      if (window.history.length > 1) router.back();
      else router.push("/dashboard");
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
    }

    function onEnd(e: TouchEvent) {
      const s = start;
      start = null;
      if (!s) return;
      const t = e.changedTouches[0];
      const dx = t.clientX - s.x;
      const dy = t.clientY - s.y;
      const dt = Math.max(1, e.timeStamp - s.t);
      // ② 엣지 백 스와이프
      if (s.x <= EDGE_PX && dx >= EDGE_MIN_DX && Math.abs(dx) > Math.abs(dy) * 1.5) {
        close();
        return;
      }
      // ① 최상단에서 빠르게 아래로
      if (
        s.scrollY <= 2 &&
        dy >= PULL_MIN_DY &&
        dy / dt >= PULL_MIN_SPEED &&
        Math.abs(dy) > Math.abs(dx) * 1.5
      ) {
        close();
      }
    }

    window.addEventListener("touchstart", onStart, { passive: true });
    window.addEventListener("touchend", onEnd, { passive: true });
    return () => {
      window.removeEventListener("touchstart", onStart);
      window.removeEventListener("touchend", onEnd);
    };
  }, [router]);

  return null;
}
