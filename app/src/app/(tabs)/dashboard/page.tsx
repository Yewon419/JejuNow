import Link from "next/link";
import { LevelBadge } from "@/components/LevelBadge";
import { QuietNearby } from "@/components/QuietNearby";
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

      <QuietNearby spots={spots} congestion={congestion} />
    </main>
  );
}
