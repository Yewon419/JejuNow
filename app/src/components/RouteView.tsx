"use client";

import Script from "next/script";
import { useCallback, useEffect, useRef, useState } from "react";
import { type RouteData, fetchRoute } from "@/lib/api";
import type { Spot } from "@/lib/types";

type Status = "loading" | "ready" | "failed";

/** 두 슬롯 간 자동차 경로를 앱 안에서 표시 — 카카오내비 API 경로를 우리 지도에 그린다.
 *  API 실패(콜드스타트·도로 밖 좌표 등) 시 외부 카카오맵 길찾기 링크로 폴백. */
export function RouteView({
  from,
  to,
  onClose,
}: {
  from: Spot;
  to: Spot;
  onClose: () => void;
}) {
  const [status, setStatus] = useState<Status>("loading");
  const [route, setRoute] = useState<RouteData | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  // SDK가 이미 로드돼 있으면(지도 페이지 방문 후) Script onLoad가 다시 안 불린다
  const [sdkReady, setSdkReady] = useState(
    () => typeof window !== "undefined" && Boolean(window.kakao),
  );

  const jsKey = process.env.NEXT_PUBLIC_KAKAO_JS_KEY;
  const externalUrl = `https://map.kakao.com/link/from/${encodeURIComponent(from.name)},${from.lat},${from.lng}/to/${encodeURIComponent(to.name)},${to.lat},${to.lng}`;

  // 경로 조회
  useEffect(() => {
    let cancelled = false;
    fetchRoute(from.spot_id, to.spot_id).then((r) => {
      if (cancelled) return;
      if (!r) {
        setStatus("failed");
        return;
      }
      setRoute(r);
    });
    return () => {
      cancelled = true;
    };
  }, [from.spot_id, to.spot_id]);

  // SDK + 경로가 모두 준비되면 지도에 그린다
  const drawMap = useCallback(() => {
    const kakao = window.kakao;
    const container = containerRef.current;
    if (!kakao || !container || !route) return;
    kakao.maps.load(() => {
      const center = new kakao.maps.LatLng(
        (from.lat + to.lat) / 2,
        (from.lng + to.lng) / 2,
      );
      const map = new kakao.maps.Map(container, { center, level: 9 });
      const path = route.path.map(([lat, lng]) => new kakao.maps.LatLng(lat, lng));
      new kakao.maps.Polyline({
        map,
        path,
        strokeWeight: 5,
        strokeColor: "#0e7d8c",
        strokeOpacity: 0.9,
      });
      const bounds = new kakao.maps.LatLngBounds();
      for (const p of path) bounds.extend(p);
      map.setBounds(bounds);
      // 출발·도착 라벨
      for (const [label, spot, color] of [
        ["출발", from, "#16213a"],
        ["도착", to, "#0e7d8c"],
      ] as const) {
        const node = document.createElement("div");
        node.textContent = `${label} · ${spot.name}`;
        node.style.cssText =
          `background:${color};color:#fff;font-size:11px;font-weight:700;` +
          "padding:4px 10px;border-radius:9999px;box-shadow:0 1px 4px rgb(16 33 58/.4);" +
          "white-space:nowrap;max-width:180px;overflow:hidden;text-overflow:ellipsis;";
        new kakao.maps.CustomOverlay({
          position: new kakao.maps.LatLng(spot.lat, spot.lng),
          content: node,
          yAnchor: 1.4,
          clickable: false,
        }).setMap(map);
      }
      setStatus("ready");
    });
  }, [route, from, to]);

  useEffect(() => {
    if (sdkReady && route) drawMap();
  }, [sdkReady, route, drawMap]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60"
      role="dialog"
      aria-modal="true"
      aria-label={`${from.name}에서 ${to.name}까지 경로`}
    >
      {jsKey ? (
        <Script
          src={`https://dapi.kakao.com/v2/maps/sdk.js?appkey=${jsKey}&autoload=false`}
          strategy="afterInteractive"
          onLoad={() => setSdkReady(true)}
          onError={() => setStatus("failed")}
        />
      ) : null}
      <div className="w-full max-w-md overflow-hidden rounded-t-3xl border-t border-line bg-surface">
        <div className="flex items-center justify-between gap-3 px-5 pb-3 pt-4">
          <p className="min-w-0 truncate text-sm font-bold text-ink">
            {from.name} <span className="text-dim">→</span> {to.name}
          </p>
          <button
            type="button"
            onClick={onClose}
            aria-label="닫기"
            className="shrink-0 cursor-pointer rounded-full p-1.5 text-dim hover:text-ink"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-5 w-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="relative h-80 w-full bg-line">
          <div ref={containerRef} className="absolute inset-0" aria-label="경로 지도" />
          {status === "loading" ? (
            <div className="absolute inset-0 flex items-center justify-center bg-surface">
              <p className="animate-pulse text-sm text-dim">경로를 불러오는 중…</p>
            </div>
          ) : null}
          {status === "failed" ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-surface px-6 text-center">
              <p className="text-sm text-dim">
                앱 안에서 경로를 불러오지 못했어요.
                <br />
                카카오맵에서 바로 확인할 수 있어요.
              </p>
            </div>
          ) : null}
        </div>

        <div className="flex items-center justify-between gap-3 px-5 py-4">
          {route ? (
            <p className="text-sm text-ink">
              <span className="font-bold">{(route.distance_m / 1000).toFixed(1)}km</span>
              <span className="text-dim"> · 약 </span>
              <span className="font-bold">{Math.max(1, Math.round(route.duration_s / 60))}분</span>
              <span className="text-dim"> (자동차)</span>
            </p>
          ) : (
            <span className="text-sm text-dim">자동차 경로</span>
          )}
          <a
            href={externalUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 rounded-xl border border-line bg-card px-4 py-2.5 text-sm font-semibold text-ink"
          >
            카카오맵에서 열기
          </a>
        </div>
      </div>
    </div>
  );
}
