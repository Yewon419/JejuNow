"use client";

import { usePathname } from "next/navigation";
import { useAuth } from "./AuthProvider";
import { LoginScreen } from "./LoginScreen";

// 로그인 없이도 접근 가능한 경로 (앱스토어 심사 요건: 개인정보 처리방침은 항상 열람 가능).
const PUBLIC_PREFIXES = ["/privacy"];

export function AuthGate({ children }: { children: React.ReactNode }) {
  const { session, loading } = useAuth();
  const pathname = usePathname();
  const isPublic = PUBLIC_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));

  if (isPublic) return <>{children}</>;

  // 세션 판정 전에는 스플래시 (로그인 화면 깜빡임 방지)
  if (loading) {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-bg">
        <p className="text-sm font-bold tracking-widest text-primary">JEJU NOW</p>
      </main>
    );
  }

  if (!session) return <LoginScreen />;

  return <>{children}</>;
}
