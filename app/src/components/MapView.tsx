"use client";

import Image from "next/image";
import Link from "next/link";
import Script from "next/script";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  HORIZON_END,
  HORIZON_START,
  HOUR_MAX,
  HOUR_MIN,
  LEVEL_COLOR,
  catLabel,
  cleanHours,
} from "@/lib/constants";
import type { KakaoCustomOverlay, KakaoMapObj } from "@/lib/kakao";
import { fetchCongestionClient, fetchSpotDayClient } from "@/lib/supabaseClient";
import type { Congestion, Spot } from "@/lib/types";
import { LevelBadge, PressureBar } from "./LevelBadge";

const JEJU_CENTER = { lat: 33.37, lng: 126.53 };

type MapStatus = "loading" | "ready" | "failed";

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

  const initMap = useCallback(() => {
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
      const nodes = new Map<number, HTMLDivElement>();
      for (const spot of spots) {
        const node = document.createElement("div");
        const overlay = new kakao.maps.CustomOverlay({
          position: new kakao.maps.LatLng(spot.lat, spot.lng),
          content: node,
          yAnchor: 0.5,
          clickable: true,
        });
        overlay.setMap(map);
        overlaysRef.current.set(spot.spot_id, overlay);
        nodes.set(spot.spot_id, node);
      }
      setOverlayNodes(nodes);
      setStatus("ready");
    });
  }, [spots]);

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

  // 마커는 Kakao CustomOverlay 노드에 포털로 렌더 — 혼잡도 변경 시 색만 리렌더
  const markerPortals =
    overlayNodes &&
    spots.map((spot) => {
      const node = overlayNodes.get(spot.spot_id);
      if (!node) return null;
      const c = congestion.get(spot.spot_id);
      const hidden = c ? c.is_imputed && !showImputed : false;
      const color = c ? (LEVEL_COLOR[c.level] ?? "#475569") : "#475569";
      const isSelected = selected?.spot_id === spot.spot_id;
      const size = (c && c.level >= 3 ? 18 : 14) + (isSelected ? 8 : 0);
      return createPortal(
        hidden ? null : (
          <button
            type="button"
            aria-label={spot.name}
            onClick={() => setSelected(spot)}
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
        ),
        node,
        `marker-${spot.spot_id}`,
      );
    });

  const fallbackList = useMemo(() => {
    if (status !== "failed") return [];
    return spots
      .map((s) => ({ s, c: congestion.get(s.spot_id) }))
      .filter((x): x is { s: Spot; c: Congestion } => Boolean(x.c && (!x.c.is_imputed || showImputed)))
      .sort((a, b) => a.c.pressure - b.c.pressure)
      .slice(0, 30);
  }, [status, spots, congestion, showImputed]);

  return (
    <div className="relative flex min-h-[calc(100dvh-5rem)] flex-col">
      {jsKey ? (
        <Script
          src={`https://dapi.kakao.com/v2/maps/sdk.js?appkey=${jsKey}&autoload=false`}
          strategy="afterInteractive"
          onLoad={initMap}
          onError={() => setStatus("failed")}
        />
      ) : null}

      <header className="space-y-3 bg-surface px-5 pb-3 pt-12 shadow-card">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-ink">혼잡도 지도</h1>
          <label className="flex cursor-pointer items-center gap-2 text-xs text-dim">
            <input
              type="checkbox"
              checked={showImputed}
              onChange={(e) => setShowImputed(e.target.checked)}
              className="h-4 w-4 accent-primary"
            />
            추정치 포함
          </label>
        </div>
        <div className="flex items-center gap-3">
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
            className="rounded-lg border border-line bg-card px-3 py-2 text-sm text-ink shadow-card"
          />
          <div className="flex-1">
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
        <div className="flex items-center gap-3 text-[11px] text-dim" aria-hidden>
          {([1, 2, 3, 4] as const).map((lv) => (
            <span key={lv} className="flex items-center gap-1">
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: LEVEL_COLOR[lv] }} />
              {lv === 1 ? "여유" : lv === 2 ? "보통" : lv === 3 ? "붐빔" : "혼잡"}
            </span>
          ))}
        </div>
      </header>

      <div className="relative flex-1">
        <div ref={containerRef} className="absolute inset-0" aria-label="제주 혼잡도 지도" role="application" />
        {markerPortals}
        {status === "loading" ? (
          <div className="absolute inset-0 flex items-center justify-center bg-surface">
            <p className="animate-pulse text-sm text-dim">지도를 불러오는 중…</p>
          </div>
        ) : null}
        {status === "failed" ? (
          <div className="absolute inset-0 overflow-y-auto bg-bg px-5 pb-6">
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
                      <span className="block truncate text-sm font-semibold text-ink">{s.name}</span>
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
            className="absolute inset-x-0 bottom-0 z-10 animate-sheet-up rounded-t-3xl border-t border-line bg-surface shadow-[0_-8px_30px_rgb(16_33_58_/_0.12)]"
          >
            <div className="mx-auto mt-2.5 h-1 w-9 rounded-full bg-line" aria-hidden />
            <div className="max-h-[46dvh] overflow-y-auto px-5 pb-5 pt-3">
              <div className="flex items-start gap-3.5">
                {selected.image_url ? (
                  <div className="relative h-[4.5rem] w-[4.5rem] shrink-0 overflow-hidden rounded-2xl">
                    <Image
                      src={selected.image_url}
                      alt=""
                      fill
                      sizes="72px"
                      className="object-cover"
                      unoptimized={selected.image_url.endsWith(".bmp")}
                    />
                  </div>
                ) : null}
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <p className="truncate text-lg font-bold text-ink">{selected.name}</p>
                    <button
                      type="button"
                      onClick={() => setSelected(null)}
                      aria-label="닫기"
                      className="-mr-1 -mt-0.5 shrink-0 cursor-pointer rounded-full p-1 text-dim hover:text-ink"
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-5 w-5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                  <p className="text-xs font-medium text-primary">
                    {catLabel(selected.cat2)} <span className="text-dim">· {selected.region}</span>
                  </p>
                  {selected.addr ? (
                    <p className="mt-1 truncate text-xs text-dim">{selected.addr}</p>
                  ) : null}
                  {selected.opening_hours ? (
                    <p className="mt-0.5 truncate text-xs text-dim">
                      🕐 {cleanHours(selected.opening_hours)}
                    </p>
                  ) : null}
                </div>
              </div>

              <div className="mt-4 rounded-2xl bg-bg p-3.5">
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
    </div>
  );
}
