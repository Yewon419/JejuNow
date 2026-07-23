import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CoachMark } from "@/components/CoachMark";
import { DetailDismiss } from "@/components/DetailDismiss";
import { LevelBadge, LevelDot } from "@/components/LevelBadge";
import { SpotInfoCard } from "@/components/SpotInfoCard";
import { SpotMiniMap } from "@/components/SpotMiniMap";
import { SpotOverview } from "@/components/SpotOverview";
import { findAlternatives } from "@/lib/alternatives";
import { SPOT_COACH } from "@/lib/coach";
import {
  LEVEL_COLOR,
  LEVEL_LABEL,
  catLabel,
  kstTodayStr,
  nowKstHourClamped,
  spotDisplayName,
  spotNameNote,
  todayInHorizon,
} from "@/lib/constants";
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

  // "지금" 표시(구글 피크 시간대 문법) — 호라이즌 클램프로 date가 오늘이 아닐 수 있어 대조
  const nowHour = date === kstTodayStr() ? nowKstHourClamped() : null;
  const nowC = nowHour !== null ? (day.find((d) => d.hour === nowHour) ?? null) : null;

  return (
    <main className="mx-auto min-h-dvh max-w-xl pb-32 lg:max-w-3xl">
      <CoachMark id="spot" steps={SPOT_COACH} />
      {/* 닫기 제스처 래퍼 — 당길 때 화면이 따라 내려온다. 고정 하단 바는 transform
          컨테이닝 블록에 걸리면 위치가 깨지므로 래퍼 밖에 둔다 */}
      <DetailDismiss>
      {/* 아이패드 가로(lg+)는 2단: 좌=히어로(스티키), 우=정보 스크롤 */}
      <div className="lg:grid lg:grid-cols-2 lg:items-start lg:gap-8 lg:px-6 lg:pt-6">
      <div
        className={`relative h-80 w-full lg:sticky lg:top-6 lg:h-[min(480px,calc(100dvh-10rem))] lg:overflow-hidden lg:rounded-3xl ${
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
            {spotDisplayName(spot.name)}
          </h1>
          {/* 괄호 수식("유네스코 세계자연유산" 등)은 제목에서 떼고 여기서만 보조 표기 */}
          {spotNameNote(spot.name) ? (
            <p className="mt-1 text-sm font-medium text-white/85">{spotNameNote(spot.name)}</p>
          ) : null}
          {/* 주소는 정보 카드(복사 가능)로 이동 — 히어로는 이름·수식만 남긴다 */}
        </header>
      </div>

      <div className="relative -mt-6 space-y-8 rounded-t-3xl bg-bg px-5 pt-8 lg:mt-0 lg:rounded-none lg:px-0 lg:pt-0">
        <SpotInfoCard
          hours={spot.opening_hours}
          tel={spot.tel}
          addr={spot.addr}
          homepage={spot.homepage}
        />

        {spot.overview ? <SpotOverview text={spot.overview} /> : null}

        <section aria-labelledby="timeline-heading" data-coach="spot-chart">
          <h2 id="timeline-heading" className="mb-1 text-lg font-bold text-ink">
            오늘의 시간대별 혼잡 예측
          </h2>
          {/* 계산 방식은 설정 > 자주 묻는 질문으로. 여기엔 예측값이라는 사실만 남긴다 */}
          <p className="mb-4 text-xs text-dim">{date} · 예측값</p>
          {day.length > 0 ? (
            <>
              <div className="flex h-40 items-end gap-1" role="img" aria-label="시간대별 혼잡도 막대그래프">
                {day.map((d, i) => {
                  const isNow = nowHour !== null && d.hour === nowHour;
                  return (
                    <div key={d.hour} className="flex flex-1 flex-col items-center gap-1">
                      {/* 구글 피크 시간대 문법: 현재 시각 막대에 「지금」 마커 */}
                      {isNow ? (
                        <span className="whitespace-nowrap text-[9px] font-bold text-ink">지금</span>
                      ) : null}
                      <div
                        className={`w-full origin-bottom rounded-t-md animate-bar-grow ${
                          isNow ? "ring-2 ring-ink/60" : ""
                        }`}
                        style={{
                          height: `${Math.max(6, (d.pressure / maxPressure) * 120)}px`,
                          backgroundColor: LEVEL_COLOR[d.level],
                          opacity: isNow ? 1 : 0.9,
                          animationDelay: `${i * 35}ms`,
                        }}
                      />
                      <span className={isNow ? "text-[10px] font-bold text-ink" : "text-[10px] text-dim"}>
                        {d.hour}
                      </span>
                    </div>
                  );
                })}
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
                    <p className="truncate font-semibold text-ink">{spotDisplayName(alt.spot.name)}</p>
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

        <SpotMiniMap spotId={spotId} lat={spot.lat} lng={spot.lng} addr={spot.addr} />
      </div>
      </div>
      </DetailDismiss>

      {/* 스티키 하단 바 (Airbnb·Klook 문법): 지금 혼잡도 요약 + CTA. BottomNav와 같은
          구조로 바닥에 붙이고 홈 인디케이터는 배경 padding으로 덮는다 */}
      <div className="fixed inset-x-0 bottom-0 z-40">
        <div
          className="mx-auto flex max-w-md items-center gap-3 border-t border-line bg-surface px-5 pt-3 sm:border-x md:max-w-xl lg:max-w-3xl"
          style={{ paddingBottom: "calc(0.75rem + env(safe-area-inset-bottom, 0px))" }}
        >
          <div className="min-w-0 flex-1">
            {nowC ? (
              <>
                <p className="flex items-center gap-1.5 text-sm font-bold text-ink">
                  <LevelDot level={nowC.level} size={10} />
                  지금 {LEVEL_LABEL[nowC.level] ?? "?"}
                  {nowC.is_imputed ? <span className="font-normal text-dim">· 추정</span> : null}
                </p>
                {calmHour ? (
                  <p className="mt-0.5 text-xs text-dim">{calmHour.hour}시가 가장 한적해요</p>
                ) : null}
              </>
            ) : (
              <p className="text-sm font-medium text-dim">
                {calmHour ? `${calmHour.hour}시가 가장 한적해요` : "예측 준비 중"}
              </p>
            )}
          </div>
          <Link
            href="/schedule"
            className="shrink-0 rounded-card bg-cta px-6 py-3.5 text-sm font-bold text-on-cta transition-transform active:scale-[0.97]"
          >
            일정에 넣기
          </Link>
        </div>
      </div>
    </main>
  );
}
