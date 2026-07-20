import { OnboardingGate } from "@/components/OnboardingGate";
import { TravelerTypeSelect } from "@/components/TravelerTypeSelect";

export default function OnboardingPage() {
  return (
    <OnboardingGate>
    <main className="mx-auto flex min-h-dvh max-w-xl flex-col px-6 py-12">
      <header className="pt-8">
        <p className="text-sm font-bold tracking-widest text-primary">JEJU NOW</p>
        <h1 className="mt-3 text-3xl font-bold leading-snug text-ink">
          어떤
          <br />
          여행자세요?
        </h1>
        <p className="mt-3 text-base leading-relaxed text-dim">
          여행 스타일을 고르면 지금 한적한 제주를 맞춤으로 안내할게요.
        </p>
      </header>

      <TravelerTypeSelect />

      {/* 계산 방식 설명은 설정 > 자주 묻는 질문으로 옮겼다 (첫 화면에 전문용어를 두지 않는다) */}
      <p className="pt-6 text-center text-xs text-dim/80">혼잡도는 예측값이에요</p>
    </main>
    </OnboardingGate>
  );
}
