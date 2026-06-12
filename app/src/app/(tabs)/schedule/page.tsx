import { ScheduleBuilder } from "@/components/ScheduleBuilder";
import { fetchSpots } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export default async function SchedulePage() {
  const spots = await fetchSpots();
  return <ScheduleBuilder spots={spots} />;
}
