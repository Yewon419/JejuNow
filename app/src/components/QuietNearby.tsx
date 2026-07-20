"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { haversineKm } from "@/lib/alternatives";
import { FeatureCourseCard } from "./FeatureCourseCard";
import { SpotCard } from "./SpotCard";
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
  const rest = ranked.slice(1, 7);

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
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {rest.map(({ c, s }) => (
              <SpotCard key={s.spot_id} spot={s} congestion={c} />
            ))}
          </div>
        ) : (
          <p className="rounded-card bg-card p-4 text-sm text-dim shadow-card">
            데이터 준비 중입니다. 잠시 후 다시 확인해 주세요.
          </p>
        )}
      </section>
    </>
  );
}
