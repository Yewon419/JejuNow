import { ScheduleBuilder } from "@/components/ScheduleBuilder";
import { fetchSpots } from "@/lib/supabase";

// 스팟 목록만 쓰고 나머지는 클라이언트가 처리한다 — 시각 의존이 없어 더 길게 잡는다
export const revalidate = 3600;

export default async function SchedulePage() {
  const spots = await fetchSpots();
  return <ScheduleBuilder spots={spots} />;
}
