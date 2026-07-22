"use client";

import { useEffect } from "react";

// 이 시간보다 오래 백그라운드에 있다가 돌아오면 통째로 새로고침한다.
// iOS 셸(WKWebView)은 SPA 특성상 앱을 켜둔 채로는 배포가 반영되지 않는 문제의 방어선.
const STALE_MS = 15 * 60 * 1000; // 15분

/** 앱이 오래 잠들었다 깨어나면 최신 배포를 받도록 강제 리로드하는 무렌더 컴포넌트. */
export function StaleReload() {
  useEffect(() => {
    let hiddenAt: number | null = null;
    function onVisibility() {
      if (document.visibilityState === "hidden") {
        hiddenAt = Date.now();
        return;
      }
      if (hiddenAt !== null && Date.now() - hiddenAt > STALE_MS) {
        window.location.reload();
      }
      hiddenAt = null;
    }
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);
  return null;
}
