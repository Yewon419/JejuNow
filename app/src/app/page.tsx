import { TravelerTypeSelect } from "@/components/TravelerTypeSelect";

export default function OnboardingPage() {
  return (
    <main className="relative mx-auto flex min-h-dvh max-w-xl flex-col justify-between overflow-hidden px-6 py-12">
      <div
        aria-hidden
        className="pointer-events-none absolute -top-32 right-[-20%] h-96 w-96 rounded-full bg-primary/15 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute bottom-[-10%] left-[-25%] h-96 w-96 rounded-full bg-lv1/10 blur-3xl"
      />

      <header className="relative pt-10">
        <p className="text-sm font-medium tracking-widest text-primary">JEJU NOW</p>
        <h1 className="mt-4 text-4xl font-bold leading-snug text-ink">
          지금, 한적한
          <br />
          제주를 찾아서
        </h1>
        <p className="mt-4 max-w-sm text-base leading-relaxed text-dim">
          관광 수요 데이터로 혼잡을 예측하고, 같은 매력의 한적한 대안 코스를 추천합니다.
        </p>
      </header>

      <TravelerTypeSelect />

      <p className="relative pt-8 text-center text-xs leading-relaxed text-dim/70">
        혼잡도는 한국관광 데이터랩 인기 점유율(수요 프록시) 예측 × 일중 프로파일 합성값으로,
        실측 혼잡도가 아닙니다.
      </p>
    </main>
  );
}
