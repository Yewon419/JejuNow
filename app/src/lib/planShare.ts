// 시안을 URL에 압축해 담고 되돌리는 공유 인코딩 (백엔드 없음).
// 페이로드는 스팟 id·시간만 담고, 수신자 앱이 자기 스팟 데이터로 이름·좌표를 결합한다.
import type { Journey, ScheduleSlot } from "./types";

type SharePayload = {
  n: string; // name
  d: string; // date (YYYY-MM-DD)
  s: [number, number][]; // [hour, spotId]
  j?: Journey; // 오토플랜 여정(있을 때만)
};

export type SharedPlan = {
  name: string;
  date: string;
  slots: ScheduleSlot[];
  journey: Journey | null;
};

// UTF-8 안전 base64url (한글 이름 포함). btoa/atob는 브라우저·Node 모두 전역.
function toBase64Url(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(param: string): string {
  const b64 = param.replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(b64);
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

export function encodePlan(plan: SharedPlan): string {
  const payload: SharePayload = {
    n: plan.name,
    d: plan.date,
    s: plan.slots.map((sl) => [sl.hour, sl.spotId]),
    ...(plan.journey ? { j: plan.journey } : {}),
  };
  return toBase64Url(JSON.stringify(payload));
}

export function decodePlan(param: string): SharedPlan | null {
  try {
    const payload = JSON.parse(fromBase64Url(param)) as SharePayload;
    if (typeof payload.n !== "string" || typeof payload.d !== "string" || !Array.isArray(payload.s)) {
      return null;
    }
    const slots: ScheduleSlot[] = payload.s
      .filter(
        (t): t is [number, number] =>
          Array.isArray(t) && t.length === 2 && typeof t[0] === "number" && typeof t[1] === "number",
      )
      .map(([hour, spotId]) => ({ hour, spotId }));
    return { name: payload.n, date: payload.d, slots, journey: payload.j ?? null };
  } catch {
    return null;
  }
}
