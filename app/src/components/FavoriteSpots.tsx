"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { catLabel, spotDisplayName } from "@/lib/constants";
import { readFavorites } from "@/lib/signals";
import type { Spot } from "@/lib/types";

// 저장한 곳 — 즐겨찾기한 스팟을 홈에 모아 보여준다. 없으면 아무것도 그리지 않는다.
export function FavoriteSpots({ spots }: { spots: Spot[] }) {
  const [saved, setSaved] = useState<Spot[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      const ids = readFavorites();
      const byId = new Map(spots.map((s) => [s.spot_id, s]));
      // 최근 저장이 앞에 오도록 뒤집는다
      setSaved(
        [...ids]
          .reverse()
          .map((id) => byId.get(id))
          .filter((s): s is Spot => Boolean(s)),
      );
    });
    return () => {
      cancelled = true;
    };
  }, [spots]);

  if (!saved || saved.length === 0) return null;

  return (
    <section aria-labelledby="fav-heading">
      <div className="mb-3 flex items-baseline justify-between">
        <h2 id="fav-heading" className="text-base font-bold text-ink">
          저장한 곳
        </h2>
        <span className="text-xs font-medium text-dim">{saved.length}곳</span>
      </div>
      <ul className="space-y-2">
        {saved.map((s) => (
          <li key={s.spot_id}>
            <Link
              href={`/spots/${s.spot_id}`}
              className="flex items-center gap-3 overflow-hidden rounded-card bg-card p-2.5 shadow-card transition-transform active:scale-[0.99]"
            >
              <span className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-line" aria-hidden>
                {s.image_url ? (
                  <Image
                    src={s.image_url}
                    alt=""
                    fill
                    sizes="56px"
                    className="object-cover photo-warm"
                    unoptimized={s.image_url.endsWith(".bmp")}
                  />
                ) : null}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold text-ink">
                  {spotDisplayName(s.name)}
                </span>
                <span className="block truncate text-xs text-dim">
                  {s.region} · {catLabel(s.cat2)}
                </span>
              </span>
              <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5 shrink-0 text-lv2" aria-hidden>
                <path d="M11.48 3.499a.562.562 0 0 1 1.04 0l2.125 5.111a.563.563 0 0 0 .475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 0 0-.182.557l1.285 5.385a.562.562 0 0 1-.84.61l-4.725-2.885a.562.562 0 0 0-.586 0L6.982 20.54a.562.562 0 0 1-.84-.61l1.285-5.386a.562.562 0 0 0-.182-.557l-4.204-3.602a.562.562 0 0 1 .321-.988l5.518-.442a.563.563 0 0 0 .475-.345L11.48 3.5Z" />
              </svg>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
