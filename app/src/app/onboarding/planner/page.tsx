import { OnboardingPlanner } from "@/components/OnboardingPlanner";

export default function PlannerOnboardingPage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-xl flex-col px-6 pb-12 pt-[calc(4rem+env(safe-area-inset-top,0px))]">
      <header>
        <p className="text-sm font-bold tracking-widest text-primary">계획 여행자</p>
        <h1 className="mt-3 text-3xl font-bold leading-snug text-ink">
          언제
          <br />
          떠나세요?
        </h1>
        <p className="mt-3 text-base leading-relaxed text-dim">
          날짜를 고르면 그날 시간대별로 어디가 한적할지 맞춰서 보여드려요.
        </p>
      </header>

      <OnboardingPlanner />

      <p className="mt-auto pt-8 text-center text-xs leading-relaxed text-dim/80">
        날짜는 나중에 언제든 바꿀 수 있어요.
      </p>
    </main>
  );
}
