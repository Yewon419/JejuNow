"use client";

import Link from "next/link";
import Script from "next/script";
import { useCallback, useEffect, useRef, useState } from "react";

/** 위치 미니 지도 (Airbnb "호스팅 지역" 문법) — StaticMap이라 스크롤 중 제스처 충돌 없음.
 *  탭하면 지도 탭으로 이동해 이 스팟을 포커스한다. */
export function SpotMiniMap({
  spotId,
  lat,
  lng,
  addr,
}: {
  spotId: number;
  lat: number;
  lng: number;
  addr: string | null;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);
  const jsKey = process.env.NEXT_PUBLIC_KAKAO_JS_KEY;

  // Script onLoad와 마운트 체크 두 경로에서 불릴 수 있어 1회만 그린다
  const drawnRef = useRef(false);
  const draw = useCallback(() => {
    if (drawnRef.current) return;
    drawnRef.current = true;
    const kakao = window.kakao;
    const container = containerRef.current;
    if (!kakao || !container) {
      setFailed(true);
      return;
    }
    kakao.maps.load(() => {
      const center = new kakao.maps.LatLng(lat, lng);
      new kakao.maps.StaticMap(container, { center, level: 6, marker: { position: center } });
    });
  }, [lat, lng]);

  // SDK가 이미 로드돼 있으면(지도 탭 경유 진입) 같은 src의 Script onLoad가 다시 안 불린다
  useEffect(() => {
    if (window.kakao) draw();
  }, [draw]);

  if (!jsKey || failed) return null;

  return (
    <section aria-labelledby="location-heading">
      <h2 id="location-heading" className="mb-1 text-lg font-bold text-ink">
        위치
      </h2>
      {addr ? <p className="mb-4 text-xs text-dim">{addr}</p> : <div className="mb-4" />}
      <Script
        src={`https://dapi.kakao.com/v2/maps/sdk.js?appkey=${jsKey}&autoload=false`}
        strategy="afterInteractive"
        onLoad={draw}
        onError={() => setFailed(true)}
      />
      <Link
        href={`/map?spot=${spotId}`}
        aria-label="지도에서 보기"
        className="relative block overflow-hidden rounded-card shadow-card transition-transform active:scale-[0.99]"
      >
        <div ref={containerRef} className="h-44 w-full bg-line" aria-hidden />
        <span className="absolute bottom-3 right-3 rounded-full bg-surface px-3 py-1.5 text-xs font-bold text-ink shadow-card">
          지도에서 보기
        </span>
      </Link>
    </section>
  );
}
