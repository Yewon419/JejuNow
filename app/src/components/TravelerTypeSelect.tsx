"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

// 초안 톤: 큰 사진 카드 2장(즉흥=노을 / 계획=밤하늘). 실사진 부재로 그라데이션으로 분위기 표현.
const TYPES = [
  {
    id: "spontaneous",
    eyebrow: "지금 떠나 볼까요?",
    title: "즉흥 여행자",
    desc: "지금 가까운 한적한 곳부터",
    href: "/dashboard",
    gradient: "linear-gradient(135deg, #f59e0b 0%, #ef4444 55%, #7c2d12 100%)",
  },
  {
    id: "planner",
    eyebrow: "여행을 계획 중이라면",
    title: "계획 여행자",
    desc: "날짜별 일정 혼잡도를 미리",
    href: "/schedule",
    gradient: "linear-gradient(135deg, #1e3a8a 0%, #0f172a 70%, #020617 100%)",
  },
] as const;

export function TravelerTypeSelect() {
  const router = useRouter();
  const [pending, setPending] = useState<string | null>(null);

  function choose(id: string, href: string) {
    setPending(id);
    try {
      localStorage.setItem("jejunow:travelerType", id);
    } catch {
      // 프라이빗 모드 등 저장 불가 시에도 진행
    }
    router.push(href);
  }

  return (
    <section className="my-8 flex-1 space-y-4" aria-label="여행자 타입 선택">
      {TYPES.map((t) => (
        <button
          key={t.id}
          type="button"
          onClick={() => choose(t.id, t.href)}
          aria-busy={pending === t.id}
          className="relative block h-44 w-full cursor-pointer overflow-hidden rounded-card text-left shadow-card transition-transform active:scale-[0.98]"
          style={{ background: t.gradient }}
        >
          <span className="absolute inset-0 bg-gradient-to-t from-black/45 to-transparent" aria-hidden />
          <span className="absolute inset-x-0 bottom-0 p-5">
            <span className="block text-xs font-medium text-white/80">{t.eyebrow}</span>
            <span className="mt-1 flex items-center gap-2 text-2xl font-bold text-white">
              {t.title}
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} className="h-5 w-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
              </svg>
            </span>
            <span className="mt-1 block text-sm text-white/85">{t.desc}</span>
          </span>
        </button>
      ))}
    </section>
  );
}
