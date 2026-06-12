// 브라우저용 PostgREST 읽기 클라이언트 (anon 키 — 공개 읽기 전용)
"use client";

import type { Congestion } from "./types";

function env(name: "NEXT_PUBLIC_SUPABASE_URL" | "NEXT_PUBLIC_SUPABASE_ANON_KEY"): string {
  const value =
    name === "NEXT_PUBLIC_SUPABASE_URL"
      ? process.env.NEXT_PUBLIC_SUPABASE_URL
      : process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!value) throw new Error(`환경변수 ${name} 누락`);
  return value;
}

async function rest<T>(path: string): Promise<T> {
  const key = env("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  const res = await fetch(`${env("NEXT_PUBLIC_SUPABASE_URL")}/rest/v1/${path}`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  });
  if (!res.ok) {
    throw new Error(`Supabase GET ${path} 실패: status=${res.status}`);
  }
  return (await res.json()) as T;
}

export async function fetchCongestionClient(date: string, hour: number): Promise<Congestion[]> {
  return rest<Congestion[]>(
    `congestion_pred?select=spot_id,pressure,level,is_imputed&date=eq.${date}&hour=eq.${hour}&limit=2000`,
  );
}

export async function fetchSpotDayClient(
  spotId: number,
  date: string,
): Promise<(Congestion & { hour: number })[]> {
  return rest<(Congestion & { hour: number })[]>(
    `congestion_pred?select=spot_id,hour,pressure,level,is_imputed&date=eq.${date}&spot_id=eq.${spotId}&order=hour`,
  );
}
