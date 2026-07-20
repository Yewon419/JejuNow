import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "자주 묻는 질문 — JejuNow",
};

const FAQ: { q: string; a: string }[] = [
  {
    q: "혼잡도는 어떻게 계산하나요?",
    a: "현장에서 센 실제 인원이 아니라 공개 통계를 학습해 예측한 값입니다. 네이버 데이터랩에 쌓인 관광지 검색 수요와 기상 데이터를 학습해 관광지별 수요를 예측하고, 여기에 시간대별 방문 패턴을 결합해 산출합니다.",
  },
  {
    q: "실제 상황과 다를 수 있나요?",
    a: "네. 예측값이라 행사, 날씨 급변, 단체 관광처럼 통계에 없던 일이 생기면 실제와 다를 수 있습니다. 어디로 갈지 정할 때 참고하는 용도로 봐주세요.",
  },
  {
    q: "「추정」 표시는 무슨 뜻인가요?",
    a: "원천 데이터가 없는 관광지는 같은 유형 관광지의 평균으로 채웁니다. 그렇게 채운 곳에는 「추정」을 붙여 구분합니다. 지도에서는 추정치를 감추거나 함께 볼 수 있어요.",
  },
  {
    q: "네 단계는 각각 어느 정도인가요?",
    a: "여유, 보통, 붐빔, 혼잡 순서로 진해집니다. 절대 인원 기준이 아니라 그 관광지의 평소 대비 상대적인 수준입니다.",
  },
  {
    q: "대안은 어떤 기준으로 추천하나요?",
    a: "같은 성격의 관광지 중에서 그 시간대에 덜 붐빌 곳을 고릅니다. 해수욕장에는 해수욕장을, 오름에는 오름을 추천합니다. 가까운 곳을 먼저 보여주기 때문에 동선이 크게 틀어지지 않습니다.",
  },
  {
    q: "내 위치는 어떻게 쓰이나요?",
    a: "주변의 한적한 곳을 추천할 때만 사용하며, 기기 안에서만 쓰고 서버로 보내지 않습니다. 위치 권한을 허용하지 않아도 모든 기능을 쓸 수 있고, 이때는 계획해 둔 일정을 기준으로 추천합니다.",
  },
  {
    q: "만든 일정은 어디에 저장되나요?",
    a: "기기 안에만 저장됩니다. 회원가입이 없어서 서버에 올라가지 않고, 앱을 지우면 함께 사라집니다.",
  },
  {
    q: "데이터 출처가 어디인가요?",
    a: "관광지 정보는 한국관광공사 TourAPI, 수요 데이터는 네이버 데이터랩, 기상 데이터는 기상청, 지도와 길찾기는 카카오를 이용합니다.",
  },
  {
    q: "길찾기가 안 될 때가 있어요",
    a: "관광지 좌표가 도로에서 멀면 자동차 경로를 찾지 못할 수 있습니다. 이때는 카카오맵으로 바로 열 수 있는 링크를 대신 보여줍니다.",
  },
];

export default function FaqPage() {
  return (
    <main className="mx-auto min-h-dvh max-w-xl px-5 pb-16 pt-[calc(3rem+env(safe-area-inset-top,0px))]">
      <header className="flex items-center gap-3">
        <Link
          href="/settings"
          aria-label="뒤로"
          className="-ml-2 rounded-full p-2 text-dim transition-colors hover:text-ink"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-5 w-5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
          </svg>
        </Link>
        <h1 className="text-2xl font-bold text-ink">자주 묻는 질문</h1>
      </header>

      <div className="mt-6 space-y-2">
        {FAQ.map((item) => (
          <details key={item.q} className="group rounded-card bg-card shadow-card">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-4 font-semibold text-ink [&::-webkit-details-marker]:hidden">
              {item.q}
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                className="h-4 w-4 shrink-0 text-dim transition-transform group-open:rotate-180"
                aria-hidden
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
              </svg>
            </summary>
            <p className="px-4 pb-4 text-sm leading-relaxed text-dim">{item.a}</p>
          </details>
        ))}
      </div>
    </main>
  );
}
