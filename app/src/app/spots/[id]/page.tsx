import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CoachMark } from "@/components/CoachMark";
import { LevelBadge } from "@/components/LevelBadge";
import { SpotOverview } from "@/components/SpotOverview";
import { findAlternatives } from "@/lib/alternatives";
import { SPOT_COACH } from "@/lib/coach";
import { LEVEL_COLOR, catLabel, cleanHours, todayInHorizon } from "@/lib/constants";
import { fetchCongestion, fetchSpotById, fetchSpotDay, fetchSpots } from "@/lib/supabase";
import type { Congestion, Spot } from "@/lib/types";

// ISR — 사유는 dashboard/page.tsx 주석 참조
export const revalidate = 300;

// 빈 배열 = 빌드 때는 아무것도 미리 만들지 않되, 라우트를 정적+폴백으로 등록한다.
// 이게 없으면 라우트가 완전 동적으로 취급되어 revalidate가 캐시를 만들지 않는다(실측: 계속 MISS).
// 스팟 801개를 전부 프리렌더하면 빌드가 과도하게 길어져 on-demand 생성 후 캐시를 택했다.
export function generateStaticParams(): { id: string }[] {
  return [];
}

/** tel: 링크용 — 숫자·+·- 만 남긴다. 대표번호 외 부가 텍스트가 섞인 값이면 링크 생략 */
function telHref(tel: string): string | undefined {
  const digits = tel.replace(/[^0-9+-]/g, "");
  return /^[+]?[0-9][0-9-]{7,}$/.test(digits) ? `tel:${digits}` : undefined;
}

