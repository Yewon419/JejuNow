import Image from "next/image";
import Link from "next/link";
import { catLabel } from "@/lib/constants";
import type { Congestion, Spot } from "@/lib/types";
import { LevelBadge } from "./LevelBadge";

/** 사진 중심 스팟 카드 (초안 톤: 흰 카드 + 둥근 이미지 + 다크 텍스트) */
export function SpotCard({ spot, congestion }: { spot: Spot; congestion?: Congestion }) {
  return (
    <Link
      href={`/spots/${spot.spot_id}`}
      className="group block overflow-hidden rounded-card bg-card shadow-card transition-transform active:scale-[0.98]"
    >
      <div className="relative h-40 w-full bg-line">
        {spot.image_url ? (
          <Image
            src={spot.image_url}
            alt={spot.name}
            fill
            sizes="(max-width: 640px) 100vw, 320px"
            className="object-cover photo-warm"
            unoptimized={spot.image_url.endsWith(".bmp")}
          />
        ) : (
          <div className="flex h-full items-center justify-center text-dim/50" aria-hidden>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="h-10 w-10">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0 0 22.5 18.75V5.25A2.25 2.25 0 0 0 20.25 3H3.75A2.25 2.25 0 0 0 1.5 5.25v13.5A2.25 2.25 0 0 0 3.75 21Z"
              />
            </svg>
          </div>
        )}
        {congestion ? (
          <div className="absolute left-3 top-3">
            <LevelBadge level={congestion.level} imputed={congestion.is_imputed} />
          </div>
        ) : null}
      </div>
      <div className="p-4">
        <h3 className="truncate text-base font-bold text-ink">{spot.name}</h3>
        <p className="mt-0.5 text-xs text-dim">
          {spot.region} · {catLabel(spot.cat2)}
        </p>
      </div>
    </Link>
  );
}
