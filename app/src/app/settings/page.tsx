import type { Metadata } from "next";
import Link from "next/link";
import { SettingsActions } from "@/components/SettingsActions";

export const metadata: Metadata = {
  title: "설정 — JejuNow",
};

export default function SettingsPage() {
  return (
    <main className="mx-auto min-h-dvh max-w-xl px-5 pb-16 pt-[calc(3rem+env(safe-area-inset-top,0px))]">
      <header className="flex items-center gap-3">
        <Link
          href="/dashboard"
          aria-label="뒤로"
          className="-ml-2 rounded-full p-2 text-dim transition-colors hover:text-ink"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-5 w-5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
          </svg>
        </Link>
        <h1 className="text-2xl font-bold text-ink">설정</h1>
      </header>

      <div className="mt-7">
        <SettingsActions />
      </div>

      <section className="mt-8" aria-labelledby="about-heading">
        <h2 id="about-heading" className="mb-3 text-base font-bold text-ink">
          데이터와 안내
        </h2>
        <div className="space-y-3">
          <div className="rounded-card bg-card p-4 shadow-card">
            <p className="font-semibold text-ink">혼잡도는 예측값입니다</p>
            <p className="mt-1 text-sm leading-relaxed text-dim">
              현장에서 센 실제 인원이 아니라 공개 통계를 학습해 예측한 값입니다. 네이버 데이터랩의
              관광지 검색 수요와 기상 데이터를 학습해 관광지별 수요를 예측하고, 여기에 시간대별
              방문 패턴을 결합해 산출합니다. 실제 상황과 다를 수 있어요.
            </p>
          </div>

          <div className="rounded-card bg-card p-4 shadow-card">
            <p className="font-semibold text-ink">일부는 평균값으로 대체합니다</p>
            <p className="mt-1 text-sm leading-relaxed text-dim">
              원천 데이터가 없는 관광지는 같은 유형의 평균으로 채우고, 그런 경우 「추정」으로
              따로 표시합니다.
            </p>
          </div>

          <div className="rounded-card bg-card p-4 shadow-card">
            <p className="font-semibold text-ink">출처</p>
            <p className="mt-1 text-sm leading-relaxed text-dim">
              관광지 정보는 한국관광공사 TourAPI, 수요 데이터는 네이버 데이터랩, 기상 데이터는
              기상청, 지도와 길찾기는 카카오를 이용합니다.
            </p>
          </div>
        </div>
      </section>

      <section className="mt-8" aria-labelledby="policy-heading">
        <h2 id="policy-heading" className="mb-3 text-base font-bold text-ink">
          약관 및 정책
        </h2>
        <Link
          href="/privacy"
          className="flex items-center justify-between rounded-card bg-card p-4 shadow-card transition-transform active:scale-[0.99]"
        >
          <span className="font-semibold text-ink">개인정보 처리방침</span>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-4 w-4 text-dim">
            <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
          </svg>
        </Link>
      </section>

      <p className="mt-8 text-center text-xs leading-relaxed text-dim/80">
        JejuNow {process.env.NEXT_PUBLIC_APP_VERSION}
        <br />
        2026 관광데이터 활용 공모전 출품작입니다.
      </p>
    </main>
  );
}
