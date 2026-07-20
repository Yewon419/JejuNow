import { OnboardingSpontaneous } from "@/components/OnboardingSpontaneous";

export default function SpontaneousOnboardingPage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-xl flex-col px-6 pb-12 pt-[calc(4rem+env(safe-area-inset-top,0px))]">
      <header>
        <p className="text-sm font-bold tracking-widest text-primary">즉흥 여행자</p>
        <h1 className="mt-3 text-3xl font-bold leading-snug text-ink">
          지금 계신 곳
          <br />
          근처부터 볼까요?
        </h1>
        <p className="mt-3 text-base leading-relaxed text-dim">
          위치를 알려주시면 가까우면서 한적한 곳을 먼저 보여드려요.
        </p>
      </header>

      <OnboardingSpontaneous />

      <p className="mt-auto pt-8 text-center text-xs leading-relaxed text-dim/80">
        위치는 추천에만 쓰고 기기 밖으로 보내지 않아요.
        <br />
        허용하지 않아도 모든 기능을 쓸 수 있어요.
      </p>
    </main>
  );
}
