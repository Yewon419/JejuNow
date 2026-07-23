"use client";

import Script from "next/script";
import { useCallback, useEffect, useRef, useState } from "react";
import { type RouteData, fetchRoute, formatDuration, routeCoord } from "@/lib/api";
import { haversineKm } from "@/lib/alternatives";
import { spotDisplayName } from "@/lib/constants";
import { tapLight } from "@/lib/haptics";
import type { Spot } from "@/lib/types";

type Status = "loading" | "ready" | "failed";
type FailReason = "offroad" | "error";
// 구글맵식 이동수단 탭 — 인앱 실경로는 자동차만(카카오내비 API가 자동차 전용).
// 도보는 직선 기반 추정 표시, 대중교통은 카카오맵으로 연결(공개 API 없음)
type TravelMode = "car" | "foot" | "transit";

const MODE_LABEL: Record<TravelMode, string> = {
  car: "자동차",
  foot: "도보",
  transit: "대중교통",
};
const MODE_SCHEME: Record<TravelMode, string> = {
  car: "CAR",
  foot: "FOOT",
  transit: "PUBLICTRANSIT",
};
const MODE_ICON: Record<TravelMode, React.ReactNode> = {
  car: (
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M3.5 13.5 5 9a2 2 0 0 1 1.9-1.4h10.2A2 2 0 0 1 19 9l1.5 4.5M4.5 13.5h15a1 1 0 0 1 1 1V18h-2.25a1.75 1.75 0 1 1-3.5 0h-5.5a1.75 1.75 0 1 1-3.5 0H3.5v-3.5a1 1 0 0 1 1-1Z"
    />
  ),
  foot: (
    <>
      <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.75a1.25 1.25 0 1 1-2.5 0 1.25 1.25 0 0 1 2.5 0Z" />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 7.5 9.75 13l-1.5 6M9.75 13l3.75 1.5.75 5M10.25 10 7.5 11.5M12.5 8.5l2.75 1.75 1.75-.75"
      />
    </>
  ),
  transit: (
    <>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M5 4.5h14a1 1 0 0 1 1 1V16a2 2 0 0 1-2 2h-.25a1.75 1.75 0 1 1-3.5 0h-4.5a1.75 1.75 0 1 1-3.5 0H6a2 2 0 0 1-2-2V5.5a1 1 0 0 1 1-1Z"
      />
      <path strokeLinecap="round" d="M4 10.5h16" />
    </>
  ),
};

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
  const [failReason, setFailReason] = useState<FailReason>("error");
  const [mode, setMode] = useState<TravelMode>("car");
  const containerRef = useRef<HTMLDivElement>(null);
  // 경로 실패 시 참고용 직선거리(좌표만으로 계산 — 서버 무관)
  const straightKm = haversineKm(from.lat, from.lng, to.lat, to.lng);
  // SDK가 이미 로드돼 있으면(지도 페이지 방문 후) Script onLoad가 다시 안 불린다
  const [sdkReady, setSdkReady] = useState(
    () => typeof window !== "undefined" && Boolean(window.kakao),
  );

  const jsKey = process.env.NEXT_PUBLIC_KAKAO_JS_KEY;
  const externalUrl = `https://map.kakao.com/link/from/${encodeURIComponent(from.name)},${from.lat},${from.lng}/to/${encodeURIComponent(to.name)},${to.lat},${to.lng}`;

  // 경로 조회
  useEffect(() => {
    let cancelled = false;
    fetchRoute(from, to).then((r) => {
      if (cancelled) return;
      if (!r.ok) {
        setFailReason(r.reason);
        setStatus("failed");
        return;
      }
      setRoute(r.data);
    });
    return () => {
      cancelled = true;
    };
  }, [from, to]);

  // SDK + (자동차면 경로까지) 준비되면 지도에 그린다.
  // 도보·대중교통은 실경로 API가 없어 직선 점선으로 방향만 보여준다
  const drawMap = useCallback(() => {
    const kakao = window.kakao;
    const container = containerRef.current;
    if (!kakao || !container) return;
    if (mode === "car" && !route) return;
    kakao.maps.load(() => {
      // 폴리라인이 도로 접근점(주차장) 기준이라 지도 중심·라벨도 route 좌표로 맞춘다
      const fc = routeCoord(from);
      const tc = routeCoord(to);
      const center = new kakao.maps.LatLng(
        (fc.lat + tc.lat) / 2,
        (fc.lng + tc.lng) / 2,
      );
      const map = new kakao.maps.Map(container, { center, level: 9 });
      const path =
        mode === "car" && route
          ? route.path.map(([lat, lng]) => new kakao.maps.LatLng(lat, lng))
          : [new kakao.maps.LatLng(fc.lat, fc.lng), new kakao.maps.LatLng(tc.lat, tc.lng)];
      new kakao.maps.Polyline({
        map,
        path,
        strokeWeight: mode === "car" ? 5 : 4,
        strokeColor: "#0e7d8c",
        strokeOpacity: mode === "car" ? 0.9 : 0.65,
        strokeStyle: mode === "car" ? "solid" : "shortdash",
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
        node.textContent = `${label} · ${spotDisplayName(spot.name)}`;
        node.style.cssText =
          `background:${color};color:#fff;font-size:11px;font-weight:700;` +
          "padding:4px 10px;border-radius:9999px;box-shadow:0 1px 4px rgb(16 33 58/.4);" +
          "white-space:nowrap;max-width:180px;overflow:hidden;text-overflow:ellipsis;";
        const pc = routeCoord(spot);
        new kakao.maps.CustomOverlay({
          position: new kakao.maps.LatLng(pc.lat, pc.lng),
          content: node,
          yAnchor: 1.4,
          clickable: false,
        }).setMap(map);
      }
      setStatus("ready");
    });
  }, [route, from, to, mode]);

  useEffect(() => {
    if (!sdkReady) return;
    if (mode === "car" && !route) return;
    drawMap();
  }, [sdkReady, route, mode, drawMap]);

  // 카카오맵 앱 딥링크(모드 반영) — 앱이 없으면 1.4초 뒤 웹 링크 폴백
  function openKakaoMap() {
    const fc = routeCoord(from);
    const tc = routeCoord(to);
    const appUrl = `kakaomap://route?sp=${fc.lat},${fc.lng}&ep=${tc.lat},${tc.lng}&by=${MODE_SCHEME[mode]}`;
    const timer = setTimeout(() => window.open(externalUrl, "_blank", "noopener"), 1400);
    window.addEventListener("pagehide", () => clearTimeout(timer), { once: true });
    document.addEventListener(
      "visibilitychange",
      () => {
        if (document.hidden) clearTimeout(timer);
      },
      { once: true },
    );
    window.location.href = appUrl;
  }

  const footKm = Math.round(straightKm * 1.3 * 10) / 10; // 직선 × 도로 우회 보정
  const footMin = Math.max(1, Math.round((footKm / 4) * 60)); // 4km/h

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60"
      role="dialog"
      aria-modal="true"
      aria-label={`${spotDisplayName(from.name)}에서 ${spotDisplayName(to.name)}까지 경로`}
    >
      {jsKey ? (
        <Script
          src={`https://dapi.kakao.com/v2/maps/sdk.js?appkey=${jsKey}&autoload=false`}
          strategy="afterInteractive"
          onLoad={() => setSdkReady(true)}
          onError={() => {
            setFailReason("error");
            setStatus("failed");
          }}
        />
      ) : null}
      {/* viewport-fit=cover라 하단 시트는 홈 인디케이터 높이만큼 직접 띄운다 */}
      <div
        className="w-full max-w-md overflow-hidden rounded-t-3xl border-t border-line bg-surface md:max-w-xl"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <div className="flex items-center justify-between gap-3 px-5 pb-3 pt-4">
          <p className="min-w-0 truncate text-sm font-bold text-ink">
            {spotDisplayName(from.name)} <span className="text-dim">→</span>{" "}
            {spotDisplayName(to.name)}
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

        {/* 구글맵식 이동수단 탭 */}
        <div className="flex gap-1.5 px-5 pb-3">
          {(["car", "foot", "transit"] as const).map((m) => (
            <button
              key={m}
              type="button"
              aria-pressed={mode === m}
              onClick={() => {
                tapLight();
                setMode(m);
              }}
              className={`flex cursor-pointer items-center gap-1.5 rounded-full px-3.5 py-2 text-xs font-semibold transition-colors ${
                mode === m ? "bg-ink text-white" : "bg-card text-ink shadow-card"
              }`}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} className="h-4 w-4" aria-hidden>
                {MODE_ICON[m]}
              </svg>
              {MODE_LABEL[m]}
            </button>
          ))}
        </div>

        <div className="relative h-80 w-full bg-line">
          <div ref={containerRef} className="absolute inset-0" aria-label="경로 지도" />
          {mode === "car" && status === "loading" ? (
            <div className="absolute inset-0 flex items-center justify-center bg-surface">
              <p className="animate-pulse text-sm text-dim">경로를 불러오는 중…</p>
            </div>
          ) : null}
          {mode === "car" && status === "failed" ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-surface px-6 text-center">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={1.5}
                className="h-9 w-9 text-dim/50"
                aria-hidden
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9 20l-5.447-2.724A1 1 0 0 1 3 16.382V5.618a1 1 0 0 1 1.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0 0 21 18.382V7.618a1 1 0 0 0-.553-.894L15 4m0 13V4m0 0L9 7"
                />
              </svg>
              <p className="text-sm text-dim">
                {failReason === "offroad" ? (
                  <>
                    출발·도착 중 한 곳이 도보·자연 구간이라
                    <br />
                    앱 지도에 경로를 그릴 수 없어요.
                    <br />
                    카카오맵에서 실제 길을 확인하세요.
                  </>
                ) : (
                  <>
                    경로를 잠시 불러오지 못했어요.
                    <br />
                    다시 시도하거나 카카오맵에서 확인하세요.
                  </>
                )}
              </p>
            </div>
          ) : null}
        </div>

        <div className="flex items-center justify-between gap-3 px-5 py-4">
          {mode === "car" ? (
            route ? (
              <p className="text-sm text-ink">
                <span className="font-bold">{(route.distance_m / 1000).toFixed(1)}km</span>
                <span className="text-dim"> · 약 </span>
                <span className="font-bold">{formatDuration(route.duration_s)}</span>
                <span className="text-dim"> (자동차)</span>
              </p>
            ) : status === "failed" ? (
              <p className="text-sm text-dim">
                직선거리 <span className="font-bold text-ink">약 {straightKm.toFixed(1)}km</span>
              </p>
            ) : (
              <span className="text-sm text-dim">자동차 경로</span>
            )
          ) : mode === "foot" ? (
            <p className="text-sm text-ink">
              <span className="font-bold">약 {footKm.toFixed(1)}km</span>
              <span className="text-dim"> · 도보 약 </span>
              <span className="font-bold">{formatDuration(footMin * 60)}</span>
              <span className="text-dim"> · 직선 기반 추정</span>
            </p>
          ) : (
            <p className="text-sm text-dim">경로·시간은 카카오맵에서 확인해요</p>
          )}
          <button
            type="button"
            onClick={openKakaoMap}
            className="shrink-0 cursor-pointer rounded-xl border border-line bg-card px-4 py-2.5 text-sm font-semibold text-ink"
          >
            카카오맵에서 열기
          </button>
        </div>
      </div>
    </div>
  );
}
