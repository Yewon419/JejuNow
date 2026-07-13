"use client";

import { useState } from "react";

const CLAMP_THRESHOLD = 150;

/** 상세 페이지 소개 섹션 — 긴 글은 4줄 클램프 + 더보기 토글 */
export function SpotOverview({ text }: { text: string }) {
  const [expanded, setExpanded] = useState(false);
  const clampable = text.length > CLAMP_THRESHOLD;
  return (
    <section aria-labelledby="overview-heading">
      <h2 id="overview-heading" className="mb-3 text-lg font-bold text-ink">
        소개
      </h2>
      <div className="rounded-card bg-card p-4 shadow-card">
        <p
          className={`whitespace-pre-line text-sm leading-relaxed text-ink ${
            clampable && !expanded ? "line-clamp-4" : ""
          }`}
        >
          {text}
        </p>
        {clampable ? (
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            aria-expanded={expanded}
            className="mt-2 text-sm font-semibold text-primary"
          >
            {expanded ? "접기" : "더보기"}
          </button>
        ) : null}
        <p className="mt-2 text-xs text-dim/80">출처: 한국관광공사 TourAPI</p>
      </div>
    </section>
  );
}
