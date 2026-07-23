"use client";

import Image from "next/image";
import Link from "next/link";
import Script from "next/script";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { MAP_COACH } from "@/lib/coach";
import {
  HORIZON_END,
  HORIZON_START,
  HOUR_MAX,
  HOUR_MIN,
  LEVEL_COLOR,
  catLabel,
  cleanHours,
  spotDisplayName,
} from "@/lib/constants";
import type { KakaoCustomOverlay, KakaoMapObj } from "@/lib/kakao";
import { fetchCongestionClient, fetchSpotDayClient } from "@/lib/supabaseClient";
import type { Congestion, Spot } from "@/lib/types";
import { tapLight } from "@/lib/haptics";
import { CoachMark } from "./CoachMark";
import { LevelBadge, PressureBar } from "./LevelBadge";

const JEJU_CENTER = { lat: 33.37, lng: 126.53 };
// 제주 밖 현위치는 이동 대상이 아니다 (QuietNearby와 동일 기준)
const JEJU_BBOX = { minLat: 33.0, maxLat: 33.7, minLng: 126.0, maxLng: 127.1 };
const DEFAULT_LEVEL = 10;

type MapStatus = "loading" | "ready" | "failed";

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={() => {
        tapLight();
        onClick();
      }}
      className={`cursor-pointer rounded-full px-3 py-1.5 text-xs font-semibold shadow-card transition-colors ${
        active ? "bg-ink text-white" : "bg-surface/95 text-ink"
      }`}
    >
      {children}
    </button>
  );
}

