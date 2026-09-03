"use client";

import { useEffect, useState } from "react";
import { SpotInfoCard } from "@/components/SpotInfoCard";
import { SpotOverview } from "@/components/SpotOverview";

// 상세 정보(개요·전화·홈페이지)는 먼저 DB 값(주간 동기화)으로 그리고, 마운트 후 TourAPI를
// 실시간 호출(/api/tour-detail)해 원천 값이 있으면 덮어쓴다. 호출 실패·타임아웃이면 DB 값 유지.
const TIMEOUT_MS = 6000;

type Detail = {
  overview: string | null;
  tel: string | null;
  homepage: string | null;
};

function asRecord(v: unknown): Record<string, unknown> | null {
  return typeof v === "object" && v !== null ? (v as Record<string, unknown>) : null;
}

function strOrNull(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v : null;
}

export function SpotLiveDetail({
  contentId,
  hours,
  addr,
  initial,
}: {
  contentId: string | null;
  hours: string | null;
  addr: string | null;
  initial: Detail;
}) {
  const [detail, setDetail] = useState<Detail>(initial);

  useEffect(() => {
    if (!contentId) return;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    fetch(`/api/tour-detail?contentId=${encodeURIComponent(contentId)}`, {
      signal: controller.signal,
    })
      .then(async (res) => {
        if (!res.ok) return;
        const live = asRecord(await res.json());
        if (!live) return;
        setDetail((prev) => ({
          overview: strOrNull(live.overview) ?? prev.overview,
          tel: strOrNull(live.tel) ?? prev.tel,
          homepage: strOrNull(live.homepage) ?? prev.homepage,
        }));
      })
      .catch(() => {
        // 실패 시 DB 값 유지 — 사용자에게 오류를 보이지 않는다
      })
      .finally(() => clearTimeout(timer));
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [contentId]);

  return (
    <>
      <SpotInfoCard hours={hours} tel={detail.tel} addr={addr} homepage={detail.homepage} />
      {detail.overview ? <SpotOverview text={detail.overview} /> : null}
    </>
  );
}
