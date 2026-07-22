"""스팟 도로 접근점 좌표(route_lat/lng) 백필 — 최근접 주차장(카카오 PK6) 좌표를 채운다.

봉우리·해안·동굴 등 원 좌표가 도로에서 먼 스팟은 카카오내비가 경로를 거부(102/103)한다.
주차장은 반드시 도로에 접해 있어, 최근접 주차장 좌표를 경로 계산용으로 저장하면 거부를 없앤다.
표시(마커·거리·상세)는 원 좌표를 유지하므로 경로 외 UX에는 영향이 없다.

선행: db/migrations/0005_spots_route_coords.sql 적용.
실행(표본 검증): .venv\\Scripts\\python.exe -m api.collectors.backfill_route_coords --limit 15
실행(전체 적재): .venv\\Scripts\\python.exe -m api.collectors.backfill_route_coords --apply
재실행 안전 — upsert(content_id)라 반복 실행해도 route 좌표만 최신으로 덮어쓴다.
"""

from __future__ import annotations

import argparse
import logging
import time

import requests

from api.core.config import load_settings
from api.core.http import ExternalApiError, as_dict, as_list, get_json
from api.core.supabase import SupabaseRest

logger = logging.getLogger(__name__)

CATEGORY_URL = "https://dapi.kakao.com/v2/local/search/category.json"
PARKING_CODE = "PK6"  # 카카오 로컬 카테고리: 주차장
# 800m 이내만 스팟 전용·인접 주차장으로 신뢰(전체 dry-run 분포 기준 590/802=73.6%).
# 그 밖은 다른 장소 주차장을 억지로 잡아 경로 거리·시간이 틀리므로 폴백(개선된 안내)에 맡긴다.
SEARCH_RADIUS_M = 800
REQUEST_DELAY_SEC = 0.05  # 카카오 로컬 초당 제한 여유


class Parking:
    """최근접 주차장 좌표 + 진단용 메타."""

    __slots__ = ("distance_m", "lat", "lng", "name")

    def __init__(self, lat: float, lng: float, name: str, distance_m: int) -> None:
        self.lat = lat
        self.lng = lng
        self.name = name
        self.distance_m = distance_m


def nearest_parking(session: requests.Session, lat: float, lng: float) -> Parking | None:
    """스팟 좌표 반경 내 최근접 주차장. 없으면 None."""
    data = get_json(
        session,
        CATEGORY_URL,
        {
            "category_group_code": PARKING_CODE,
            "x": str(lng),
            "y": str(lat),
            "radius": str(SEARCH_RADIUS_M),
            "sort": "distance",
            "size": "1",
        },
    )
    body = as_dict(data, "kakao local category")
    docs = as_list(body.get("documents"), "kakao local documents")
    if not docs:
        return None
    doc = as_dict(docs[0], "kakao local document[0]")
    try:
        return Parking(
            lat=float(str(doc["y"])),
            lng=float(str(doc["x"])),
            name=str(doc["place_name"]),
            distance_m=int(str(doc["distance"])),
        )
    except (KeyError, ValueError) as exc:
        raise ExternalApiError(f"주차장 문서 파싱 실패: {doc!r}") from exc


def main() -> None:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
    parser = argparse.ArgumentParser(description="스팟 도로 접근점(route 좌표) 백필")
    parser.add_argument("--limit", type=int, default=0, help="처리할 스팟 수 상한(0=전체)")
    parser.add_argument("--apply", action="store_true", help="DB 반영(미지정 시 dry-run 출력만)")
    args = parser.parse_args()

    settings = load_settings()
    db = SupabaseRest(settings.supabase_url, settings.supabase_service_role_key)
    session = requests.Session()
    session.headers.update({"Authorization": f"KakaoAK {settings.kakao_rest_api_key}"})

    spots = db.select_all("spots", {"select": "spot_id,name,lat,lng", "order": "spot_id"})
    if args.limit > 0:
        spots = spots[: args.limit]
    logger.info("대상 스팟 %d건 (apply=%s)", len(spots), args.apply)

    # spot_id 필터로 개별 UPDATE(PATCH). upsert(INSERT ON CONFLICT)는 spot_id가
    # generated always identity라 값 삽입 불가(428C9)고, content_id 충돌도 못 잡아 실패한다.
    # UPDATE는 지정 행만 갱신하므로 즉시 반영 — 중단돼도 이미 갱신된 행은 남는다(재실행 안전).
    found = 0
    updated = 0
    errors = 0
    for i, row in enumerate(spots, 1):
        sid = row.get("spot_id")
        name = row.get("name")
        lat, lng = row.get("lat"), row.get("lng")
        if (
            not isinstance(sid, int)
            or not isinstance(lat, (int, float))
            or not isinstance(lng, (int, float))
        ):
            logger.warning("스킵(필드 불량): %r", row)
            continue
        try:
            park = nearest_parking(session, float(lat), float(lng))
        except ExternalApiError as exc:
            errors += 1
            logger.warning("[%d/%d] %s: 주차장 조회 실패 — 스킵: %s", i, len(spots), name, exc)
            time.sleep(REQUEST_DELAY_SEC)
            continue
        if park is None:
            logger.info(
                "[%d/%d] %s: 주차장 없음(반경 %dm) — route 좌표 미설정",
                i, len(spots), name, SEARCH_RADIUS_M,
            )
        else:
            found += 1
            logger.info(
                "[%d/%d] %s: %s (%dm) → route=(%.6f,%.6f)",
                i, len(spots), name, park.name, park.distance_m, park.lat, park.lng,
            )
            if args.apply:
                db.update(
                    "spots",
                    {"spot_id": f"eq.{sid}"},
                    {"route_lat": park.lat, "route_lng": park.lng},
                )
                updated += 1
        time.sleep(REQUEST_DELAY_SEC)

    logger.info(
        "주차장 확보 %d/%d (%.1f%%) · 조회실패 %d",
        found, len(spots), 100 * found / max(1, len(spots)), errors,
    )
    if not args.apply:
        logger.info("dry-run — DB 미반영. 실제 적재는 --apply")
        return
    logger.info("route 좌표 백필 완료: %d행 갱신", updated)


if __name__ == "__main__":
    main()
