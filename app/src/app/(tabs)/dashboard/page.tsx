import Image from "next/image";
import Link from "next/link";
import { CoachMark } from "@/components/CoachMark";
import { LevelBadge } from "@/components/LevelBadge";
import { MyPlanCard } from "@/components/MyPlanCard";
import { QuietNearby } from "@/components/QuietNearby";
import { DASHBOARD_COACH } from "@/lib/coach";
import { formatKstDate, kstGreeting, nowKstHourClamped, todayInHorizon } from "@/lib/constants";
import { fetchCongestion, fetchSpots, fetchWeatherMonth } from "@/lib/supabase";
import type { Congestion, Spot } from "@/lib/types";

// force-dynamic은 fetch마다 걸어둔 revalidate를 전부 no-store로 덮어써(문서상 동일) 캐시가 없었다.
// ISR로 전환: 렌더된 HTML을 5분간 CDN에서 그대로 내보내 콜드 스타트를 건너뛴다.
// 시각 의존값(오늘 날짜·현재 시)은 5분마다 재평가되고, 시가 바뀌면 fetch 키가 달라져 새로 조회된다.
export const revalidate = 300;

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

  return (
    <main className="space-y-7 px-5 pt-[calc(3rem+env(safe-area-inset-top,0px))]">
      {/* 서버 컴포넌트에서 클라이언트 컴포넌트를 그대로 렌더 — 별도 래퍼 불필요 */}
      <CoachMark id="dashboard" steps={DASHBOARD_COACH} />
      <header className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-primary">{kstGreeting()}</p>
          <h1 className="mt-0.5 text-2xl font-bold text-ink">오늘의 제주</h1>
          <p className="mt-1 text-sm text-dim">{formatKstDate(date)}</p>
        </div>
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
      </header>

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
                  <LevelBadge level={c.level} />
                </div>
                <p className="absolute inset-x-0 bottom-0 truncate p-3 text-sm font-bold text-white [text-shadow:0_1px_8px_rgba(0,0,0,0.5)]">
                  {s.name}
                </p>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      <QuietNearby spots={spots} congestion={congestion} />
    </main>
  );
}
