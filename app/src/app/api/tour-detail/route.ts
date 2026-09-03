// TourAPI detailCommon2 실시간 프록시 — 서비스 키는 서버 전용 env(DATA_GO_KR_SERVICE_KEY_DECODING).
// 상세 화면 진입 시 개요·전화·홈페이지를 원천에서 직접 읽는다. 주간 동기화된 DB 값은 폴백이며,
// 정리 규칙(<br>→개행·태그 제거·homepage href 추출)은 api/collectors/collect_spots.py와 동일.
const DETAIL_URL = "https://apis.data.go.kr/B551011/KorService2/detailCommon2";
const TIMEOUT_MS = 6000;

export const dynamic = "force-dynamic";

function asRecord(v: unknown): Record<string, unknown> | null {
  return typeof v === "object" && v !== null ? (v as Record<string, unknown>) : null;
}

function strField(rec: Record<string, unknown>, key: string): string | null {
  const v = rec[key];
  return typeof v === "string" && v.trim() ? v : null;
}

const NAMED_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
};

function unescapeHtml(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (whole, ent: string) => {
    if (ent[0] === "#") {
      const code = ent[1] === "x" || ent[1] === "X" ? parseInt(ent.slice(2), 16) : parseInt(ent.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : whole;
    }
    return NAMED_ENTITIES[ent.toLowerCase()] ?? whole;
  });
}

/** overview의 HTML 잔재 정리 — <br>→개행, 나머지 태그 제거, 엔티티 복원 */
function cleanText(raw: string | null): string | null {
  if (!raw) return null;
  const text = unescapeHtml(raw.replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]+>/g, "")).trim();
  return text || null;
}

/** homepage는 앵커 HTML(<a href="...">)이거나 순수 URL — href만 추출, http(s)만 인정 */
function cleanHomepage(raw: string | null): string | null {
  if (!raw) return null;
  const m = raw.match(/href\s*=\s*["']([^"']+)["']/i);
  const url = (m ? m[1] : raw.replace(/<[^>]+>/g, "")).trim();
  return /^https?:\/\//.test(url) ? url : null;
}

export async function GET(request: Request) {
  const contentId = new URL(request.url).searchParams.get("contentId");
  if (!contentId || !/^\d{1,12}$/.test(contentId)) {
    return Response.json({ error: "contentId는 숫자" }, { status: 400 });
  }
  const key = process.env.DATA_GO_KR_SERVICE_KEY_DECODING;
  if (!key) {
    return Response.json({ error: "DATA_GO_KR_SERVICE_KEY_DECODING 미설정" }, { status: 500 });
  }

  const qs = new URLSearchParams({
    serviceKey: key,
    MobileOS: "ETC",
    MobileApp: "JejuNow",
    _type: "json",
    contentId,
  });
  let res: Response;
  try {
    res = await fetch(`${DETAIL_URL}?${qs}`, {
      cache: "no-store",
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (err) {
    return Response.json(
      { error: `TourAPI 연결 실패(contentId=${contentId}): ${String(err).slice(0, 120)}` },
      { status: 504 },
    );
  }
  if (!res.ok) {
    const body = await res.text();
    return Response.json(
      { error: `TourAPI 응답 ${res.status}(contentId=${contentId}): ${body.slice(0, 200)}` },
      { status: 502 },
    );
  }

  let payload: unknown;
  try {
    payload = await res.json();
  } catch {
    // 쿼터 초과·장애 시 XML 오류 본문이 오는 경우
    return Response.json({ error: "TourAPI 응답이 JSON이 아님" }, { status: 502 });
  }
  const response = asRecord(asRecord(payload)?.response);
  const header = asRecord(response?.header);
  if (header?.resultCode !== "0000") {
    return Response.json(
      { error: `TourAPI resultCode=${String(header?.resultCode)} ${String(header?.resultMsg ?? "")}` },
      { status: 502 },
    );
  }
  const items = asRecord(asRecord(response?.body)?.items)?.item;
  const item = asRecord(Array.isArray(items) ? items[0] : null);
  if (!item) return Response.json({ error: "항목 없음" }, { status: 404 });

  return Response.json({
    overview: cleanText(strField(item, "overview")),
    tel: strField(item, "tel"),
    homepage: cleanHomepage(strField(item, "homepage")),
    source: "tourapi",
  });
}
