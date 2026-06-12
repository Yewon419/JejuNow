import Link from "next/link";
import { LevelBadge } from "@/components/LevelBadge";
import { SpotCard } from "@/components/SpotCard";
import { clampHour, todayInHorizon } from "@/lib/constants";
import { fetchCongestion, fetchSpots, fetchWeatherMonth } from "@/lib/supabase";
import type { Congestion, Spot } from "@/lib/types";

export const dynamic = "force-dynamic";

function nowKstHour(): number {
  return new Date(Date.now() + 9 * 3600 * 1000).getUTCHours();
}

export default async function DashboardPage() {
  const date = todayInHorizon();
  const hour = clampHour(nowKstHour());
  const [spots, congestion, weather] = await Promise.all([
    fetchSpots(),
    fetchCongestion(date, hour),
    fetchWeatherMonth(`${date.slice(0, 7)}-01`),
  ]);
  const spotById = new Map<number, Spot>(spots.map((s) => [s.spot_id, s]));

  const calm = congestion
    .filter((c) => !c.is_imputed && c.level <= 2)
    .map((c) => ({ c, s: spotById.get(c.spot_id) }))
    .filter((x): x is { c: Congestion; s: Spot } => Boolean(x.s?.image_url))
    .sort((a, b) => a.c.pressure - b.c.pressure)
    .slice(0, 6);

  const busy = congestion
    .filter((c) => !c.is_imputed && c.level >= 3)
    .map((c) => ({ c, s: spotById.get(c.spot_id) }))
    .filter((x): x is { c: Congestion; s: Spot } => Boolean(x.s))
    .sort((a, b) => b.c.pressure - a.c.pressure)
    .slice(0, 4);

  return (
    <main className="space-y-8 px-5 pt-10">
      <header>
        <p className="text-sm text-dim">
          {date} · {hour}시 기준
        </p>
        <h1 className="mt-1 text-2xl font-bold text-ink">오늘의 제주</h1>
        {weather?.avg_temp != null ? (
          <p className="mt-2 inline-flex items-center gap-2 rounded-full border border-line bg-card px-3 py-1.5 text-sm text-dim">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="h-4 w-4 text-primary" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386-1.591 1.591M21 12h-2.25m-.386 6.364-1.591-1.591M12 18.75V21m-4.773-4.227-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0Z" />
            </svg>
            {date.slice(5, 7)}월 평균 {weather.avg_temp.toFixed(1)}°C · 강수{" "}
            {weather.precip_mm != null ? `${Math.round(weather.precip_mm)}mm` : "-"}
          </p>
        ) : null}
      </header>

      <section aria-labelledby="calm-heading">
        <div className="mb-3 flex items-baseline justify-between">
          <h2 id="calm-heading" className="text-lg font-bold text-ink">
            지금 한적한 스팟
          </h2>
          <Link href="/map" className="text-sm font-medium text-primary">
            지도로 보기
          </Link>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {calm.map(({ c, s }) => (
            <SpotCard key={s.spot_id} spot={s} congestion={c} />
          ))}
        </div>
        {calm.length === 0 ? (
          <p className="rounded-card border border-line bg-card p-4 text-sm text-dim">
            데이터 준비 중입니다. 잠시 후 다시 확인해 주세요.
          </p>
        ) : null}
      </section>

      <section aria-labelledby="busy-heading" className="pb-4">
        <h2 id="busy-heading" className="mb-3 text-lg font-bold text-ink">
          지금 붐비는 곳은 피하세요
        </h2>
        <ul className="divide-y divide-line overflow-hidden rounded-card border border-line bg-card">
          {busy.map(({ c, s }) => (
            <li key={s.spot_id}>
              <Link
                href={`/spots/${s.spot_id}`}
                className="flex items-center justify-between gap-3 p-4 transition-colors hover:bg-surface"
              >
                <div className="min-w-0">
                  <p className="truncate font-semibold text-ink">{s.name}</p>
                  <p className="text-xs text-dim">{s.region}</p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <LevelBadge level={c.level} />
                  <span className="text-xs font-medium text-primary">대안 보기</span>
                </div>
              </Link>
            </li>
          ))}
          {busy.length === 0 ? (
            <li className="p-4 text-sm text-dim">지금은 크게 붐비는 곳이 없어요.</li>
          ) : null}
        </ul>
      </section>
    </main>
  );
}
