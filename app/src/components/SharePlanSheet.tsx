"use client";

import QRCode from "qrcode";
import { useEffect, useMemo, useState } from "react";
import { tapLight } from "@/lib/haptics";
import { type SharedPlan, encodePlan } from "@/lib/planShare";

export function SharePlanSheet({ plan, onClose }: { plan: SharedPlan; onClose: () => void }) {
  const [qr, setQr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // 링크는 prop 파생 — 렌더 중 계산 (이펙트 setState 회피)
  const url = useMemo(() => {
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    return `${origin}/p?d=${encodePlan(plan)}`;
  }, [plan]);

  // QR 생성은 비동기라 이펙트에서 (setState는 콜백 안 — 동기 호출 아님)
  useEffect(() => {
    let cancelled = false;
    QRCode.toDataURL(url, {
      margin: 2,
      width: 480,
      color: { dark: "#16213a", light: "#ffffff" },
    })
      .then((dataUrl) => {
        if (!cancelled) setQr(dataUrl);
      })
      .catch(() => {
        if (!cancelled) setQr(null);
      });
    return () => {
      cancelled = true;
    };
  }, [url]);

  async function copy() {
    tapLight();
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // 클립보드 불가 환경 — 사용자가 직접 선택 복사
    }
  }

  async function nativeShare() {
    tapLight();
    try {
      if (typeof navigator !== "undefined" && navigator.share) {
        await navigator.share({ title: plan.name, text: `${plan.name} 여행 계획`, url });
      }
    } catch {
      // 취소·미지원 — 무시
    }
  }

  const canNativeShare = typeof navigator !== "undefined" && typeof navigator.share === "function";

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60"
      role="dialog"
      aria-modal="true"
      aria-label="계획 공유"
    >
      <div
        className="max-h-[85dvh] w-full max-w-md overflow-y-auto rounded-t-3xl border-t border-line bg-surface p-5 md:max-w-xl"
        style={{ paddingBottom: "calc(1.25rem + env(safe-area-inset-bottom))" }}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-ink">계획 공유</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="닫기"
            className="cursor-pointer rounded-full p-1.5 text-dim hover:text-ink"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-5 w-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <p className="text-sm text-dim">
          링크나 QR로 <span className="font-semibold text-ink">{plan.name}</span> 계획을 다른 사람에게
          보낼 수 있어요.
        </p>

        {/* QR */}
        <div className="mt-4 flex justify-center">
          {qr ? (
            // eslint-disable-next-line @next/next/no-img-element -- 런타임 생성 data URL이라 next/image 대상 아님
            <img
              src={qr}
              alt="계획 공유 QR 코드"
              className="h-56 w-56 rounded-2xl border border-line bg-white p-2 shadow-card"
            />
          ) : (
            <div className="h-56 w-56 animate-pulse rounded-2xl bg-card" aria-hidden />
          )}
        </div>

        {/* 링크 */}
        <div className="mt-4">
          <p className="mb-1.5 text-xs font-semibold text-dim">공유 링크</p>
          <div className="flex items-center gap-2">
            <input
              type="text"
              readOnly
              value={url}
              aria-label="공유 링크"
              onFocus={(e) => e.currentTarget.select()}
              className="min-w-0 flex-1 rounded-lg border border-line bg-bg px-3 py-2.5 text-sm text-ink"
            />
            <button
              type="button"
              onClick={copy}
              className="shrink-0 cursor-pointer rounded-lg bg-ink px-4 py-2.5 text-sm font-bold text-white transition-transform active:scale-[0.97]"
            >
              {copied ? "복사됨" : "복사"}
            </button>
          </div>
        </div>

        {canNativeShare ? (
          <button
            type="button"
            onClick={nativeShare}
            className="mt-3 w-full cursor-pointer rounded-card bg-cta px-5 py-3.5 text-base font-bold text-on-cta transition-transform active:scale-[0.99]"
          >
            공유하기
          </button>
        ) : null}
      </div>
    </div>
  );
}
