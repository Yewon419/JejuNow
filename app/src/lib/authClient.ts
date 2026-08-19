// 브라우저용 인증 클라이언트 (@supabase/supabase-js).
// 기존 supabaseClient.ts(raw PostgREST 읽기)와 별개 — 이쪽은 세션·소셜 로그인 전용.
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | null = null;

function requireEnv(name: string, value: string | undefined): string {
  if (!value) throw new Error(`환경변수 ${name} 누락`);
  return value;
}

// NEXT_PUBLIC_* 인라인은 리터럴 접근이어야 Next가 빌드 시 치환한다(supabaseClient.ts와 동일 규칙).
export function getSupabase(): SupabaseClient {
  if (client) return client;
  const url = requireEnv("NEXT_PUBLIC_SUPABASE_URL", process.env.NEXT_PUBLIC_SUPABASE_URL);
  const anonKey = requireEnv(
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
  client = createClient(url, anonKey, {
    auth: {
      // 웹뷰 OAuth 쿠키 소실 함정을 피하려 PKCE. 리다이렉트 복귀 URL의 code를 자동 교환.
      flowType: "pkce",
      detectSessionInUrl: true,
      persistSession: true,
      autoRefreshToken: true,
    },
  });
  return client;
}

export const AUTH_PROVIDERS = ["kakao", "google", "apple"] as const;
export type AuthProviderId = (typeof AUTH_PROVIDERS)[number];

export async function signInWithProvider(provider: AuthProviderId): Promise<void> {
  const redirectTo = typeof window !== "undefined" ? window.location.origin : undefined;
  const { error } = await getSupabase().auth.signInWithOAuth({
    provider,
    options: { redirectTo },
  });
  // 성공 시 supabase-js가 window.location을 프로바이더 URL로 이동시킨다(이 아래는 도달 안 함).
  // 프로바이더 미활성(구글·애플 콘솔 미완료) 등은 error로 반환 → 호출부에서 처리.
  if (error) throw error;
}

export async function signOut(): Promise<void> {
  const { error } = await getSupabase().auth.signOut();
  if (error) throw error;
}

// 탈퇴 — 서버(/api/account/delete)가 service_role로 본인 계정을 삭제한다.
export async function deleteAccount(): Promise<void> {
  const { data, error: sessionError } = await getSupabase().auth.getSession();
  if (sessionError) throw sessionError;
  const token = data.session?.access_token;
  if (!token) throw new Error("세션 없음");

  const res = await fetch("/api/account/delete", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`계정 삭제 실패 ${res.status}: ${body.slice(0, 200)}`);
  }
  // 사용자는 이미 서버에서 삭제됨 — auth-js signOut은 401/404를 무시하고 로컬 세션을 지운다.
  await signOut();
}
