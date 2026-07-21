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

/** 경로 조회 결과. 실패는 두 갈래로 구분한다:
 *  - "offroad": 좌표가 도로에서 멀어 카카오가 경로를 못 그림(422). 오류가 아니라 정상 상황.
 *  - "error": 콜드스타트·타임아웃·서버 오류(502 등). 재시도 대상. */
export type RouteResult =
  | { ok: true; data: RouteData }
  | { ok: false; reason: "offroad" | "error" };

// 경로는 (출발, 도착)당 1회만 카카오 호출 — 칩 시간 표시와 RouteView 모달이 결과 공유
const routeCache = new Map<string, Promise<RouteResult>>();

/** 두 스팟 간 자동차 경로 — 동일 오리진 Vercel 함수(/api/kakao-route) 경유.
 *  Render 프록시는 카카오의 Render IP 플래그(401)로 사용 불가 — route.ts 주석 참조. */
export function fetchRoute(from: Spot, to: Spot): Promise<RouteResult> {
  const key = `${from.spot_id}:${to.spot_id}`;
  const cached = routeCache.get(key);
  if (cached) return cached;
  const promise = (async (): Promise<RouteResult> => {
    try {
      const res = await fetch(
        `/api/kakao-route?from=${from.lat},${from.lng}&to=${to.lat},${to.lng}`,
        { signal: AbortSignal.timeout(TIMEOUT_MS) },
      );
      // 422 = 도로 밖 좌표(정상 상황), 그 외 비정상 = 재시도 가능한 오류
      if (res.status === 422) return { ok: false, reason: "offroad" };
      if (!res.ok) return { ok: false, reason: "error" };
      const data = (await res.json()) as RouteData;
      if (!Array.isArray(data.path) || data.path.length === 0) {
        return { ok: false, reason: "error" };
      }
      return { ok: true, data };
    } catch {
      return { ok: false, reason: "error" };
    }
  })();
  routeCache.set(key, promise);
  promise.then((r) => {
    // 일시 오류만 캐시에서 비운다(재시도 허용). 도로 밖은 확정 결과라 캐시 유지.
    if (!r.ok && r.reason === "error") routeCache.delete(key);
  });
  return promise;
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
