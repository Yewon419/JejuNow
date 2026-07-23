import Image from "next/image";
import Link from "next/link";
import { CoachMark } from "@/components/CoachMark";
import { LevelBadge } from "@/components/LevelBadge";
import { MyPlanCard } from "@/components/MyPlanCard";
import { QuietNearby } from "@/components/QuietNearby";
import { DASHBOARD_COACH } from "@/lib/coach";
import {
  type DayPart,
  formatKstDate,
  kstDayPart,
  kstGreeting,
  nowKstHourClamped,
  spotDisplayName,
  todayInHorizon,
} from "@/lib/constants";
import { fetchCongestion, fetchSpots, fetchWeatherMonth } from "@/lib/supabase";
import type { Congestion, Spot } from "@/lib/types";

// force-dynamic은 fetch마다 걸어둔 revalidate를 전부 no-store로 덮어써(문서상 동일) 캐시가 없었다.
// ISR로 전환: 렌더된 HTML을 5분간 CDN에서 그대로 내보내 콜드 스타트를 건너뛴다.
// 시각 의존값(오늘 날짜·현재 시)은 5분마다 재평가되고, 시가 바뀌면 fetch 키가 달라져 새로 조회된다.
export const revalidate = 300;

// 시간대별 헤더 그라데이션 — 블루 계열만(혼잡도 4색과 충돌 금지). Tailwind JIT가
// 클래스를 생성하려면 문자열 리터럴이 소스에 있어야 해서 맵으로 나열한다.
const HERO_GRADIENT: Record<DayPart, string> = {
  dawn: "bg-gradient-to-b from-[#e4e8f7] via-[#eef1f9] to-bg",
  morning: "bg-gradient-to-b from-[#d9edfb] via-[#e9f5fd] to-bg",
  afternoon: "bg-gradient-to-b from-[#d6effa] via-[#e8f6fc] to-bg",
  evening: "bg-gradient-to-b from-[#e6e8fa] via-[#eff0fb] to-bg",
  night: "bg-gradient-to-b from-[#dfe3f2] via-[#eceff7] to-bg",
};

// 인사말 옆 글리프 — 낮엔 해, 밤·새벽엔 달 (heroicons)
const SUN_PATH =
  "M12 3v2.25m6.364.386-1.591 1.591M21 12h-2.25m-.386 6.364-1.591-1.591M12 18.75V21m-4.773-4.227-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0Z";
const MOON_PATH =
  "M21.752 15.002A9.72 9.72 0 0 1 18 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 0 0 3 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 0 0 9.002-5.998Z";

