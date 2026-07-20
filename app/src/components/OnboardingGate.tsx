"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

// Capacitor 셸은 매 실행마다 루트 URL을 연다. 저장된 선택을 읽지 않으면
// 재방문자도 온보딩을 매번 보게 된다 — 여기서 걸러 바로 목적지로 보낸다.
const DEST: Record<string, string> = {
  spontaneous: "/dashboard",
  planner: "/schedule",
};

export function OnboardingGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [decided, setDecided] = useState(false);

  // localStorage 읽기(외부 시스템) — 마이크로태스크로 지연해 cascading render 회피
  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      let saved: string | null = null;
      try {
        saved = localStorage.getItem("jejunow:travelerType");
      } catch {
        // 저장 불가 환경 — 온보딩을 보여준다
      }
      const dest = saved ? DEST[saved] : undefined;
      if (dest) router.replace(dest);
      else setDecided(true);
    });
    return () => {
      cancelled = true;
    };
  }, [router]);

  // 판정 전에는 온보딩을 그리지 않는다(재방문자에게 깜빡임 방지)
  if (!decided) {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-bg">
        <p className="text-sm font-bold tracking-widest text-primary">JEJU NOW</p>
      </main>
    );
  }

  return <>{children}</>;
}
