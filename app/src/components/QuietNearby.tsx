"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { haversineKm } from "@/lib/alternatives";
import { catLabel, spotDisplayName } from "@/lib/constants";
import { FeatureCourseCard } from "./FeatureCourseCard";
import { LevelBadge } from "./LevelBadge";
import type { Congestion, ScheduleSlot, Spot } from "@/lib/types";

// 제주 밖(여행 전 데스크톱 등)의 현위치는 추천 기준으로 무의미 — bbox 밖이면 무시
const JEJU_BBOX = { minLat: 33.0, maxLat: 33.7, minLng: 126.0, maxLng: 127.1 };
const STORAGE_KEY = "jejunow:schedule";

type Origin = { lat: number; lng: number; label: string };

/** "한적한 추천"을 기준점(내 위치 → 일정 스팟 중심 → 전역) 근처 순으로 정렬해 렌더.
 *  기준점 확보 전/실패 시엔 기존과 동일한 전역 압력순. */
export function QuietNearby({
  spots,
  congestion,
}: {
  spots: Spot[];
  congestion: Congestion[];
}) {
  const [origin, setOrigin] = useState<Origin | null>(null);

  useEffect(() => {
    let cancelled = false;
    // 1차: 계획해 둔 일정 스팟들의 중심점 (마이크로태스크 지연 — cascading render 회피)
    queueMicrotask(() => {
      if (cancelled) return;
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return;
        const parsed = JSON.parse(raw) as { slots?: ScheduleSlot[] };
        const byId = new Map(spots.map((s) => [s.spot_id, s]));
        const planned = (parsed.slots ?? [])
          .map((sl) => byId.get(sl.spotId))
          .filter((s): s is Spot => Boolean(s));
        if (planned.length > 0) {
          const lat = planned.reduce((acc, s) => acc + s.lat, 0) / planned.length;
          const lng = planned.reduce((acc, s) => acc + s.lng, 0) / planned.length;
          setOrigin((prev) => prev ?? { lat, lng, label: "일정 스팟 근처" });
        }
      } catch {
        // 손상된 저장값 무시
      }
    });
    // 2차(우선): 현위치 — 제주 안일 때만 채택
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          if (cancelled) return;
          const { latitude: lat, longitude: lng } = pos.coords;
          const inJeju =
            lat >= JEJU_BBOX.minLat &&
            lat <= JEJU_BBOX.maxLat &&
            lng >= JEJU_BBOX.minLng &&
            lng <= JEJU_BBOX.maxLng;
          if (inJeju) setOrigin({ lat, lng, label: "내 위치 근처" });
        },
        () => {
          // 권한 거부·실패 — 일정/전역 기준 유지
        },
        { timeout: 5000, maximumAge: 300_000 },
      );
    }
    return () => {
      cancelled = true;
    };
  }, [spots]);

  const ranked = useMemo(() => {
    const byId = new Map(spots.map((s) => [s.spot_id, s]));
    const calm = congestion
      .filter((c) => !c.is_imputed && c.level <= 2)
      .map((c) => ({ c, s: byId.get(c.spot_id) }))
      .filter((x): x is { c: Congestion; s: Spot } => Boolean(x.s?.image_url));
    if (origin) {
      return calm
        .map((x) => ({ ...x, km: haversineKm(origin.lat, origin.lng, x.s.lat, x.s.lng) }))
        .sort((a, b) => a.km - b.km || a.c.pressure - b.c.pressure);
    }
    return calm.map((x) => ({ ...x, km: null })).sort((a, b) => a.c.pressure - b.c.pressure);
  }, [spots, congestion, origin]);

  const feature = ranked[0];
  const rest = ranked.slice(1, 9);

  return (
    <>
      {feature ? (
        <section aria-labelledby="feature-heading" data-coach="dash-feature">
          <h2 id="feature-heading" className="mb-3 text-base font-bold text-ink">
            {origin ? `${origin.label} 한적한 코스` : "지금 가장 한적한 코스"}
          </h2>
          <FeatureCourseCard spot={feature.s} congestion={feature.c} />
        </section>
      ) : null}

      <section aria-labelledby="calm-heading" className="pb-4" data-coach="dash-quiet">
        <div className="mb-3 flex items-baseline justify-between">
          <h2 id="calm-heading" className="text-base font-bold text-ink">
            지금 한적한 스팟
            {origin ? (
              <span className="ml-1.5 text-xs font-medium text-primary">{origin.label}</span>
            ) : null}
          </h2>
          <Link href="/map" className="text-sm font-semibold text-primary">
            지도로 보기
          </Link>
        </div>
        {rest.length > 0 ? (
          /* 가로 스냅 캐러셀 — 세로 나열 대비 스크롤 절반·리듬 생성 (Airbnb식 photo-led row).
             음수 마진으로 화면 끝까지 흘리고 패딩으로 첫 카드 정렬 유지 */
          <div
            className="-mx-5 flex snap-x snap-mandatory gap-3 overflow-x-auto px-5 pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            role="list"
          >
            {rest.map(({ c, s }, i) => (
              <div
                key={s.spot_id}
                role="listitem"
                className="animate-card-in snap-start"
                style={{ animationDelay: `${i * 60}ms` }}
              >
                <Link
                  href={`/spots/${s.spot_id}`}
                  className="relative block h-56 w-40 overflow-hidden rounded-card shadow-card transition-transform active:scale-[0.97]"
                >
                  <Image
                    src={s.image_url ?? ""}
                    alt={spotDisplayName(s.name)}
                    fill
                    sizes="160px"
                    className="object-cover photo-warm"
                    unoptimized={Boolean(s.image_url?.endsWith(".bmp"))}
                  />
                  <div
                    className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/25 to-black/5"
                    aria-hidden
                  />
                  <div className="absolute left-2.5 top-2.5">
                    <LevelBadge level={c.level} imputed={c.is_imputed} onPhoto />
                  </div>
                  <div className="absolute inset-x-0 bottom-0 p-3">
                    <p className="text-sm font-bold leading-snug text-white [text-shadow:0_1px_8px_rgba(0,0,0,0.5)]">
                      {spotDisplayName(s.name)}
                    </p>
                    <p className="mt-0.5 truncate text-[11px] text-white/85">
                      {s.region} · {catLabel(s.cat2)}
                    </p>
                  </div>
                </Link>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-card bg-card px-6 py-10 text-center shadow-card">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.4} className="mx-auto h-11 w-11 text-dim/50" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6l4 2m6-2a10 10 0 1 1-20 0 10 10 0 0 1 20 0Z" />
            </svg>
            <p className="mt-3 text-sm text-dim">
              지금은 보여드릴 곳을 준비하고 있어요.
              <br />잠시 후 다시 확인해 주세요.
            </p>
          </div>
        )}
      </section>
    </>
  );
}