export default async function SpotDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const spotId = Number(id);
  if (!Number.isInteger(spotId)) notFound();

  const date = todayInHorizon();
  const spot = await fetchSpotById(spotId);
  if (!spot) notFound();

  const [day, allSpots] = await Promise.all([fetchSpotDay(spotId, date), fetchSpots()]);
  const peak = day.reduce<(Congestion & { hour: number }) | null>(
    (acc, cur) => (acc === null || cur.pressure > acc.pressure ? cur : acc),
    null,
  );
  const calmHour = day.reduce<(Congestion & { hour: number }) | null>(
    (acc, cur) => (acc === null || cur.pressure < acc.pressure ? cur : acc),
    null,
  );
  const refHour = peak?.hour ?? 13;
  const congestionAtRef = new Map<number, Congestion>(
    (await fetchCongestion(date, refHour)).map((c) => [c.spot_id, c]),
  );
  const alternatives = findAlternatives(spot as Spot, allSpots, congestionAtRef, 4);
  const maxPressure = Math.max(1, ...day.map((d) => d.pressure));

  return (
    <main className="mx-auto min-h-dvh max-w-xl pb-12">
      <CoachMark id="spot" steps={SPOT_COACH} />
      <div
        className={`relative h-80 w-full ${
          spot.image_url ? "bg-line" : "bg-gradient-to-br from-primary to-cta"
        }`}
      >
        {spot.image_url ? (
          <Image
            src={spot.image_url}
            alt=""
            fill
            sizes="(max-width: 640px) 100vw, 576px"
            className="object-cover photo-warm"
            priority
            unoptimized={spot.image_url.endsWith(".bmp")}
          />
        ) : null}
        {/* 흰 글씨 가독성 스크림 — 위(뒤로 버튼)·아래(제목) 양끝을 어둡게 */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/45 via-black/5 to-black/75" />
        <Link
          href="/dashboard"
          aria-label="뒤로"
          className="absolute left-4 top-[calc(3rem+env(safe-area-inset-top,0px))] rounded-full bg-black/35 p-2 text-white backdrop-blur transition-colors hover:bg-black/50"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-5 w-5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
          </svg>
        </Link>
        <header className="absolute inset-x-0 bottom-0 px-5 pb-12">
          <p className="text-xs font-semibold tracking-wide text-white/85">
            {spot.region} · {catLabel(spot.cat2)}
            {spot.is_outdoor === true ? " · 야외" : spot.is_outdoor === false ? " · 실내" : ""}
          </p>
          {/* 히어로엔 이름·지역·주소만 — 운영시간·전화 같은 긴 정보는 사진 밖 카드로 내렸다
              (긴 운영시간이 사진을 덮어 사진도 글도 안 살던 문제) */}
          <h1 className="mt-1 text-[2rem] font-bold leading-tight text-white [text-shadow:0_1px_12px_rgb(0_0_0/0.4)]">
            {spot.name}
          </h1>
          {spot.addr ? <p className="mt-2 text-sm text-white/85">{spot.addr}</p> : null}
        </header>
      </div>

      <div className="relative -mt-6 space-y-8 rounded-t-3xl bg-bg px-5 pt-8">
        {spot.opening_hours || spot.tel ? (
          <div className="space-y-1.5 rounded-card bg-card p-4 shadow-card">
            {spot.opening_hours ? (
              <p className="flex gap-2 text-sm text-ink">
                <span className="shrink-0 font-semibold text-dim">운영</span>
                <span className="leading-relaxed">{cleanHours(spot.opening_hours)}</span>
              </p>
            ) : null}
            {spot.tel ? (
              <p className="flex gap-2 text-sm text-ink">
                <span className="shrink-0 font-semibold text-dim">전화</span>
                {telHref(spot.tel) ? (
                  <a href={telHref(spot.tel)} className="text-primary underline underline-offset-2">
                    {spot.tel}
                  </a>
                ) : (
                  <span>{spot.tel}</span>
                )}
              </p>
            ) : null}
          </div>
        ) : null}

        {spot.overview ? <SpotOverview text={spot.overview} /> : null}

        <section aria-labelledby="timeline-heading" data-coach="spot-chart">
          <h2 id="timeline-heading" className="mb-1 text-lg font-bold text-ink">
            오늘의 시간대별 혼잡 예측
          </h2>
          {/* 계산 방식은 설정 > 자주 묻는 질문으로. 여기엔 예측값이라는 사실만 남긴다 */}
          <p className="mb-4 text-xs text-dim">{date} · 예측값</p>
          {day.length > 0 ? (
            <>
              <div className="flex h-36 items-end gap-1" role="img" aria-label="시간대별 혼잡도 막대그래프">
                {day.map((d, i) => (
                  <div key={d.hour} className="flex flex-1 flex-col items-center gap-1">
                    <div
                      className="w-full origin-bottom rounded-t-md animate-bar-grow"
                      style={{
                        height: `${Math.max(6, (d.pressure / maxPressure) * 120)}px`,
                        backgroundColor: LEVEL_COLOR[d.level],
                        opacity: 0.9,
                        animationDelay: `${i * 35}ms`,
                      }}
                    />
                    <span className="text-[10px] text-dim">{d.hour}</span>
                  </div>
                ))}
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                {calmHour ? (
                  <div className="rounded-card bg-card p-3 shadow-card">
                    <p className="text-xs text-dim">가장 한적</p>
                    <p className="mt-1 font-bold text-lv1">{calmHour.hour}시</p>
                  </div>
                ) : null}
                {peak ? (
                  <div className="rounded-card bg-card p-3 shadow-card">
                    <p className="text-xs text-dim">가장 붐빔</p>
                    <p className="mt-1 font-bold text-lv4">{peak.hour}시</p>
                  </div>
                ) : null}
              </div>
            </>
          ) : (
            <p className="rounded-card bg-card p-4 text-sm text-dim shadow-card">
              이 날짜의 예측 데이터가 없습니다.
            </p>
          )}
        </section>

        <section aria-labelledby="alt-heading" data-coach="spot-alt">
          <h2 id="alt-heading" className="mb-1 text-lg font-bold text-ink">
            비슷한데 더 한적한 곳
          </h2>
          <p className="mb-4 text-xs text-dim">{refHour}시 기준</p>
          <ul className="space-y-2">
            {alternatives.map((alt, i) => (
              <li key={alt.spot.spot_id} className="animate-card-in" style={{ animationDelay: `${i * 60}ms` }}>
                <Link
                  href={`/spots/${alt.spot.spot_id}`}
                  className="flex items-center gap-3 overflow-hidden rounded-card bg-card p-2.5 shadow-card transition-transform active:scale-[0.99]"
                >
                  {/* CSS 배경이 아니라 next/image — 배경으로 쓰면 원본(최대 600KB)을 56px 칸에 그대로 받는다 */}
                  <span className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-line" aria-hidden>
                    {alt.spot.image_url ? (
                      <Image
                        src={alt.spot.image_url}
                        alt=""
                        fill
                        sizes="56px"
                        className="object-cover photo-warm"
                        unoptimized={alt.spot.image_url.endsWith(".bmp")}
                      />
                    ) : null}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-ink">{alt.spot.name}</p>
                    <p className="text-xs text-dim">
                      {alt.spot.region} · {alt.distanceKm}km
                    </p>
                  </div>
                  <LevelBadge level={alt.congestion.level} imputed={alt.congestion.is_imputed} />
                </Link>
              </li>
            ))}
            {alternatives.length === 0 ? (
              <li className="rounded-card bg-card p-4 text-sm text-dim shadow-card">
                같은 카테고리의 한적한 대안을 찾지 못했어요.
              </li>
            ) : null}
          </ul>
        </section>

        <Link
          href="/schedule"
          className="block w-full rounded-card bg-cta py-4 text-center text-base font-bold text-on-cta transition-transform active:scale-[0.98]"
        >
          일정에 넣고 혼잡도 점검하기
        </Link>
      </div>
    </main>
  );
}
