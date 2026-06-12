import { MapView } from "@/components/MapView";
import { nowKstHourClamped, todayInHorizon } from "@/lib/constants";
import { fetchSpots } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export default async function MapPage() {
  const spots = await fetchSpots();
  return (
    <MapView spots={spots} initialDate={todayInHorizon()} initialHour={nowKstHourClamped()} />
  );
}
