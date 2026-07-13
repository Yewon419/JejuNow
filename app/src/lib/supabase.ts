// Supabase PostgREST 읽기 전용 클라이언트 (anon 키, RLS=select만 허용)
import type { Congestion, Spot, SpotDetail, WeatherMonth } from "./types";

// 직접 멤버 접근만 빌드타임 인라인됨 (process.env[동적키] 금지)
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

function env(value: string | undefined, name: string): string {
  if (!value) throw new Error(`환경변수 ${name} 누락 — app/.env.local 또는 Vercel env 확인`);
  return value;
}

async function rest<T>(path: string, revalidateSec: number): Promise<T> {
  const base = env(SUPABASE_URL, "NEXT_PUBLIC_SUPABASE_URL");
  const key = env(SUPABASE_ANON_KEY, "NEXT_PUBLIC_SUPABASE_ANON_KEY");
  const res = await fetch(`${base}/rest/v1/${path}`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
    next: { revalidate: revalidateSec },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Supabase GET ${path} 실패: status=${res.status} body=${body.slice(0, 200)}`);
  }
  return (await res.json()) as T;
}

/** TourAPI 구형 리소스의 http URL을 https로 정규화 — 혼합콘텐츠·remotePatterns(https만) 차단 회피 */
function normalizeSpot<T extends Spot>(s: T): T {
  return s.image_url?.startsWith("http://")
    ? { ...s, image_url: s.image_url.replace(/^http:\/\//, "https://") }
    : s;
}

export async function fetchSpots(): Promise<Spot[]> {
  const rows = await rest<Spot[]>(
    "spots?select=spot_id,name,cat1,cat2,lat,lng,addr,opening_hours,image_url,is_outdoor,region&order=spot_id&limit=2000",
    3600,
  );
  return rows.map(normalizeSpot);
}

export async function fetchCongestion(date: string, hour: number): Promise<Congestion[]> {
  return rest<Congestion[]>(
    `congestion_pred?select=spot_id,pressure,level,is_imputed&date=eq.${date}&hour=eq.${hour}&limit=2000`,
    1800,
  );
}

/** 한 스팟의 특정 날짜 시간대별 혼잡도 (9~20시) */
export async function fetchSpotDay(spotId: number, date: string): Promise<(Congestion & { hour: number })[]> {
  return rest<(Congestion & { hour: number })[]>(
    `congestion_pred?select=spot_id,hour,pressure,level,is_imputed&date=eq.${date}&spot_id=eq.${spotId}&order=hour`,
    1800,
  );
}

export async function fetchSpotById(spotId: number): Promise<SpotDetail | null> {
  const rows = await rest<SpotDetail[]>(
    `spots?select=spot_id,name,cat1,cat2,lat,lng,addr,opening_hours,image_url,is_outdoor,region,overview,tel&spot_id=eq.${spotId}`,
    3600,
  );
  return rows[0] ? normalizeSpot(rows[0]) : null;
}

export async function fetchWeatherMonth(ym: string): Promise<WeatherMonth | null> {
  const rows = await rest<WeatherMonth[]>(
    `weather?select=ym,avg_temp,precip_mm&ym=eq.${ym}`,
    86400,
  );
  return rows[0] ?? null;
}
