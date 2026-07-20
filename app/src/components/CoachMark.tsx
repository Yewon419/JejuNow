"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { type CoachId, type CoachStep, isCoachDone, markCoachDone } from "@/lib/coach";

type Rect = { top: number; left: number; width: number; height: number };

const PAD = 8; // 스포트라이트가 대상보다 살짝 넓게 뚫리도록

function readRect(anchor: string): Rect | null {
  const el = document.querySelector(`[data-coach="${anchor}"]`);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  if (r.width === 0 && r.height === 0) return null;
  return {
    top: r.top - PAD,
    left: r.left - PAD,
    width: r.width + PAD * 2,
    height: r.height + PAD * 2,
  };
}

export function CoachMark({ id, steps }: { id: CoachId; steps: CoachStep[] }) {
  // 완료 여부는 localStorage라 서버 렌더와 다를 수 있다 — 마운트 후에만 활성화한다
  const [active, setActive] = useState(false);
  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);
  // 한 단계도 실제로 보여주지 못했다면 완료로 저장하지 않는다.
  // (예: 빈 일정 화면처럼 대상이 아직 없는 경우 — 다음에 내용이 생기면 그때 보여준다)
  const shownRef = useRef(false);

  useEffect(() => {
    if (isCoachDone(id)) return;
    // 대상이 그려질 때까지 한 프레임 양보
    const t = setTimeout(() => setActive(true), 400);
    return () => clearTimeout(t);
  }, [id]);

  const finish = useCallback(() => {
    if (shownRef.current) markCoachDone(id);
    setActive(false);
  }, [id]);

  // 현재 단계의 대상 위치 측정(DOM = 외부 시스템). 대상이 없으면 다음 단계로 넘긴다.
  // 첫 측정은 마이크로태스크로 지연해 cascading render 회피 — resize는 이벤트라 그대로 둔다.
  useEffect(() => {
    if (!active) return;
    const step = steps[index];
    let cancelled = false;
    const measure = () => {
      if (cancelled) return;
      if (!step) {
        finish();
        return;
      }
      const r = readRect(step.anchor);
      if (r) {
        shownRef.current = true;
        setRect(r);
      } else {
        setIndex((i) => i + 1); // 대상 없음 — 건너뛴다
      }
    };
    queueMicrotask(measure);
    window.addEventListener("resize", measure);
    return () => {
      cancelled = true;
      window.removeEventListener("resize", measure);
    };
  }, [active, index, steps, finish]);

  // 오버레이가 떠 있는 동안 배경 스크롤 잠금
  useEffect(() => {
    if (!active) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [active]);

  if (!active || !rect) return null;

  const step = steps[index];
  if (!step) return null;

  const isLast = index === steps.length - 1;
  // 말풍선은 대상 아래에 두되, 대상이 화면 아래쪽이면 위로 붙인다
  const below = rect.top + rect.height + 180 < window.innerHeight;

  return (
    <div
      className="fixed inset-0 z-[60]"
      role="dialog"
      aria-modal="true"
      aria-label={`사용법 안내 ${index + 1}/${steps.length}`}
    >
      {/* 구멍 뚫린 배경 — 거대한 box-shadow로 대상만 남기고 어둡게 */}
      <div
        className="pointer-events-none absolute rounded-xl ring-2 ring-white/70 transition-all duration-200"
        style={{
          top: rect.top,
          left: rect.left,
          width: rect.width,
          height: rect.height,
          boxShadow: "0 0 0 9999px rgba(9, 16, 29, 0.72)",
        }}
      />

      <div
        className="absolute inset-x-4 rounded-card bg-surface p-5 shadow-card"
        style={below ? { top: rect.top + rect.height + 14 } : { bottom: window.innerHeight - rect.top + 14 }}
      >
        <p className="text-xs font-semibold text-primary">
          {index + 1} / {steps.length}
        </p>
        <h2 className="mt-1.5 text-lg font-bold text-ink">{step.title}</h2>
        <p className="mt-2 text-sm leading-relaxed text-ink">{step.body}</p>

        <div className="mt-4 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={finish}
            className="cursor-pointer rounded-lg px-2 py-2 text-sm font-medium text-dim hover:text-ink"
          >
            건너뛰기
          </button>
          <button
            type="button"
            onClick={() => (isLast ? finish() : setIndex((i) => i + 1))}
            className="cursor-pointer rounded-lg bg-cta px-5 py-2.5 text-sm font-bold text-on-cta"
          >
            {isLast ? "알겠어요" : "다음"}
          </button>
        </div>
      </div>
    </div>
  );
}