export function MapView({
  spots,
  initialDate,
  initialHour,
}: {
  spots: Spot[];
  initialDate: string;
  initialHour: number;
}) {
  const [date, setDate] = useState(initialDate);
  const [hour, setHour] = useState(initialHour);
  const [congestion, setCongestion] = useState<Map<number, Congestion>>(new Map());
  const [status, setStatus] = useState<MapStatus>("loading");
  const [selected, setSelected] = useState<Spot | null>(null);
  const [showImputed, setShowImputed] = useState(false);
  const [calmOnly, setCalmOnly] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(DEFAULT_LEVEL);
  // 현위치 안내 토스트 (alert는 웹뷰를 얼리므로 금지)
  const [locMsg, setLocMsg] = useState<string | null>(null);
  const locMsgTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const myLocRef = useRef<KakaoCustomOverlay | null>(null);
  const zoomTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // 현재 지도에 붙어 있는 오버레이 — 보이는 마커만 부착해 팬·줌 재배치 비용을 줄인다
  const attachedRef = useRef(new Set<number>());

  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<KakaoMapObj | null>(null);
  const overlaysRef = useRef<Map<number, KakaoCustomOverlay>>(new Map());
  const [overlayNodes, setOverlayNodes] = useState<Map<number, HTMLDivElement> | null>(null);
  // 선택 스팟의 일중 혼잡 곡선 (spotId를 함께 저장해 스팟 전환 시 이전 곡선 오표시 방지)
  const [dayCurve, setDayCurve] = useState<{
    spotId: number;
    rows: (Congestion & { hour: number })[];
  } | null>(null);

  const jsKey = process.env.NEXT_PUBLIC_KAKAO_JS_KEY;
  // 상세 「지도에서 보기」 진입 — 서버 searchParams로 읽으면 라우트가 동적이 돼
  // ISR 캐시가 죽으므로(page는 Suspense로 감쌈) 클라이언트에서 읽는다
  const focusId = Number(useSearchParams().get("spot") ?? "");

  // 혼잡도 로드
  useEffect(() => {
    let cancelled = false;
    fetchCongestionClient(date, hour)
      .then((rows) => {
        if (!cancelled) setCongestion(new Map(rows.map((r) => [r.spot_id, r])));
      })
      .catch(() => {
        if (!cancelled) setCongestion(new Map());
      });
    return () => {
      cancelled = true;
    };
  }, [date, hour]);

  // Script onLoad와 마운트 체크 두 경로에서 불릴 수 있어 1회만 실행되게 잠근다
  const initedRef = useRef(false);
  const initMap = useCallback(() => {
    if (initedRef.current) return;
    initedRef.current = true;
    const kakao = window.kakao;
    const container = containerRef.current;
    if (!kakao || !container) {
      setStatus("failed");
      return;
    }
    kakao.maps.load(() => {
      const map = new kakao.maps.Map(container, {
        center: new kakao.maps.LatLng(JEJU_CENTER.lat, JEJU_CENTER.lng),
        level: 10,
      });
      mapRef.current = map;
      // 지도 배경 탭 = 상세 시트 닫기 (네이버 지도 관례)
      kakao.maps.event.addListener(map, "click", () => setSelected(null));
      // 줌 레벨 추적 — 핀치 중엔 레벨마다 발화해 리렌더 폭주하므로 멎은 뒤 1회만 반영
      kakao.maps.event.addListener(map, "zoom_changed", () => {
        if (zoomTimer.current) clearTimeout(zoomTimer.current);
        zoomTimer.current = setTimeout(() => setZoomLevel(map.getLevel()), 120);
      });
      // 오버레이는 만들어만 두고 지도엔 붙이지 않는다 — 802개 전부 붙이면 팬·줌마다
      // 카카오가 전 노드를 재배치해 버벅인다. 보이는 마커만 붙이는 동기화 이펙트가 담당
      const nodes = new Map<number, HTMLDivElement>();
      for (const spot of spots) {
        const node = document.createElement("div");
        const overlay = new kakao.maps.CustomOverlay({
          position: new kakao.maps.LatLng(spot.lat, spot.lng),
          content: node,
          yAnchor: 0.5,
          clickable: true,
        });
        overlaysRef.current.set(spot.spot_id, overlay);
        nodes.set(spot.spot_id, node);
      }
      setOverlayNodes(nodes);
      setStatus("ready");
      const focus = spots.find((s) => s.spot_id === focusId);
      if (focus) {
        map.setCenter(new kakao.maps.LatLng(focus.lat, focus.lng));
        map.setLevel(8);
        setSelected(focus);
      }
    });
  }, [spots, focusId]);

  // SDK가 이미 로드돼 있으면(상세 미니 지도·경로 모달 경유) 같은 src의 Script onLoad가
  // 다시 안 불린다 — 마운트 시점에 직접 초기화 (RouteView와 동일 방어)
  useEffect(() => {
    if (window.kakao) initMap();
  }, [initMap]);

  const selectedCongestion = selected ? congestion.get(selected.spot_id) : undefined;

  // 선택 스팟: 마커를 최상단으로 + 일중 혼잡 곡선 로드
  useEffect(() => {
    if (!selected) return;
    const overlay = overlaysRef.current.get(selected.spot_id);
    overlay?.setZIndex(10);
    let cancelled = false;
    fetchSpotDayClient(selected.spot_id, date)
      .then((rows) => {
        if (!cancelled) setDayCurve({ spotId: selected.spot_id, rows });
      })
      .catch(() => {
        if (!cancelled) setDayCurve(null);
      });
    return () => {
      cancelled = true;
      overlay?.setZIndex(0);
    };
  }, [selected, date]);

  // 필터(추정치·여유만)로 숨는 마커 판정 — 솎아내기 대표 선정과 렌더가 공유
  const isFiltered = useCallback(
    (c: Congestion | undefined) => {
      if (calmOnly) return !(c && c.level <= 2 && (!c.is_imputed || showImputed));
      return c ? c.is_imputed && !showImputed : false;
    },
    [calmOnly, showImputed],
  );

  // 줌아웃 상태 마커 솎아내기: 화면상 ~34px 격자당 대표 1개(높은 혼잡 우선 — 경고 가치).
  // 클러스터러는 혼잡도 4색 정보가 뭉개져서 쓰지 않는다. 줌인(≤8)하면 전체 표시.
  const visibleIds = useMemo(() => {
    if (zoomLevel <= 8) return null;
    // 레벨 10에서 실측 약 100m/px, 레벨당 2배 — 34px 격자를 위도(deg)로 환산
    const cellDeg = (34 * 100 * Math.pow(2, zoomLevel - 10)) / 111000;
    const best = new Map<string, { id: number; rank: number }>();
    for (const s of spots) {
      const c = congestion.get(s.spot_id);
      if (isFiltered(c)) continue;
      const key = `${Math.floor(s.lat / cellDeg)}:${Math.floor(s.lng / cellDeg)}`;
      const rank = c ? c.level * 1000 + c.pressure : -1;
      const prev = best.get(key);
      if (!prev || rank > prev.rank) best.set(key, { id: s.spot_id, rank });
    }
    return new Set([...best.values()].map((v) => v.id));
  }, [spots, congestion, zoomLevel, isFiltered]);

  // 이번 렌더에 실제로 보이는 마커 집합 — 포털 렌더와 오버레이 부착이 공유
  const visibleMarkers = useMemo(() => {
    const out = new Set<number>();
    for (const spot of spots) {
      const c = congestion.get(spot.spot_id);
      if (isFiltered(c)) continue;
      if (visibleIds !== null && !visibleIds.has(spot.spot_id)) continue;
      out.add(spot.spot_id);
    }
    if (selected) out.add(selected.spot_id);
    return out;
  }, [spots, congestion, isFiltered, visibleIds, selected]);

  // 보이는 마커만 지도에 부착 — 카카오는 붙은 오버레이 전부를 팬·줌마다 재배치하므로
  // 802개를 다 붙여두면 핀치가 버벅인다 (실기기 피드백)
  useEffect(() => {
    const map = mapRef.current;
    if (status !== "ready" || !map) return;
    for (const [id, overlay] of overlaysRef.current) {
      const show = visibleMarkers.has(id);
      const attached = attachedRef.current.has(id);
      if (show && !attached) {
        overlay.setMap(map);
        attachedRef.current.add(id);
      } else if (!show && attached) {
        overlay.setMap(null);
        attachedRef.current.delete(id);
      }
    }
  }, [visibleMarkers, status]);

  // 마커는 Kakao CustomOverlay 노드에 포털로 렌더 — 혼잡도 변경 시 색만 리렌더
  const markerPortals =
    overlayNodes &&
    spots.map((spot) => {
      const node = overlayNodes.get(spot.spot_id);
      if (!node) return null;
      const c = congestion.get(spot.spot_id);
      const isSelected = selected?.spot_id === spot.spot_id;
      const hidden = !visibleMarkers.has(spot.spot_id);
      const color = c ? (LEVEL_COLOR[c.level] ?? "#475569") : "#475569";
      const size = (c && c.level >= 3 ? 18 : 14) + (isSelected ? 8 : 0);
      return createPortal(
        hidden ? null : (
          <div style={{ position: "relative" }}>
            {/* 선택 마커 이름 라벨 — 경로 보기 출발·도착 라벨과 같은 문법 */}
            {isSelected ? (
              <span className="pointer-events-none absolute bottom-[calc(100%+7px)] left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-ink px-2.5 py-1 text-[11px] font-bold text-white shadow-card">
                {spotDisplayName(spot.name)}
              </span>
            ) : null}
            <button
              type="button"
              aria-label={spot.name}
              onClick={() => {
                tapLight();
                setSelected(spot);
              }}
              style={{
                width: size,
                height: size,
                borderRadius: 9999,
                border: isSelected ? "3px solid #ffffff" : "2px solid #ffffff",
                boxShadow: isSelected
                  ? `0 0 0 3px ${color}55, 0 2px 8px rgb(16 33 58 / 0.45)`
                  : "0 1px 4px rgb(16 33 58 / 0.35)",
                background: color,
                cursor: "pointer",
                display: "block",
                padding: 0,
                transition: "width 0.15s, height 0.15s, box-shadow 0.15s",
              }}
            />
          </div>
        ),
        node,
        `marker-${spot.spot_id}`,
      );
    });

  const showLocMsg = useCallback((msg: string) => {
    setLocMsg(msg);
    if (locMsgTimer.current) clearTimeout(locMsgTimer.current);
    locMsgTimer.current = setTimeout(() => setLocMsg(null), 2200);
  }, []);

  const locateMe = useCallback(() => {
    tapLight();
    const kakao = window.kakao;
    const map = mapRef.current;
    if (!navigator.geolocation || !kakao || !map) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude: lat, longitude: lng } = pos.coords;
        const inJeju =
          lat >= JEJU_BBOX.minLat &&
          lat <= JEJU_BBOX.maxLat &&
          lng >= JEJU_BBOX.minLng &&
          lng <= JEJU_BBOX.maxLng;
        if (!inJeju) {
          showLocMsg("현위치가 제주 밖이에요");
          return;
        }
        const pt = new kakao.maps.LatLng(lat, lng);
        if (!myLocRef.current) {
          const node = document.createElement("div");
          node.className =
            "h-3.5 w-3.5 rounded-full border-2 border-white bg-cta shadow-[0_0_0_6px_rgb(26_159_255/0.25)]";
          myLocRef.current = new kakao.maps.CustomOverlay({
            position: pt,
            content: node,
            yAnchor: 0.5,
            clickable: false,
          });
        } else {
          myLocRef.current.setPosition(pt);
        }
        myLocRef.current.setMap(map);
        map.setCenter(pt);
        map.setLevel(7);
      },
      () => showLocMsg("위치 권한을 확인해 주세요"),
      { timeout: 5000, maximumAge: 60_000 },
    );
  }, [showLocMsg]);

  const fallbackList = useMemo(() => {
    if (status !== "failed") return [];
    return spots
      .map((s) => ({ s, c: congestion.get(s.spot_id) }))
      .filter((x): x is { s: Spot; c: Congestion } => Boolean(x.c && (!x.c.is_imputed || showImputed)))
      .sort((a, b) => a.c.pressure - b.c.pressure)
      .slice(0, 30);
  }, [status, spots, congestion, showImputed]);

  return (
    <div className="relative h-[calc(100dvh-5rem)]">
      <CoachMark id="map" steps={MAP_COACH} />
      {jsKey ? (
        <Script
          src={`https://dapi.kakao.com/v2/maps/sdk.js?appkey=${jsKey}&autoload=false`}
          strategy="afterInteractive"
          onLoad={initMap}
          onError={() => setStatus("failed")}
        />
      ) : null}

      {/* 풀블리드 지도 (네이버·구글 문법) — 컨트롤은 전부 지도 위 플로팅 */}
      <div ref={containerRef} className="absolute inset-0" aria-label="제주 혼잡도 지도" role="application" />
      {markerPortals}

      <h1 className="sr-only">혼잡도 지도</h1>
      {/* 아이패드(md+)에선 컨트롤이 지도 전폭으로 늘어지지 않게 중앙 max-w-md 캡 */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-20 mx-auto max-w-md px-3 pt-[calc(env(safe-area-inset-top,0px)+0.625rem)]">
        <div className="pointer-events-auto flex items-center gap-3 rounded-card bg-surface/95 p-3 shadow-card">
          <label className="sr-only" htmlFor="map-date">
            날짜
          </label>
          <input
            id="map-date"
            type="date"
            value={date}
            min={HORIZON_START}
            max={HORIZON_END}
            onChange={(e) => setDate(e.target.value)}
            className="shrink-0 rounded-lg border border-line bg-bg px-2.5 py-1.5 text-base text-ink"
          />
          <div className="min-w-0 flex-1" data-coach="map-hour">
            <label htmlFor="map-hour" className="flex justify-between text-xs text-dim">
              <span>시간</span>
              <span className="font-semibold text-ink">{hour}시</span>
            </label>
            <input
              id="map-hour"
              type="range"
              min={HOUR_MIN}
              max={HOUR_MAX}
              step={1}
              value={hour}
              onChange={(e) => setHour(Number(e.target.value))}
              className="w-full accent-primary"
            />
          </div>
        </div>
        <div className="pointer-events-auto mt-2 flex items-center gap-1.5">
          {/* 기준 lv1~2 — lv1 배지명 "여유"와 혼동을 피해 홈과 같은 어휘를 쓴다 */}
          <FilterChip active={calmOnly} onClick={() => setCalmOnly((v) => !v)}>
            한적한 곳만
          </FilterChip>
          <FilterChip active={showImputed} onClick={() => setShowImputed((v) => !v)}>
            추정치 포함
          </FilterChip>
        </div>
      </div>

      {/* 범례 — 좌하단 플로팅 (시트가 열리면 그 뒤로 숨는다) */}
      <div
        className="absolute bottom-10 left-3 z-[5] flex items-center gap-2.5 rounded-full bg-surface/90 px-3 py-1.5 text-[11px] text-dim shadow-card"
        data-coach="map-legend"
        aria-hidden
      >
        {([1, 2, 3, 4] as const).map((lv) => (
          <span key={lv} className="flex items-center gap-1">
            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: LEVEL_COLOR[lv] }} />
            {lv === 1 ? "여유" : lv === 2 ? "보통" : lv === 3 ? "붐빔" : "혼잡"}
          </span>
        ))}
      </div>

      {/* 현위치 — 우하단 플로팅 */}
      <button
        type="button"
        onClick={locateMe}
        aria-label="내 위치로 이동"
        className="absolute bottom-10 right-3 z-[5] cursor-pointer rounded-full bg-surface p-3 text-ink shadow-card active:scale-95"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-5 w-5" aria-hidden>
          <path strokeLinecap="round" d="M12 2v3m0 14v3M2 12h3m14 0h3" />
          <path d="M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z" />
        </svg>
      </button>
      {locMsg ? (
        <div className="pointer-events-none absolute inset-x-0 bottom-24 z-20 flex justify-center">
          <span className="rounded-full bg-ink/85 px-3.5 py-1.5 text-xs font-medium text-white">
            {locMsg}
          </span>
        </div>
      ) : null}

      {status === "loading" ? (
        <div className="absolute inset-0 z-[5] flex items-center justify-center bg-surface">
          <p className="animate-pulse text-sm text-dim">지도를 불러오는 중…</p>
        </div>
      ) : null}
      {status === "failed" ? (
        <div className="absolute inset-0 z-[5] overflow-y-auto bg-bg px-5 pb-6 pt-[calc(env(safe-area-inset-top,0px)+8rem)]">
            <div className="mb-4 rounded-card border border-lv3/40 bg-lv3/10 p-4 text-sm leading-relaxed text-ink">
              지도를 불러오지 못했습니다. Kakao Developers에 현재 도메인이 등록되어 있어야
              지도가 표시됩니다. 아래 리스트로 혼잡도를 확인하세요.
            </div>
            <ul className="space-y-2">
              {fallbackList.map(({ s, c }) => (
                <li key={s.spot_id}>
                  <Link
                    href={`/spots/${s.spot_id}`}
                    className="flex items-center justify-between rounded-card border border-line bg-card p-3"
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold text-ink">
                        {spotDisplayName(s.name)}
                      </span>
                      <span className="text-xs text-dim">
                        {s.region} · {catLabel(s.cat2)}
                      </span>
                    </span>
                    <LevelBadge level={c.level} imputed={c.is_imputed} />
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {selected ? (
          <section
            aria-label={`${selected.name} 상세 정보`}
            className="absolute inset-x-0 bottom-0 z-10 mx-auto max-w-full animate-sheet-up overflow-hidden rounded-t-3xl border-t border-line bg-surface shadow-[0_-8px_30px_rgb(16_33_58_/_0.12)] md:max-w-xl md:border-x"
          >
            {/* 사진 배경 헤더 — 상세 히어로와 동일 문법: 실사진 + 스크림 + 흰 글씨 */}
            <div
              className={`relative h-40 w-full ${
                selected.image_url ? "" : "bg-gradient-to-br from-primary to-cta"
              }`}
            >
              {selected.image_url ? (
                <Image
                  src={selected.image_url}
                  alt=""
                  fill
                  sizes="(max-width: 640px) 100vw, 576px"
                  className="object-cover"
                  unoptimized={selected.image_url.endsWith(".bmp")}
                />
              ) : null}
              <div className="absolute inset-0 bg-gradient-to-b from-black/35 via-black/15 to-black/70" />
              <div className="absolute inset-x-0 top-2.5 flex justify-center" aria-hidden>
                <div className="h-1 w-9 rounded-full bg-white/60" />
              </div>
              <button
                type="button"
                onClick={() => setSelected(null)}
                aria-label="닫기"
                className="absolute right-3 top-3 cursor-pointer rounded-full bg-black/30 p-1.5 text-white backdrop-blur hover:bg-black/50"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-4.5 w-4.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                </svg>
              </button>
              <div className="absolute inset-x-0 bottom-0 px-5 pb-3">
                <p className="truncate text-xl font-bold text-white [text-shadow:0_1px_6px_rgb(0_0_0/0.35)]">
                  {spotDisplayName(selected.name)}
                </p>
                <p className="text-xs font-medium text-white/85">
                  {catLabel(selected.cat2)} · {selected.region}
                </p>
                {selected.addr ? (
                  <p className="mt-0.5 truncate text-xs text-white/75">{selected.addr}</p>
                ) : null}
                {selected.opening_hours ? (
                  <p className="mt-0.5 truncate text-xs text-white/75">
                    🕐 {cleanHours(selected.opening_hours)}
                  </p>
                ) : null}
              </div>
            </div>

            <div className="max-h-[36dvh] overflow-y-auto px-5 pb-5 pt-4">
              <div className="rounded-2xl bg-bg p-3.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-dim">
                    {date.slice(5).replace("-", ".")} {hour}시 예측 혼잡도
                  </span>
                  {selectedCongestion ? (
                    <LevelBadge
                      level={selectedCongestion.level}
                      imputed={selectedCongestion.is_imputed}
                    />
                  ) : (
                    <span className="text-xs text-dim">데이터 없음</span>
                  )}
                </div>
                {selectedCongestion ? (
                  <div className="mt-2.5">
                    <PressureBar
                      pressure={selectedCongestion.pressure}
                      level={selectedCongestion.level}
                    />
                  </div>
                ) : null}

                {dayCurve && dayCurve.spotId === selected.spot_id && dayCurve.rows.length > 0 ? (
                  <div className="mt-3.5">
                    <p className="mb-1.5 text-[11px] text-dim">시간대별 (9~20시)</p>
                    <div className="flex h-10 items-end gap-1" aria-hidden>
                      {dayCurve.rows.map((r) => (
                        <button
                          key={r.hour}
                          type="button"
                          tabIndex={-1}
                          onClick={() => setHour(r.hour)}
                          className="flex-1 cursor-pointer rounded-t-sm"
                          style={{
                            height: `${Math.max(8, r.pressure)}%`,
                            backgroundColor: LEVEL_COLOR[r.level] ?? "#475569",
                            opacity: r.hour === hour ? 1 : 0.35,
                          }}
                        />
                      ))}
                    </div>
                    <div className="mt-1 flex justify-between text-[10px] text-dim" aria-hidden>
                      <span>9시</span>
                      <span>14시</span>
                      <span>20시</span>
                    </div>
                  </div>
                ) : null}
              </div>

              <div className="mt-4 flex gap-2.5">
                <Link
                  href={`/spots/${selected.spot_id}`}
                  className="flex-1 rounded-xl bg-cta py-3 text-center text-sm font-bold text-on-cta"
                >
                  상세 · 대안 보기
                </Link>
                <a
                  href={`https://map.kakao.com/link/to/${encodeURIComponent(selected.name)},${selected.lat},${selected.lng}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-xl border border-line bg-card px-4 py-3 text-sm font-semibold text-ink"
                >
                  길찾기
                </a>
              </div>
            </div>
          </section>
        ) : null}
    </div>
  );
}
