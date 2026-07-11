// 라이브 추론 API 클라이언트 (FastAPI /simulate·/alternatives)
// Render 무료 티어 슬립·미배포·타임아웃 시 null 반환 — 호출부는
// Supabase precompute 경로로 폴백한다 (데모 생존성 우선).
"use client";

import type { Alternative } from "./alternatives";
import type { Congestion, ScheduleSlot, Spot } from "./types";

const API_BASE = (process.env.NEXT_PUBLIC_API_URL ?? "").replace(/\/$/, "");
const TIMEOUT_MS = 8000; // 콜드스타트 대비 여유, UX 한계선

type SimulateSlotOut = {
  spot_id: number;
  hour: number;
  pressure: number;
  level: number;
  is_imputed: boolean;
  crowded: boolean;
};

type AlternativeOut = {
  spot_id: number;
  pressure: number;
  level: number;
  is_imputed: boolean;
  distance_km: number;
};

async function post<T>(path: string, body: unknown): Promise<T | null> {
  if (!API_BASE) return null;
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

async function get<T>(path: string): Promise<T | null> {
  if (!API_BASE) return null;
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

/** 일정 슬롯 라이브 추론 — 성공 시 hour→spot_id→Congestion, 실패 시 null */
export async function simulateSchedule(
  date: string,
  slots: ScheduleSlot[],
): Promise<Map<number, Map<number, Congestion>> | null> {
  if (slots.length === 0) return null;
  const body = { date, slots: slots.map((s) => ({ spot_id: s.spotId, hour: s.hour })) };
  const res = await post<{ slots: SimulateSlotOut[] }>("/simulate", body);
  if (!res || !Array.isArray(res.slots)) return null;
  const byHour = new Map<number, Map<number, Congestion>>();
  for (const s of res.slots) {
    const m = byHour.get(s.hour) ?? new Map<number, Congestion>();
    m.set(s.spot_id, {
      spot_id: s.spot_id,
      pressure: s.pressure,
      level: s.level,
      is_imputed: s.is_imputed,
    });
    byHour.set(s.hour, m);
  }
  return byHour;
}

export type RouteData = {
  distance_m: number;
  duration_s: number;
  path: [number, number][]; // [lat, lng]
};

/** 두 스팟 간 자동차 경로 (카카오내비 API 프록시) — 실패·미배포 시 null */
export async function fetchRoute(fromSpot: number, toSpot: number): Promise<RouteData | null> {
  const res = await get<RouteData>(`/route?from_spot=${fromSpot}&to_spot=${toSpot}`);
  if (!res || !Array.isArray(res.path) || res.path.length === 0) return null;
  return res;
}

/** 라이브 대안 추천 — 성공 시 Alternative[](TS 폴백과 동일 형태), 실패 시 null */
export async function fetchAlternativesLive(
  spotId: number,
  date: string,
  hour: number,
  spotById: ReadonlyMap<number, Spot>,
): Promise<Alternative[] | null> {
  const res = await get<AlternativeOut[]>(
    `/alternatives?spot_id=${spotId}&date=${date}&hour=${hour}`,
  );
  if (!res || !Array.isArray(res)) return null;
  const out: Alternative[] = [];
  for (const alt of res) {
    const spot = spotById.get(alt.spot_id);
    if (!spot) continue;
    out.push({
      spot,
      congestion: {
        spot_id: alt.spot_id,
        pressure: alt.pressure,
        level: alt.level,
        is_imputed: alt.is_imputed,
      },
      distanceKm: Math.round(alt.distance_km * 10) / 10,
    });
  }
  return out;
}
