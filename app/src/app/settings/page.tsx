import type { Metadata } from "next";
import Link from "next/link";
import { SettingsActions } from "@/components/SettingsActions";
import { ViewportDebug } from "@/components/ViewportDebug";

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

      <section className="mt-8" aria-labelledby="info-heading">
        <h2 id="info-heading" className="mb-3 text-base font-bold text-ink">
          안내
        </h2>
        <div className="space-y-3">
          <Link
            href="/settings/faq"
            className="flex items-center justify-between gap-3 rounded-card bg-card p-4 shadow-card transition-transform active:scale-[0.99]"
          >
            <span>
              <span className="block font-semibold text-ink">자주 묻는 질문</span>
              <span className="mt-0.5 block text-sm text-dim">
                혼잡도 계산 방식, 「추정」 표시, 데이터 출처
              </span>
            </span>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-4 w-4 shrink-0 text-dim">
              <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
            </svg>
          </Link>

          <Link
            href="/privacy"
            className="flex items-center justify-between rounded-card bg-card p-4 shadow-card transition-transform active:scale-[0.99]"
          >
            <span className="font-semibold text-ink">개인정보 처리방침</span>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-4 w-4 text-dim">
              <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
            </svg>
          </Link>
        </div>
      </section>

      <p className="mt-8 text-center text-xs leading-relaxed text-dim/80">
        JejuNow {process.env.NEXT_PUBLIC_APP_VERSION}
        <br />
        2026 관광데이터 활용 공모전 출품작입니다.
      </p>
      <ViewportDebug />
    </main>
  );
}
