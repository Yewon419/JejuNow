import { Suspense } from "react";
import { MapView } from "@/components/MapView";
import { nowKstHourClamped, todayInHorizon } from "@/lib/constants";
import { fetchSpots } from "@/lib/supabase";

// ISR — 사유는 dashboard/page.tsx 주석 참조
export const revalidate = 300;

export default async function MapPage() {
  const spots = await fetchSpots();
  return (
    // Suspense: MapView가 useSearchParams(?spot= 포커스)를 쓰므로 프리렌더 경계 필요
    <Suspense>
      <MapView spots={spots} initialDate={todayInHorizon()} initialHour={nowKstHourClamped()} />
    </Suspense>
  );
}
