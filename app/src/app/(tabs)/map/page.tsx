import { MapView } from "@/components/MapView";
import { nowKstHourClamped, todayInHorizon } from "@/lib/constants";
import { fetchSpots } from "@/lib/supabase";

// ISR — 사유는 dashboard/page.tsx 주석 참조
export const revalidate = 300;

export default async function MapPage() {
  const spots = await fetchSpots();
  return (
    <MapView spots={spots} initialDate={todayInHorizon()} initialHour={nowKstHourClamped()} />
  );
}
