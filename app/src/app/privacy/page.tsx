import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "개인정보 처리방침 — JejuNow",
  description: "JejuNow가 처리하는 정보와 처리 방식을 안내합니다.",
};

const UPDATED = "2026년 7월 20일";

export default function PrivacyPage() {
  return (
    <main className="min-h-dvh bg-bg px-5 py-8">
      <Link href="/dashboard" className="text-sm text-primary">
        ← JejuNow
      </Link>

      <h1 className="mt-4 text-2xl font-bold text-ink">개인정보 처리방침</h1>
      <p className="mt-1 text-sm text-dim">최종 수정일: {UPDATED}</p>

      <section className="mt-7">
        <h2 className="text-base font-semibold text-ink">1. 수집하지 않는 정보</h2>
        <p className="mt-2 text-sm leading-relaxed text-ink">
          JejuNow는 회원가입이나 로그인이 없습니다. 이름, 이메일, 전화번호, 생년월일 등
          이용자를 식별할 수 있는 정보를 일절 수집하지 않으며, 광고 식별자나 추적 도구도
          사용하지 않습니다.
        </p>
      </section>

      <section className="mt-7">
        <h2 className="text-base font-semibold text-ink">2. 위치 정보</h2>
        <p className="mt-2 text-sm leading-relaxed text-ink">
          현재 위치 주변의 한적한 관광지를 추천하기 위해 기기의 위치 정보를 사용할 수
          있습니다. 이 정보는 <strong>기기 안에서만 사용되며 서버로 전송되거나 저장되지
          않습니다.</strong> 위치 권한을 허용하지 않아도 앱의 모든 기능을 이용할 수
          있으며, 이 경우 계획해 둔 일정을 기준으로 추천이 이루어집니다. 위치 권한은 기기의
          설정에서 언제든지 변경할 수 있습니다.
        </p>
      </section>

      <section className="mt-7">
        <h2 className="text-base font-semibold text-ink">3. 기기에 저장되는 정보</h2>
        <p className="mt-2 text-sm leading-relaxed text-ink">
          이용자가 만든 여행 일정과 선택한 여행 유형은 기기의 저장 공간에만 보관됩니다.
          서버로 전송되지 않으며, 앱을 삭제하거나 브라우저 저장 데이터를 지우면 함께
          삭제됩니다.
        </p>
      </section>

      <section className="mt-7">
        <h2 className="text-base font-semibold text-ink">4. 외부 서비스</h2>
        <p className="mt-2 text-sm leading-relaxed text-ink">
          지도 표시와 길찾기를 위해 카카오 지도 서비스를, 관광지 정보와 혼잡도 예측
          데이터를 받기 위해 자체 서버를 이용합니다. 길찾기 요청에는 출발지와 도착지로
          선택된 <strong>관광지의 좌표만</strong> 전달되며 이용자의 현재 위치는 포함되지
          않습니다. 관광지 정보는 한국관광공사 TourAPI, 혼잡도 예측은 네이버 데이터랩의
          공개 통계를 기반으로 합니다.
        </p>
      </section>

      <section className="mt-7">
        <h2 className="text-base font-semibold text-ink">5. 아동의 개인정보</h2>
        <p className="mt-2 text-sm leading-relaxed text-ink">
          JejuNow는 개인정보를 수집하지 않으므로 아동으로부터 수집되는 정보 또한
          없습니다.
        </p>
      </section>

      <section className="mt-7">
        <h2 className="text-base font-semibold text-ink">6. 방침 변경</h2>
        <p className="mt-2 text-sm leading-relaxed text-ink">
          이 방침이 변경되면 변경된 내용을 이 페이지에 게시하고 최종 수정일을
          갱신합니다.
        </p>
      </section>

      <section className="mt-7 border-t border-line pt-6">
        <h2 className="text-base font-semibold text-ink">문의</h2>
        <p className="mt-2 text-sm leading-relaxed text-ink">
          개인정보 처리에 관한 문의는{" "}
          <a href="mailto:windgarden05@gmail.com" className="text-primary underline">
            windgarden05@gmail.com
          </a>
          으로 보내주시기 바랍니다.
        </p>
      </section>

      <p className="mt-10 pb-4 text-xs text-dim">
        JejuNow는 2026 관광데이터 활용 공모전 출품작입니다. 혼잡도는 공개 통계를 기반으로 한
        예측값이며 실제 현장 상황과 다를 수 있습니다.
      </p>
    </main>
  );
}
