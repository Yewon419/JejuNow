// 계정 삭제(탈퇴) — Apple 심사 5.1.1(v): 계정 생성을 지원하는 앱은 앱 내 삭제 제공 필수.
// service_role 키는 서버 전용 env. 본인 access token을 검증해 그 사용자만 삭제한다
// (범용 admin 프록시로 못 쓰게 좁힌다 — kakao-places와 동일 원칙).
import { createClient } from "@supabase/supabase-js";

export async function POST(request: Request) {
  const auth = request.headers.get("authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice("Bearer ".length) : "";
  if (token.length === 0) {
    return Response.json({ error: "인증 필요" }, { status: 401 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    return Response.json({ error: "SUPABASE_SERVICE_ROLE_KEY 미설정" }, { status: 500 });
  }

  const admin = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data, error: userError } = await admin.auth.getUser(token);
  if (userError || !data.user) {
    return Response.json({ error: "유효하지 않은 세션" }, { status: 401 });
  }

  const { error } = await admin.auth.admin.deleteUser(data.user.id);
  if (error) {
    return Response.json({ error: `계정 삭제 실패: ${error.message}` }, { status: 502 });
  }
  return Response.json({ ok: true });
}
