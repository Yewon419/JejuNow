import Link from "next/link";
import { FeatureCourseCard } from "@/components/FeatureCourseCard";
import { LevelBadge } from "@/components/LevelBadge";
import { SpotCard } from "@/components/SpotCard";
import { nowKstHourClamped, todayInHorizon } from "@/lib/constants";
import { fetchCongestion, fetchSpots, fetchWeatherMonth } from "@/lib/supabase";
import type { Congestion, Spot } from "@/lib/types";

export const dynamic = "force-dynamic";

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
  const hasImg = (x: { c: Congestion; s: Spot | undefined }): x is { c: Congestion; s: Spot } =>
    Boolean(x.s?.image_url);

  const calm = congestion
    .filter((c) => !c.is_imputed && c.level <= 2)
    .map(withSpot)
    .filter(hasImg)
    .sort((a, b) => a.c.pressure - b.c.pressure);
  const feature = calm[0];
  const calmRest = calm.slice(1, 7);

  const busy = congestion
    .filter((c) => !c.is_imputed && c.level >= 3)
    .map(withSpot)
    .filter(hasImg)
    .sort((a, b) => b.c.pressure - a.c.pressure)
    .slice(0, 2);

  return (
    <main className="space-y-7 px-5 pt-12">
      <header className="flex items-start justify-between">
        <div>
          <p className="text-sm text-dim">{date}</p>
          <h1 className="mt-0.5 text-2xl font-bold text-ink">오늘의 제주</h1>
        </div>
        {weather?.avg_temp != null ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-card px-3 py-1.5 text-sm font-medium text-ink shadow-card">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="h-4 w-4 text-lv2" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386-1.591 1.591M21 12h-2.25m-.386 6.364-1.591-1.591M12 18.75V21m-4.773-4.227-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0Z" />
            </svg>
            {weather.avg_temp.toFixed(0)}°
          </span>
        ) : null}
      </header>

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
                className="overflow-hidden rounded-card bg-card shadow-card transition-transform active:scale-[0.98]"
              >
                <div
                  className="h-24 w-full bg-cover bg-center"
                  style={{ backgroundImage: `url(${s.image_url})` }}
                  aria-hidden
                />
                <div className="p-3">
                  <p className="truncate text-sm font-bold text-ink">{s.name}</p>
                  <div className="mt-1.5">
                    <LevelBadge level={c.level} />
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      {feature ? (
        <section aria-labelledby="feature-heading">
          <h2 id="feature-heading" className="mb-3 text-base font-bold text-ink">
            지금 가장 한적한 코스
          </h2>
          <FeatureCourseCard spot={feature.s} congestion={feature.c} />
        </section>
      ) : null}

      <section aria-labelledby="calm-heading" className="pb-4">
        <div className="mb-3 flex items-baseline justify-between">
          <h2 id="calm-heading" className="text-base font-bold text-ink">
            지금 한적한 스팟
          </h2>
          <Link href="/map" className="text-sm font-semibold text-primary">
            지도로 보기
          </Link>
        </div>
        {calmRest.length > 0 ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {calmRest.map(({ c, s }) => (
              <SpotCard key={s.spot_id} spot={s} congestion={c} />
            ))}
          </div>
        ) : (
          <p className="rounded-card bg-card p-4 text-sm text-dim shadow-card">
            데이터 준비 중입니다. 잠시 후 다시 확인해 주세요.
          </p>
        )}
      </section>
    </main>
  );
}
