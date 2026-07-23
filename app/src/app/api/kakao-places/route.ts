// 공항 검색 프록시 — 카카오 로컬 키워드 검색. REST 키는 서버 전용 env.
// 카카오 호출은 Vercel 함수 경유가 유일 경로(Render egress IP 플래그, kakao-route와 동일).
// 오토플랜 도착지(공항) 선택 전용이라 검색어에 "공항"을 강제해 범용 프록시로 못 쓰게 좁힌다.
const SEARCH_URL = "https://dapi.kakao.com/v2/local/search/keyword.json";

function asRecord(v: unknown): Record<string, unknown> | null {
  return typeof v === "object" && v !== null ? (v as Record<string, unknown>) : null;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const raw = (url.searchParams.get("q") ?? "").trim().slice(0, 30);
  if (raw.length === 0) {
    return Response.json({ error: "q 필요" }, { status: 400 });
  }
  const key = process.env.KAKAO_REST_API_KEY;
  if (!key) {
    return Response.json({ error: "KAKAO_REST_API_KEY 미설정" }, { status: 500 });
  }

  const query = raw.includes("공항") ? raw : `${raw} 공항`;
  const res = await fetch(`${SEARCH_URL}?query=${encodeURIComponent(query)}&size=10`, {
    headers: { Authorization: `KakaoAK ${key}` },
  });
  if (!res.ok) {
    const body = await res.text();
    return Response.json(
      { error: `카카오 로컬 응답 ${res.status}: ${body.slice(0, 200)}` },
      { status: 502 },
    );
  }

  const payload: unknown = await res.json();
  const documents = asRecord(payload)?.documents;
  const places: { name: string; addr: string; lat: number; lng: number }[] = [];
  // 카카오가 연관 장소(주차장·게이트·충전소·백화점 지점)를 섞어 준다 — 카테고리와 이름으로 거른다
  const NOISE = /주차|게이트|gate|충전|정류|택시|셔틀|출발|도착|탑승|화물|렌터카|백화점|면세/i;
  for (const docRaw of Array.isArray(documents) ? documents : []) {
    const doc = asRecord(docRaw);
    if (!doc) continue;
    const name = doc.place_name;
    const category = typeof doc.category_name === "string" ? doc.category_name : "";
    const lat = Number(doc.y);
    const lng = Number(doc.x);
    if (typeof name !== "string" || !Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    if (!name.includes("공항") || NOISE.test(name)) continue;
    if (!(category.includes("공항") || category.includes("항공"))) continue;
    const road = doc.road_address_name;
    const jibun = doc.address_name;
    places.push({
      name,
      addr: typeof road === "string" && road.length > 0 ? road : typeof jibun === "string" ? jibun : "",
      lat,
      lng,
    });
    if (places.length >= 6) break;
  }
  return Response.json({ places });
}
