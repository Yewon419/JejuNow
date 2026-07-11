"""GET /route — 일정 슬롯 간 자동차 경로 (카카오내비 길찾기 API 프록시).

REST 키는 서버 전용이므로 프론트가 직접 호출하지 않고 이 엔드포인트를 거친다.
응답 path는 [lat, lng] 좌표열 — 프론트가 카카오맵 Polyline으로 그린다.
"""

from __future__ import annotations

from functools import lru_cache

import requests
from fastapi import APIRouter, HTTPException

from api.core.http import ExternalApiError, as_dict, as_list, get_json
from api.deps import get_settings, get_spot_meta
from api.schemas import RouteOut

router = APIRouter()

DIRECTIONS_URL = "https://apis-navi.kakaomobility.com/v1/directions"


@lru_cache(maxsize=1)
def _session() -> requests.Session:
    s = requests.Session()
    s.headers["Authorization"] = f"KakaoAK {get_settings().kakao_rest_api_key}"
    # 데이터센터발 요청은 KA 헤더 없이 401로 거부됨 ("KA Header is required" — Render 실측)
    s.headers["KA"] = "sdk/1.0 os/rest lang/ko origin/https://jejunow.vercel.app"
    return s


@router.get("/route", response_model=RouteOut)
def get_route(from_spot: int, to_spot: int) -> RouteOut:
    spots = get_spot_meta()
    origin, dest = spots.get(from_spot), spots.get(to_spot)
    if origin is None or dest is None:
        raise HTTPException(status_code=404, detail=f"미등록 spot_id={from_spot or to_spot}")
    params = {
        "origin": f"{origin.lng},{origin.lat}",
        "destination": f"{dest.lng},{dest.lat}",
    }
    try:
        payload = get_json(_session(), DIRECTIONS_URL, params)
    except ExternalApiError as exc:
        raise HTTPException(status_code=502, detail=f"길찾기 API 실패: {exc}") from exc

    routes = as_list(as_dict(payload, "directions").get("routes", []), "routes")
    if not routes:
        raise HTTPException(status_code=404, detail="경로 없음")
    route = as_dict(routes[0], "route")
    code = route.get("result_code")
    if code != 0:
        # 103 등: 스팟 좌표가 도로에서 먼 경우 — 프론트는 외부 카카오맵 링크로 폴백
        raise HTTPException(
            status_code=422, detail=f"경로 탐색 실패({code}): {route.get('result_msg')}"
        )

    summary = as_dict(route.get("summary", {}), "summary")
    distance, duration = summary.get("distance"), summary.get("duration")
    if not isinstance(distance, int) or not isinstance(duration, int):
        raise HTTPException(status_code=502, detail="summary 형식 불량")

    path: list[tuple[float, float]] = []
    for sec_obj in as_list(route.get("sections", []), "sections"):
        sec = as_dict(sec_obj, "section")
        for road_obj in as_list(sec.get("roads", []), "roads"):
            road = as_dict(road_obj, "road")
            vertexes = as_list(road.get("vertexes", []), "vertexes")
            # vertexes는 [x1, y1, x2, y2, ...] 평탄 배열 (x=lng, y=lat)
            for i in range(0, len(vertexes) - 1, 2):
                x, y = vertexes[i], vertexes[i + 1]
                if isinstance(x, (int, float)) and isinstance(y, (int, float)):
                    path.append((float(y), float(x)))
    if not path:
        raise HTTPException(status_code=502, detail="경로 좌표 없음")
    return RouteOut(distance_m=distance, duration_s=duration, path=path)
