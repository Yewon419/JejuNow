"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { tapLight } from "@/lib/haptics";

// 좌우 스와이프로 오갈 탭 순서 — BottomNav의 TABS href 순서와 동기 유지
const TAB_ORDER = ["/dashboard", "/map", "/schedule"] as const;

const AXIS_LOCK = 10; // 이 정도 움직여야 가로/세로 방향을 확정
const SWIPE_MIN_X = 70; // 거리로 커밋하는 최소치
const FLICK_MIN_X = 40; // 빠른 플릭이면 이 거리로도 커밋
const FLICK_SPEED = 0.5; // px/ms
const DRAG_FACTOR = 0.85; // 손가락 대비 이동 비율(살짝 저항)
const RUBBER_FACTOR = 0.2; // 이웃 탭이 없을 때 러버밴드 저항

/** 터치 시작점이 가로 스크롤 요소(홈 캐러셀 등) 안이면 스와이프가 아니라 스크롤이다 */
function insideHorizontalScroller(target: EventTarget | null): boolean {
  for (
    let el = target instanceof Element ? target : null;
    el && el !== document.body;
    el = el.parentElement
  ) {
    if (el.scrollWidth > el.clientWidth + 4) {
      const overflowX = getComputedStyle(el).overflowX;
      if (overflowX === "auto" || overflowX === "scroll") return true;
    }
  }
  return false;
}

/** 탭 화면을 좌우로 스와이프해 이웃 탭으로 이동한다(왼쪽=다음, 오른쪽=이전).
 *  화면이 손가락을 따라 움직이고(실시간), 충분히 밀면 전환·아니면 스냅백한다.
 *  지도 위에서는 카카오맵이 터치를 소비(stopPropagation)해 window까지 오지 않으므로
 *  지도 팬이 우선되고, 지도 밖 여백 스와이프만 탭을 전환한다. */
export function SwipeNav({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const wrapRef = useRef<HTMLDivElement>(null);
  // 스와이프로 전환했을 때만 진입 모션 방향을 기억 (탭 바 탭은 모션 없음)
  const [dir, setDir] = useState<"next" | "prev" | null>(null);

  useEffect(() => {
    const idx = TAB_ORDER.findIndex((p) => pathname.startsWith(p));
    let start: { x: number; y: number; t: number } | null = null;
    let mode: "none" | "horizontal" | "vertical" = "none";

    function setX(px: number, animate: boolean) {
      const el = wrapRef.current;
      if (!el) return;
      el.style.transition = animate ? "transform 0.2s cubic-bezier(0.16, 1, 0.3, 1)" : "none";
      el.style.transform = px ? `translateX(${px}px)` : "";
    }

    function onStart(e: TouchEvent) {
      if (e.touches.length !== 1 || idx === -1) {
        start = null;
        return;
      }
      const target = e.target;
      // 슬라이더·입력 필드 위 드래그는 조작이지 스와이프가 아니다 (지도 시간 슬라이더 직격)
      if (target instanceof Element && target.closest("input,select,textarea")) {
        start = null;
        return;
      }
      // 가로 스크롤 컨테이너(홈 캐러셀 등) 안에서 시작한 터치는 스크롤 조작
      if (insideHorizontalScroller(target)) {
        start = null;
        return;
      }
      const t = e.touches[0];
      start = { x: t.clientX, y: t.clientY, t: e.timeStamp };
      mode = "none";
    }

    function onMove(e: TouchEvent) {
      const s = start;
      if (!s || e.touches.length !== 1) return;
      const t = e.touches[0];
      const dx = t.clientX - s.x;
      const dy = t.clientY - s.y;
      if (mode === "none") {
        if (Math.abs(dx) < AXIS_LOCK && Math.abs(dy) < AXIS_LOCK) return;
        // 가로 우세일 때만 스와이프 — 세로는 스크롤에 양보
        mode = Math.abs(dx) > Math.abs(dy) ? "horizontal" : "vertical";
      }
      if (mode !== "horizontal") return;
      e.preventDefault(); // 가로 잠금 — 세로 스크롤·바운스가 끼어들지 않게
      const toNext = dx < 0;
      const hasNeighbor = toNext ? idx < TAB_ORDER.length - 1 : idx > 0;
      setX(dx * (hasNeighbor ? DRAG_FACTOR : RUBBER_FACTOR), false);
    }

    function onEnd(e: TouchEvent) {
      const s = start;
      start = null;
      if (!s || mode !== "horizontal") {
        mode = "none";
        return;
      }
      mode = "none";
      const t = e.changedTouches[0];
      const dx = t.clientX - s.x;
      const speed = Math.abs(dx) / Math.max(1, e.timeStamp - s.t);
      const toNext = dx < 0;
      const hasNeighbor = toNext ? idx < TAB_ORDER.length - 1 : idx > 0;
      const commit =
        hasNeighbor &&
        (Math.abs(dx) >= SWIPE_MIN_X || (Math.abs(dx) >= FLICK_MIN_X && speed >= FLICK_SPEED));
      if (commit) {
        tapLight();
        const el = wrapRef.current;
        if (el) {
          el.style.transition = "transform 0.18s ease-in";
          el.style.transform = `translateX(${toNext ? "-100%" : "100%"})`;
        }
        setDir(toNext ? "next" : "prev");
        setTimeout(() => router.push(TAB_ORDER[toNext ? idx + 1 : idx - 1]), 140);
      } else {
        setX(0, true); // 스냅백
      }
    }

    function onCancel() {
      start = null;
      if (mode === "horizontal") setX(0, true);
      mode = "none";
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
  }, [pathname, router]);

  // 진입 모션(220ms)이 끝난 뒤 방향을 비운다 — 탭 바 탭 전환에 재사용되지 않게
  useEffect(() => {
    if (dir === null) return;
    const t = setTimeout(() => setDir(null), 400);
    return () => clearTimeout(t);
  }, [dir]);

  return (
    <div
      key={pathname}
      ref={wrapRef}
      className={
        dir === "next"
          ? "animate-page-from-right"
          : dir === "prev"
            ? "animate-page-from-left"
            : undefined
      }
    >
      {children}
    </div>
  );
}
