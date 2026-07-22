// 사전계산(congestion_pred) 호라이즌 — ml/precompute.py와 동기 유지
// precompute는 KST 오늘 +45일 롤링 적재. 프론트는 +30일만 노출해
// 주 1회 재실행 지연(최대 7일)을 흡수한다 (45 - 7 > 30, 항상 데이터 보장)
const HORIZON_EXPOSE_DAYS = 30;

function kstDateStr(offsetDays: number): string {
  const kst = new Date(Date.now() + 9 * 3600 * 1000);
  kst.setUTCDate(kst.getUTCDate() + offsetDays);
  return kst.toISOString().slice(0, 10);
}

export const HORIZON_START = kstDateStr(0);
export const HORIZON_END = kstDateStr(HORIZON_EXPOSE_DAYS);
export const HOUR_MIN = 9;
export const HOUR_MAX = 20;

export const LEVEL_LABEL: Record<number, string> = {
  1: "여유",
  2: "보통",
  3: "붐빔",
  4: "혼잡",
};

// 여유(에메랄드) → 혼잡(레드). 라이트 배경 대비 검증값 (globals.css와 동기)
export const LEVEL_COLOR: Record<number, string> = {
  1: "#0fae87",
  2: "#e0a020",
  3: "#f06f24",
  4: "#e23b54",
};

export const CAT_LABEL: Record<string, string> = {
  NA01: "자연경관(산)",
  NA02: "자연경관(하천·해양)",
  NA03: "자연생태",
  NA04: "자연공원",
  NA05: "기타자연",
  HS01: "역사유적지",
  HS02: "역사유물",
  HS03: "종교성지",
  HS04: "안보관광지",
  LS01: "육상레저",
  LS02: "수상레저",
  LS03: "항공레저",
  LS04: "복합레저",
  EX01: "전통체험",
  EX02: "공예체험",
  EX03: "농산어촌체험",
  EX04: "산사체험",
  EX05: "웰니스",
  EX06: "산업관광",
  EX07: "기타체험",
  VE01: "랜드마크",
  VE02: "테마공원",
  VE03: "도시공원",
  VE04: "문화관광",
  VE05: "복합관광시설",
  VE06: "공연시설",
  VE07: "전시시설",
  VE08: "행사시설",
  VE09: "교육시설",
  VE10: "레저스포츠시설",
  VE11: "교통시설",
  VE12: "기타문화관광",
  AC05: "캠핑",
};

export function catLabel(cat2: string | null): string {
  if (!cat2) return "기타";
  return CAT_LABEL[cat2] ?? "기타";
}

/** TourAPI 운영시간의 HTML 잔재(<br> 등)를 표시용 한 줄로 정리 */
export function cleanHours(text: string): string {
  return text
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function clampHour(h: number): number {
  return Math.min(HOUR_MAX, Math.max(HOUR_MIN, h));
}

/** 현재 KST 시각을 슬라이더 범위(9~20)로 보정 */
export function nowKstHourClamped(): number {
  return clampHour(new Date(Date.now() + 9 * 3600 * 1000).getUTCHours());
}

/** 현재 KST 시각대 인사말 — 헤더용(시간대 기반, 개인화 아님) */
export function kstGreeting(): string {
  const h = new Date(Date.now() + 9 * 3600 * 1000).getUTCHours();
  if (h < 6) return "고요한 새벽이에요";
  if (h < 11) return "좋은 아침이에요";
  if (h < 17) return "좋은 오후예요";
  if (h < 21) return "편안한 저녁이에요";
  return "고요한 밤이에요";
}

const WEEKDAY_KO = ["일", "월", "화", "수", "목", "금", "토"];

/** "YYYY-MM-DD" → "M월 D일 요일" (요일은 UTC 파싱으로 결정적 계산) */
export function formatKstDate(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const weekday = WEEKDAY_KO[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
  return `${m}월 ${d}일 ${weekday}요일`;
}

/** 호라이즌 내로 날짜를 보정한 오늘(KST) 문자열 */
export function todayInHorizon(): string {
  const now = new Date(Date.now() + 9 * 3600 * 1000);
  const iso = now.toISOString().slice(0, 10);
  if (iso < HORIZON_START) return HORIZON_START;
  if (iso > HORIZON_END) return HORIZON_END;
  return iso;
}
