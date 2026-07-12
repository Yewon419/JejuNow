"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState } from "react";

// 초안 톤: 큰 사진 카드 2장 (즉흥=노을해안로 노을 / 계획=광치기해변 새벽 일출).
// 사진 출처 = TourAPI(한국관광공사) — 다른 화면의 스팟 이미지와 동일 소스.
// 첫 화면이라 외부 서버 의존 없이 public/ 번들로 서빙.
const TYPES = [
  {
    id: "spontaneous",
    eyebrow: "지금 떠나 볼까요?",
    title: "즉흥 여행자",
    desc: "지금 가까운 한적한 곳부터",
    href: "/dashboard",
    image: "/onboarding/spontaneous.jpg",
    alt: "노을해안로의 노을",
  },
  {
    id: "planner",
    eyebrow: "여행을 계획 중이라면",
    title: "계획 여행자",
    desc: "날짜별 일정 혼잡도를 미리",
    href: "/schedule",
    image: "/onboarding/planner.jpg",
    alt: "광치기해변에서 본 성산일출봉 새벽",
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
        >
          <Image
            src={t.image}
            alt={t.alt}
            fill
            sizes="(max-width: 640px) 100vw, 576px"
            className="object-cover"
            priority
          />
          <span className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" aria-hidden />
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
