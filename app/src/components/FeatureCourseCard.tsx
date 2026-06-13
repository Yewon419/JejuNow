import Image from "next/image";
import Link from "next/link";
import { catLabel, LEVEL_COLOR, LEVEL_LABEL } from "@/lib/constants";
import type { Congestion, Spot } from "@/lib/types";

/** 초안의 큰 "추천 코스" 카드 — 사진 위 텍스트 오버레이 + CTA. */
export function FeatureCourseCard({ spot, congestion }: { spot: Spot; congestion?: Congestion }) {
  const level = congestion?.level ?? 1;
  const badgeColor = LEVEL_COLOR[level] ?? LEVEL_COLOR[1];
  return (
    <Link
      href={`/spots/${spot.spot_id}`}
      className="relative block h-56 overflow-hidden rounded-card shadow-card transition-transform active:scale-[0.98]"
    >
      {spot.image_url ? (
        <Image
          src={spot.image_url}
          alt={spot.name}
          fill
          sizes="(max-width: 640px) 100vw, 600px"
          className="object-cover"
          priority
        />
      ) : (
        <div className="h-full w-full bg-gradient-to-br from-primary to-cta" aria-hidden />
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/15 to-transparent" aria-hidden />
      <div className="absolute inset-x-0 bottom-0 p-5">
        <span
          className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold text-white"
          style={{ backgroundColor: badgeColor }}
        >
          지금 {LEVEL_LABEL[level] ?? "한적"} · 추천 코스
        </span>
        <h3 className="mt-2 text-2xl font-bold text-white">{spot.name}</h3>
        <p className="text-sm text-white/85">
          {spot.region} · {catLabel(spot.cat2)}
        </p>
        <span className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-white px-4 py-2 text-sm font-bold text-ink">
          이 코스로 안내하기
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} className="h-4 w-4">
            <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
          </svg>
        </span>
      </div>
    </Link>
  );
}