export default async function DashboardPage() {
  const date = todayInHorizon();
  const hour = nowKstHourClamped();
  const [spots, congestion, weather] = await Promise.all([
    fetchSpots(),
    fetchCongestion(date, hour),
    fetchWeatherMonth(`${date.slice(0, 7)}-01`),
  ]);
  const spotById = new Map<number, Spot>(spots.map((s) => [s.spot_id, s]));

  const withSpot = (c: Congestion) => ({ c, s: spotById.get(c.spot_id) });
  const hasImg = (x: {
    c: Congestion;
    s: Spot | undefined;
  }): x is { c: Congestion; s: Spot & { image_url: string } } => Boolean(x.s?.image_url);

  const busy = congestion
    .filter((c) => !c.is_imputed && c.level >= 3)
    .map(withSpot)
    .filter(hasImg)
    .sort((a, b) => b.c.pressure - a.c.pressure)
    .slice(0, 2);

  const dayPart = kstDayPart();
  const glyphPath = dayPart === "night" || dayPart === "dawn" ? MOON_PATH : SUN_PATH;

  return (
    <main className="px-5">
      {/* 서버 컴포넌트에서 클라이언트 컴포넌트를 그대로 렌더 — 별도 래퍼 불필요 */}
      <CoachMark id="dashboard" steps={DASHBOARD_COACH} />
      {/* 시간대 그라데이션 히어로 밴드 — 상태바 영역까지 차오르고 bg로 자연스럽게 사라진다 */}
      <div
        className={`relative -mx-5 overflow-hidden px-5 pb-4 pt-[calc(3rem+env(safe-area-inset-top,0px))] ${HERO_GRADIENT[dayPart]}`}
      >
      <header className="relative">
        {/* 브랜드 행: 좌측 로고 락업, 우측 날씨·설정 */}
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Image
              src="/icon.svg"
              alt=""
              width={28}
              height={28}
              unoptimized
              className="rounded-lg"
            />
            <span className="text-lg font-extrabold tracking-tight text-ink">JejuNow</span>
          </span>
          <div className="flex items-center gap-2">
        {weather?.avg_temp != null ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-card px-3 py-1.5 text-sm font-medium text-ink shadow-card">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="h-4 w-4 text-lv2" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386-1.591 1.591M21 12h-2.25m-.386 6.364-1.591-1.591M12 18.75V21m-4.773-4.227-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0Z" />
            </svg>
            {weather.avg_temp.toFixed(0)}°
          </span>
        ) : null}
          <Link
            href="/settings"
            aria-label="설정"
            className="rounded-full bg-card p-2 text-dim shadow-card transition-colors hover:text-ink"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} className="h-5 w-5">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.03 7.03 0 0 1 0 .255c-.008.378.137.75.43.991l1.004.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.241.437-.613.43-.992a6.932 6.932 0 0 1 0-.255c.007-.378-.138-.75-.43-.991l-1.004-.828a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28Z"
              />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
            </svg>
          </Link>
          </div>
        </div>

        {/* 인사·제목·날짜 */}
        <p className="mt-5 flex items-center gap-1.5 text-sm font-medium text-primary">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-4 w-4" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" d={glyphPath} />
          </svg>
          {kstGreeting()}
        </p>
        <h1 className="mt-1 text-3xl font-bold tracking-tight text-ink">오늘의 제주</h1>
        <p className="mt-1.5 text-sm text-dim">{formatKstDate(date)}</p>
      </header>
      </div>

      {/* 아이패드 가로(lg+)는 2단: 좌=내 여행·붐빔, 우=추천·캐러셀 (세로·폰은 1단 그대로).
          ⚠ min-w-0 필수: WebKit은 그리드 자식 안의 가로 스크롤러(캐러셀) 콘텐츠 폭을
          트랙 최소폭으로 잡아 프레임 밖으로 밀어낸다 (실기기 재현, Chromium은 무증상) */}
      <div className="mt-7 grid grid-cols-1 gap-7 pb-2 lg:grid-cols-2 lg:items-start lg:gap-8">
      <div className="min-w-0 space-y-7">
      {/* 담아둔 일정이 있으면 최상단에 — 없으면 스스로 아무것도 그리지 않는다 */}
      <MyPlanCard spots={spots} congestion={congestion} />

      {busy.length > 0 ? (
        <section aria-labelledby="busy-heading">
          <h2 id="busy-heading" className="mb-3 text-base font-bold text-ink">
            지금 붐비는 곳, 피하세요
          </h2>
          <div className="grid grid-cols-2 gap-3">
            {busy.map(({ c, s }) => (
              <Link
                key={s.spot_id}
                href={`/spots/${s.spot_id}`}
                className="relative block h-36 overflow-hidden rounded-card shadow-card transition-transform active:scale-[0.98]"
              >
                {/* CSS 배경이 아니라 next/image — 배경으로 쓰면 원본을 그대로 받는다 */}
                <Image
                  src={s.image_url}
                  alt=""
                  fill
                  sizes="(max-width: 640px) 50vw, 288px"
                  className="object-cover photo-warm"
                  unoptimized={s.image_url.endsWith(".bmp")}
                />
                <div
                  className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/25 to-black/5"
                  aria-hidden
                />
                <div className="absolute left-2.5 top-2.5">
                  <LevelBadge level={c.level} onPhoto />
                </div>
                <p className="absolute inset-x-0 bottom-0 truncate p-3 text-sm font-bold text-white [text-shadow:0_1px_8px_rgba(0,0,0,0.5)]">
                  {spotDisplayName(s.name)}
                </p>
              </Link>
            ))}
          </div>
        </section>
      ) : null}
      </div>

      <div className="min-w-0 space-y-7">
        <QuietNearby spots={spots} congestion={congestion} />
      </div>
      </div>
    </main>
  );
}
