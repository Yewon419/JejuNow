"use client";

import Link from "next/link";
import { useState } from "react";
import { signInWithProvider, type AuthProviderId } from "@/lib/authClient";
import { tapMedium } from "@/lib/haptics";

// v1.1 제출은 카카오 단독(2026-08-05 결정). 구글·애플 버튼은 콘솔 연동 후 필요 시 복원.
const PROVIDERS: { id: AuthProviderId; label: string; className: string }[] = [
  { id: "kakao", label: "카카오로 시작하기", className: "bg-[#FEE500] text-[#191600]" },
];

export function LoginScreen() {
  const [pending, setPending] = useState<AuthProviderId | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function start(id: AuthProviderId) {
    tapMedium();
    setError(null);
    setPending(id);
    try {
      await signInWithProvider(id);
      // 성공 시 OAuth 리다이렉트로 페이지가 떠난다 — 아래 도달 안 함
    } catch {
      setPending(null);
      setError("로그인을 시작하지 못했어요. 잠시 후 다시 시도해 주세요.");
    }
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-xl flex-col justify-between px-6 py-12">
      <header className="pt-16">
        <p className="text-sm font-bold tracking-widest text-primary">JEJU NOW</p>
        <h1 className="mt-3 text-3xl font-bold leading-snug text-ink">
          로그인하고
          <br />
          한적한 제주를 찾아요
        </h1>
        <p className="mt-3 text-base leading-relaxed text-dim">
          간편 로그인으로 바로 시작할 수 있어요.
        </p>
      </header>

      <section className="space-y-3" aria-label="로그인 방법">
        {PROVIDERS.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => start(p.id)}
            disabled={pending !== null}
            aria-busy={pending === p.id}
            className={`w-full cursor-pointer rounded-card p-4 text-center font-semibold shadow-card transition-transform active:scale-[0.99] disabled:opacity-60 ${p.className}`}
          >
            {pending === p.id ? "이동 중…" : p.label}
          </button>
        ))}

        {error && (
          <p className="pt-1 text-center text-sm text-lv4" role="alert">
            {error}
          </p>
        )}

        <p className="pt-4 text-center text-xs leading-relaxed text-dim/80">
          로그인해야 서비스를 이용할 수 있어요.
          <br />
          시작하면{" "}
          <Link href="/privacy" className="underline">
            개인정보 처리방침
          </Link>
          에 동의하는 것으로 봅니다.
        </p>
      </section>
    </main>
  );
}
