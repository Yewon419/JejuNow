import Image from "next/image";
import Link from "next/link";
import { catLabel } from "@/lib/constants";
import type { Congestion, Spot } from "@/lib/types";
import { LevelBadge, PressureBar } from "./LevelBadge";

export function SpotCard({ spot, congestion }: { spot: Spot; congestion?: Congestion }) {
  return (
    <Link
      href={`/spots/${spot.spot_id}`}
      className="group block overflow-hidden rounded-card border border-line bg-card transition-transform active:scale-[0.98]"
    >
      <div className="relative h-36 w-full bg-surface">
        {spot.image_url ? (
          <Image
            src={spot.image_url}
            alt={spot.name}
            fill
            sizes="(max-width: 640px) 100vw, 320px"
            className="object-cover"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-dim" aria-hidden>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="h-10 w-10">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0 0 22.5 18.75V5.25A2.25 2.25 0 0 0 20.25 3H3.75A2.25 2.25 0 0 0 1.5 5.25v13.5A2.25 2.25 0 0 0 3.75 21Z"
              />
            </svg>
          </div>
        )}
      </div>
      <div className="space-y-2 p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="truncate text-base font-semibold text-ink">{spot.name}</h3>
            <p className="text-xs text-dim">
              {spot.region} · {catLabel(spot.cat2)}
            </p>
          </div>
          {congestion ? <LevelBadge level={congestion.level} imputed={congestion.is_imputed} /> : null}
        </div>
        {congestion ? <PressureBar pressure={congestion.pressure} level={congestion.level} /> : null}
      </div>
    </Link>
  );
}
