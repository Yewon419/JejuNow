// 카카오내비 길찾기 프록시 — REST 키는 서버 전용 env(KAKAO_REST_API_KEY, NEXT_PUBLIC 아님).
// Render 프록시(api/routes/route.py)는 카카오가 Render egress IP를 플래그해 401(-401 KA)을
// 받으므로(2026-07-11 실측, GitHub 러너·가정망에서는 KA 없이도 성공) Vercel 함수로 이전.
const DIRECTIONS_URL = "https://apis-navi.kakaomobility.com/v1/directions";

function parseLatLng(value: string | null): [number, number] | null {
  if (!value) return null;
  const [lat, lng] = value.split(",").map(Number);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return [lat, lng];
}

function asRecord(v: unknown): Record<string, unknown> | null {
  return typeof v === "object" && v !== null ? (v as Record<string, unknown>) : null;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const from = parseLatLng(url.searchParams.get("from"));
  const to = parseLatLng(url.searchParams.get("to"));
  if (!from || !to) {
    return Response.json({ error: "from/to는 'lat,lng' 형식" }, { status: 400 });
  }
  const key = process.env.KAKAO_REST_API_KEY;
  if (!key) {
    return Response.json({ error: "KAKAO_REST_API_KEY 미설정" }, { status: 500 });
  }

  const qs = `origin=${from[1]},${from[0]}&destination=${to[1]},${to[0]}`;
  const res = await fetch(`${DIRECTIONS_URL}?${qs}`, {
    headers: { Authorization: `KakaoAK ${key}` },
  });
  if (!res.ok) {
    const body = await res.text();
    return Response.json(
      { error: `카카오내비 응답 ${res.status}: ${body.slice(0, 200)}` },
      { status: 502 },
    );
  }

  const payload: unknown = await res.json();
  const routes = asRecord(payload)?.routes;
  const route = asRecord(Array.isArray(routes) ? routes[0] : null);
  if (!route) return Response.json({ error: "경로 없음" }, { status: 404 });
  if (route.result_code !== 0) {
    // 103 등: 좌표가 도로에서 먼 경우 — 프론트는 외부 카카오맵 링크로 폴백
    return Response.json(
      { error: `경로 탐색 실패(${route.result_code}): ${route.result_msg}` },
      { status: 422 },
    );
  }

  const summary = asRecord(route.summary);
  const distance = summary?.distance;
  const duration = summary?.duration;
  if (typeof distance !== "number" || typeof duration !== "number") {
    return Response.json({ error: "summary 형식 불량" }, { status: 502 });
  }

  const path: [number, number][] = [];
  const sections = Array.isArray(route.sections) ? route.sections : [];
  for (const secRaw of sections) {
    const roads = asRecord(secRaw)?.roads;
    for (const roadRaw of Array.isArray(roads) ? roads : []) {
      const vertexes = asRecord(roadRaw)?.vertexes;
      if (!Array.isArray(vertexes)) continue;
      // vertexes는 [x1, y1, x2, y2, ...] 평탄 배열 (x=lng, y=lat)
      for (let i = 0; i < vertexes.length - 1; i += 2) {
        const x = vertexes[i];
        const y = vertexes[i + 1];
        if (typeof x === "number" && typeof y === "number") path.push([y, x]);
      }
    }
  }
  if (path.length === 0) {
    return Response.json({ error: "경로 좌표 없음" }, { status: 502 });
  }
  return Response.json({ distance_m: distance, duration_s: duration, path });
}
