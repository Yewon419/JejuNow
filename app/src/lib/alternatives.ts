// 대안 추천 — 동일 cat2 내 여유(level<=2) 스팟, 압력·거리 순 (api/routes/alternatives.py와 동일 규칙)
import type { Congestion, Spot } from "./types";

export type Alternative = { spot: Spot; congestion: Congestion; distanceKm: number };

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const rad = Math.PI / 180;
  const a =
    Math.sin(((lat2 - lat1) * rad) / 2) ** 2 +
    Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(((lng2 - lng1) * rad) / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(a));
}

export function findAlternatives(
  origin: Spot,
  spots: Spot[],
  congestion: ReadonlyMap<number, Congestion>,
  max = 5,
): Alternative[] {
  const out: Alternative[] = [];
  for (const s of spots) {
    if (s.spot_id === origin.spot_id || s.cat2 !== origin.cat2) continue;
    const c = congestion.get(s.spot_id);
    if (!c) continue;
    out.push({
      spot: s,
      congestion: c,
      distanceKm: Math.round(haversineKm(origin.lat, origin.lng, s.lat, s.lng) * 10) / 10,
    });
  }
  // 동일 cat2 내 수요압력 하위 30% → 비추정·저압력·근거리 우선
  out.sort((a, b) => a.congestion.pressure - b.congestion.pressure);
  const bottom = out.slice(0, Math.max(1, Math.round(out.length * 0.3)));
  bottom.sort(
    (a, b) =>
      Number(a.congestion.is_imputed) - Number(b.congestion.is_imputed) ||
      a.congestion.pressure - b.congestion.pressure ||
      a.distanceKm - b.distanceKm,
  );
  return bottom.slice(0, max);
}
