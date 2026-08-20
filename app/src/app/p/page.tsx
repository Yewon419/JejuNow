import Image from "next/image";
import Link from "next/link";
import { ImportPlanButton } from "@/components/ImportPlanButton";
import { catLabel, formatKstDate, spotDisplayName } from "@/lib/constants";
import { decodePlan } from "@/lib/planShare";
import { fetchSpots } from "@/lib/supabase";
import type { ScheduleSlot, Spot } from "@/lib/types";

// 공유 링크로 열리는 읽기전용 계획 뷰 (로그인 불필요, 비앱 사용자도 열람).
export default async function SharedPlanPage({
  searchParams,
}: {
  searchParams: Promise<{ d?: string }>;
}) {
  const { d } = await searchParams;
  const shared = d ? decodePlan(d) : null;

  if (!shared) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-xl flex-col items-center justify-center px-6 text-center">
        <p className="text-sm font-bold tracking-widest text-primary">제주나우</p>
        <h1 className="mt-3 text-xl font-bold text-ink">계획을 불러올 수 없어요</h1>
        <p className="mt-2 text-sm leading-relaxed text-dim">
          링크가 잘못되었거나 손상됐어요. 보낸 사람에게 다시 받아 주세요.
        </p>
        <Link href="/" className="mt-6 text-sm font-semibold text-primary">
          제주나우 열기
        </Link>
      </main>
    );
  }

  const spots = await fetchSpots();
  const byId = new Map(spots.map((s) => [s.spot_id, s]));
  const items = shared.slots
    .map((sl) => ({ slot: sl, spot: byId.get(sl.spotId) }))
    .filter((x): x is { slot: ScheduleSlot; spot: Spot } => Boolean(x.spot))
    .sort((a, b) => a.slot.hour - b.slot.hour);

  return (
    <main className="mx-auto w-full max-w-full space-y-6 px-5 pt-[calc(3rem+env(safe-area-inset-top,0px))] pb-10 md:max-w-2xl">
      <header>
        <p className="text-sm font-bold tracking-widest text-primary">제주나우</p>
        <h1 className="mt-2 text-2xl font-bold text-ink">{shared.name}</h1>
        <p className="mt-1 text-sm text-dim">
          {formatKstDate(shared.date)} · {items.length}곳
        </p>
        <p className="mt-1 text-xs text-dim">공유받은 여행 계획이에요</p>
      </header>

      <ol aria-label="공유된 일정" className="relative space-y-3 pl-8">
        {items.length > 1 || shared.journey ? (
          <span aria-hidden className="absolute bottom-5 left-[0.4375rem] top-5 w-0.5 bg-line" />
        ) : null}

        {shared.journey && items.length > 0 ? (
          <li className="relative">
            <span className="absolute -left-8 top-0.5">
              <span className="block h-3.5 w-3.5 rounded-full border-2 border-white bg-ink shadow-sm" />
            </span>
            <p className="pt-0.5 text-xs font-semibold text-dim">출발 · {shared.journey.origin.label}</p>
          </li>
        ) : null}

        {items.map(({ slot, spot }) => (
          <li key={slot.hour} className="relative">
            <span className="absolute -left-8 top-4">
              <span className="block h-3.5 w-3.5 rounded-full border-2 border-white bg-primary/50 shadow-sm" />
            </span>
            <div className="rounded-card bg-card p-4 shadow-card">
              <div className="flex items-center gap-3">
                <span className="w-9 shrink-0 text-sm font-semibold text-dim">{slot.hour}시</span>
                <span className="relative h-11 w-11 shrink-0 overflow-hidden rounded-xl bg-line">
                  {spot.image_url ? (
                    <Image
                      src={spot.image_url}
                      alt=""
                      fill
                      sizes="44px"
                      className="object-cover photo-warm"
                      unoptimized={spot.image_url.endsWith(".bmp")}
                    />
                  ) : null}
                </span>
                <div className="min-w-0">
                  <p className="truncate font-semibold text-ink">{spotDisplayName(spot.name)}</p>
                  <p className="text-xs text-dim">
                    {spot.region} · {catLabel(spot.cat2)}
                  </p>
                </div>
              </div>
            </div>
          </li>
        ))}

        {shared.journey?.end && items.length > 0 ? (
          <li className="relative">
            <span className="absolute -left-8 top-0.5">
              <span className="block h-3.5 w-3.5 rounded-full border-2 border-white bg-cta shadow-sm" />
            </span>
            <p className="pt-0.5 text-xs font-semibold text-dim">도착 · {shared.journey.end.label}</p>
          </li>
        ) : null}

        {items.length === 0 ? (
          <li className="rounded-card bg-card px-6 py-10 text-center shadow-card">
            <p className="font-bold text-ink">담긴 곳이 없는 계획이에요</p>
          </li>
        ) : null}
      </ol>

      {d ? (
        <div className="space-y-2">
          <ImportPlanButton code={d} />
          <p className="text-center text-xs text-dim">
            내 앱에 새 시안으로 저장하고 혼잡도까지 확인할 수 있어요
          </p>
        </div>
      ) : null}
    </main>
  );
}
