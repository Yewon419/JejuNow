"use client";

import { useState } from "react";
import { tapLight } from "@/lib/haptics";

// 흰 카드에 글 뭉치를 담던 이전 형태가 "없어 보인다"는 피드백 → 매거진 문법으로 전환
// (스테이폴리오·여행 에디토리얼 공통: 세리프 리드문 + 플랫 본문 + 넉넉한 행간 + 페이드 접힘)

/** 첫 문장을 리드문으로 분리 — 한국어 평서문 경계(다./요.) 우선, 20~160자 범위만 */
function splitLead(text: string): [string, string] {
  const normalized = text.trim();
  const m = normalized.match(/^[\s\S]{20,160}?(?:다\.|요\.)(?=\s)/);
  if (m) return [m[0].trim(), normalized.slice(m[0].length).trim()];
  const dot = normalized.indexOf(". ");
  if (dot > 20 && dot < 160) {
    return [normalized.slice(0, dot + 1), normalized.slice(dot + 1).trim()];
  }
  return [normalized, ""];
}

export function SpotOverview({ text }: { text: string }) {
  const [expanded, setExpanded] = useState(false);
  const [lead, rest] = splitLead(text);
  const paragraphs = rest.split(/\n+/).filter((p) => p.trim().length > 0);
  const collapsible = rest.length > 120;
  const collapsed = collapsible && !expanded;

  return (
    <section aria-labelledby="overview-heading">
      <h2 id="overview-heading" className="mb-4 text-lg font-bold text-ink">
        소개
      </h2>
      {/* 리드문 — 세리프로 크게, 매거진 풀 쿼트 문법 */}
      <p className="font-serif text-xl font-semibold leading-relaxed text-ink lg:text-[1.375rem]">
        {lead}
      </p>
      {paragraphs.length > 0 ? (
        <>
          <div className="relative mt-4">
            <div className={collapsed ? "max-h-44 overflow-hidden" : ""}>
              {paragraphs.map((para) => (
                <p
                  key={para.slice(0, 24)}
                  className="mt-3 text-[15px] leading-8 text-ink/75 first:mt-0"
                >
                  {para}
                </p>
              ))}
            </div>
            {collapsed ? (
              <div
                className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-bg to-transparent"
                aria-hidden
              />
            ) : null}
          </div>
          {collapsible ? (
            <button
              type="button"
              onClick={() => {
                tapLight();
                setExpanded((v) => !v);
              }}
              aria-expanded={expanded}
              className="mt-3 cursor-pointer text-sm font-semibold text-primary underline underline-offset-4"
            >
              {expanded ? "접기" : "계속 읽기"}
            </button>
          ) : null}
        </>
      ) : null}
      {/* 출처 표기는 설정 > 자주 묻는 질문으로 모았다 */}
    </section>
  );
}
