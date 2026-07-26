"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { catLabel, spotDisplayName } from "@/lib/constants";
import { loadScheduleStore } from "@/lib/scheduleStore";
import { computeAffinity, hasAnySignal, readReactions, scoreSpot } from "@/lib/signals";
import type { Congestion, Spot } from "@/lib/types";
import { LevelDot } from "./LevelBadge";

// 취향 맞춤 — 좋아요·즐겨찾기·자주 본 카테고리에 가산점을 줘, 지금 안 붐비는 선호 스팟을 띄운다.
// 신호가 하나도 없으면(콜드스타트) 아무것도 그리지 않는다.
export function TasteRecs({ spots, congestion }: { spots: Spot[]; congestion: Congestion[] }) {
  const [ranked, setRanked] = useState<Spot[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      if (!hasAnySignal()) {
        setRanked([]);
        return;
      }
      const scheduled = new Set(
        loadScheduleStore().plans.flatMap((p) => p.slots.map((s) => s.spotId)),
      );
      const affinity = computeAffinity(spots, scheduled);
      const reactions = readReactions();
      const congById = new Map(congestion.map((c) => [c.spot_id, c]));
      const top = spots
        .filter((s) => s.image_url && reactions[String(s.spot_id)] !== "dislike")
        .map((s) => ({ s, score: scoreSpot(s, affinity), c: congById.get(s.spot_id) }))
        // 선호 카테고리 + 지금 붐비지 않는 곳
        .filter((x) => x.score > 0 && !(x.c && x.c.level >= 3))
        .sort((a, b) => b.score - a.score)
        .slice(0, 6)
        .map((x) => x.s);
      setRanked(top);
    });
    return () => {
      cancelled = true;
    };
  }, [spots, congestion]);

  if (!ranked || ranked.length === 0) return null;

  const congById = new Map(congestion.map((c) => [c.spot_id, c]));

  return (
    <section aria-labelledby="taste-heading">
      <div className="mb-3">
        <h2 id="taste-heading" className="text-base font-bold text-ink">
          취향 맞춤
        </h2>
        <p className="mt-0.5 text-xs text-dim">좋아하고 자주 본 카테고리 중 지금 한적한 곳</p>
      </div>
      {/* 가로 스크롤 카드 — 프레임 밖 넘침 방지 위해 부모에 min-w-0 필요(대시보드에서 보장) */}
      <ul className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-1">
        {ranked.map((s) => {
          const c: Congestion | undefined = congById.get(s.spot_id);
          return (
            <li key={s.spot_id} className="shrink-0">
              <Link
                href={`/spots/${s.spot_id}`}
                className="block w-40 overflow-hidden rounded-card bg-card shadow-card transition-transform active:scale-[0.98]"
              >
                <span className="relative block h-28 w-full bg-line">
                  {s.image_url ? (
                    <Image
                      src={s.image_url}
                      alt=""
                      fill
                      sizes="160px"
                      className="object-cover photo-warm"
                      unoptimized={s.image_url.endsWith(".bmp")}
                    />
                  ) : null}
                </span>
                <span className="block p-3">
                  <span className="flex items-center gap-1.5">
                    <LevelDot level={c?.level ?? 1} size={10} />
                    <span className="truncate text-sm font-bold text-ink">
                      {spotDisplayName(s.name)}
                    </span>
                  </span>
                  <span className="mt-0.5 block truncate text-xs text-dim">{catLabel(s.cat2)}</span>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
