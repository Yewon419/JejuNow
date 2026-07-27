"use client";

import { useEffect, useState } from "react";
import { tapLight, tapMedium } from "@/lib/haptics";
import {
  type Reaction,
  isFavorite,
  getReaction,
  recordView,
  toggleFavorite,
  toggleReaction,
} from "@/lib/signals";

// 상세 페이지 취향 컨트롤. 진입 시 조회를 기록하고, 좋아요/별로예요(택1)·즐겨찾기를 토글한다.
export function SpotReactions({ spotId }: { spotId: number }) {
  const [reaction, setReaction] = useState<Reaction | null>(null);
  const [fav, setFav] = useState(false);

  // localStorage(외부 시스템) — 마운트 후 마이크로태스크로 지연해 cascading render 회피
  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      recordView(spotId);
      setReaction(getReaction(spotId));
      setFav(isFavorite(spotId));
    });
    return () => {
      cancelled = true;
    };
  }, [spotId]);

  function react(next: Reaction) {
    tapLight();
    setReaction(toggleReaction(spotId, next));
  }

  function star() {
    tapMedium();
    setFav(toggleFavorite(spotId));
  }

  return (
    <section aria-label="이 곳에 대한 반응" className="flex items-center gap-2">
      <button
        type="button"
        onClick={() => react("like")}
        aria-pressed={reaction === "like"}
        className={`inline-flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-card border py-3 text-sm font-bold shadow-card transition-colors ${
          reaction === "like"
            ? "border-primary bg-primary/10 text-primary"
            : "border-line bg-card text-dim hover:text-ink"
        }`}
      >
        <svg viewBox="0 0 24 24" fill={reaction === "like" ? "currentColor" : "none"} stroke="currentColor" strokeWidth={1.8} className="h-5 w-5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M6.633 10.5c.806 0 1.533-.446 2.031-1.08a9.041 9.041 0 0 1 2.861-2.4c.723-.384 1.35-.956 1.653-1.715a4.498 4.498 0 0 0 .322-1.672V2.75a.75.75 0 0 1 .75-.75 2.25 2.25 0 0 1 2.25 2.25c0 1.152-.26 2.243-.723 3.218-.266.558.107 1.282.725 1.282m0 0h3.126c1.026 0 1.945.694 2.054 1.715.045.422.068.85.068 1.285a11.95 11.95 0 0 1-2.649 7.521c-.388.482-.987.729-1.605.729H14.23c-.483 0-.964-.078-1.423-.23l-3.114-1.04a4.501 4.501 0 0 0-1.423-.23H5.904m10.598-9.75H14.25M5.904 18.5c.083.205.173.405.27.6.197.4-.078.898-.523.898h-.908c-.889 0-1.713-.518-1.972-1.368a12 12 0 0 1-.521-3.507c0-1.553.295-3.036.831-4.398C3.387 9.953 4.167 9.5 5 9.5h1.053c.472 0 .745.556.5.96a8.958 8.958 0 0 0-1.302 4.665c0 1.194.232 2.333.654 3.375Z" />
        </svg>
        좋아요
      </button>
      <button
        type="button"
        onClick={() => react("dislike")}
        aria-pressed={reaction === "dislike"}
        className={`inline-flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-card border py-3 text-sm font-bold shadow-card transition-colors ${
          reaction === "dislike"
            ? "border-lv4 bg-lv4/10 text-lv4"
            : "border-line bg-card text-dim hover:text-ink"
        }`}
      >
        <svg viewBox="0 0 24 24" fill={reaction === "dislike" ? "currentColor" : "none"} stroke="currentColor" strokeWidth={1.8} className="h-5 w-5 rotate-180">
          <path strokeLinecap="round" strokeLinejoin="round" d="M6.633 10.5c.806 0 1.533-.446 2.031-1.08a9.041 9.041 0 0 1 2.861-2.4c.723-.384 1.35-.956 1.653-1.715a4.498 4.498 0 0 0 .322-1.672V2.75a.75.75 0 0 1 .75-.75 2.25 2.25 0 0 1 2.25 2.25c0 1.152-.26 2.243-.723 3.218-.266.558.107 1.282.725 1.282m0 0h3.126c1.026 0 1.945.694 2.054 1.715.045.422.068.85.068 1.285a11.95 11.95 0 0 1-2.649 7.521c-.388.482-.987.729-1.605.729H14.23c-.483 0-.964-.078-1.423-.23l-3.114-1.04a4.501 4.501 0 0 0-1.423-.23H5.904m10.598-9.75H14.25M5.904 18.5c.083.205.173.405.27.6.197.4-.078.898-.523.898h-.908c-.889 0-1.713-.518-1.972-1.368a12 12 0 0 1-.521-3.507c0-1.553.295-3.036.831-4.398C3.387 9.953 4.167 9.5 5 9.5h1.053c.472 0 .745.556.5.96a8.958 8.958 0 0 0-1.302 4.665c0 1.194.232 2.333.654 3.375Z" />
        </svg>
        별로예요
      </button>
      <button
        type="button"
        onClick={star}
        aria-pressed={fav}
        aria-label={fav ? "즐겨찾기 해제" : "즐겨찾기"}
        className={`inline-flex shrink-0 cursor-pointer items-center justify-center rounded-card border p-3 shadow-card transition-colors ${
          fav ? "border-lv2 bg-lv2/10 text-lv2" : "border-line bg-card text-dim hover:text-ink"
        }`}
      >
        <svg viewBox="0 0 24 24" fill={fav ? "currentColor" : "none"} stroke="currentColor" strokeWidth={1.8} className="h-5 w-5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 0 1 1.04 0l2.125 5.111a.563.563 0 0 0 .475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 0 0-.182.557l1.285 5.385a.562.562 0 0 1-.84.61l-4.725-2.885a.562.562 0 0 0-.586 0L6.982 20.54a.562.562 0 0 1-.84-.61l1.285-5.386a.562.562 0 0 0-.182-.557l-4.204-3.602a.562.562 0 0 1 .321-.988l5.518-.442a.563.563 0 0 0 .475-.345L11.48 3.5Z" />
        </svg>
      </button>
    </section>
  );
}
