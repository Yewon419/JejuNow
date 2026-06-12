"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

const TYPES = [
  {
    id: "spontaneous",
    title: "즉흥 여행자",
    desc: "지금 가까운 한적한 곳부터 보여주세요",
  },
  {
    id: "planner",
    title: "계획 여행자",
    desc: "날짜별 일정의 혼잡도를 미리 점검할래요",
  },
] as const;

export function TravelerTypeSelect() {
  const router = useRouter();
  const [selected, setSelected] = useState<string>("spontaneous");

  function start() {
    try {
      localStorage.setItem("jejunow:travelerType", selected);
    } catch {
      // 프라이빗 모드 등 저장 불가 시에도 진행
    }
    router.push(selected === "planner" ? "/schedule" : "/dashboard");
  }

  return (
    <section className="relative space-y-3" aria-label="여행자 타입 선택">
      {TYPES.map((t) => {
        const active = selected === t.id;
        return (
          <button
            key={t.id}
            type="button"
            onClick={() => setSelected(t.id)}
            aria-pressed={active}
            className={`w-full cursor-pointer rounded-card border p-4 text-left transition-all duration-200 ${
              active
                ? "border-primary bg-primary/10"
                : "border-line bg-card hover:border-dim"
            }`}
          >
            <span className="flex items-center justify-between">
              <span>
                <span className="block text-base font-semibold text-ink">{t.title}</span>
                <span className="mt-1 block text-sm text-dim">{t.desc}</span>
              </span>
              <span
                aria-hidden
                className={`ml-3 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${
                  active ? "border-primary" : "border-line"
                }`}
              >
                {active ? <span className="h-2.5 w-2.5 rounded-full bg-primary" /> : null}
              </span>
            </span>
          </button>
        );
      })}
      <button
        type="button"
        onClick={start}
        className="mt-2 w-full cursor-pointer rounded-card bg-primary py-4 text-base font-bold text-deep transition-transform active:scale-[0.98]"
      >
        시작하기
      </button>
    </section>
  );
}
