"""TourAPI 4.0 제주 스팟 수집 → Supabase `spots` 적재.

areaBasedList2(areaCode=39)로 관광지(12)·문화시설(14)·레포츠(28)를 수집하고,
detailIntro2로 운영시간(usetime 계열)을 보강한다.

실행: .venv\\Scripts\\python.exe -m api.collectors.collect_spots
"""

from __future__ import annotations

import logging
import time
from dataclasses import dataclass

import requests

from api.core.config import load_settings
from api.core.http import ExternalApiError, as_dict, as_list, get_json
from api.core.supabase import SupabaseRest

logger = logging.getLogger(__name__)

BASE_URL = "https://apis.data.go.kr/B551011/KorService2"
JEJU_AREA_CODE = "39"
CONTENT_TYPES: tuple[tuple[str, str], ...] = (
    ("12", "관광지"),
    ("14", "문화시설"),
    ("28", "레포츠"),
)
NUM_ROWS = 100
DETAIL_DELAY_SEC = 0.12
# 제주(areaCode 39) 시군구: 3=서귀포시, 4=제주시 (구 1·2는 통합 폐지)
SIGUNGU_REGION = {"3": "서귀포시", "4": "제주시"}
# 운영시간 필드는 contentTypeId마다 다름
USETIME_FIELD = {"12": "usetime", "14": "usetimeculture", "28": "usetimeleports"}
# is_outdoor 휴리스틱: cat1 A01(자연)=야외, A02(인문)·A03(레포츠)는 cat2로 판별
OUTDOOR_CAT2 = {
    "A0101",  # 자연관광지
    "A0102",  # 관광자원
    "A0202",  # 관광단지 등 (혼합이나 야외 비중 높음)
    "A0302",  # 육상 레포츠
    "A0303",  # 수상 레포츠
}
INDOOR_CAT2 = {"A0206", "A0305"}  # 문화시설, 실내 레포츠 등


@dataclass(frozen=True)
class Spot:
    content_id: str
    content_type_id: str
    name: str
    cat1: str | None
    cat2: str | None
    cat3: str | None
    lat: float
    lng: float
    addr: str | None
    image_url: str | None
    region: str


def _str_field(item: dict[str, object], key: str) -> str | None:
    value = item.get(key)
    if isinstance(value, str) and value.strip():
        return value.strip()
    return None


def _base_params(service_key: str) -> dict[str, str]:
    return {
        "serviceKey": service_key,
        "MobileOS": "ETC",
        "MobileApp": "JejuNow",
        "_type": "json",
    }


def _response_items(payload: object, ctx: str) -> tuple[list[object], int]:
    """TourAPI 표준 응답에서 (items, totalCount) 추출 + resultCode 검증."""
    root = as_dict(payload, ctx)
    response = as_dict(root.get("response"), f"{ctx}.response")
    header = as_dict(response.get("header"), f"{ctx}.header")
    code = header.get("resultCode")
    if code != "0000":
        raise ExternalApiError(f"{ctx}: resultCode={code!r} msg={header.get('resultMsg')!r}")
    body = as_dict(response.get("body"), f"{ctx}.body")
    total_raw = body.get("totalCount")
    total = int(total_raw) if isinstance(total_raw, (int, str)) else 0
    items_obj = body.get("items")
    if items_obj == "" or items_obj is None:  # 빈 결과는 items가 빈 문자열
        return [], total
    items = as_dict(items_obj, f"{ctx}.items").get("item")
    if items is None:
        return [], total
    if isinstance(items, dict):  # 단건이면 dict로 옴
        return [items], total
    return as_list(items, f"{ctx}.item"), total


def _region_of(sigungu: str | None, addr: str | None) -> str:
    if sigungu in SIGUNGU_REGION:
        return SIGUNGU_REGION[sigungu]
    if addr and "서귀포시" in addr:
        return "서귀포시"
    return "제주시"


def _is_outdoor(cat1: str | None, cat2: str | None) -> bool | None:
    if cat2 in OUTDOOR_CAT2:
        return True
    if cat2 in INDOOR_CAT2:
        return False
    if cat1 == "A01":
        return True
    if cat1 == "A02":
        return False
    return None


def fetch_spots(session: requests.Session, service_key: str) -> list[Spot]:
    spots: list[Spot] = []
    seen: set[str] = set()
    for type_id, type_label in CONTENT_TYPES:
        page = 1
        fetched = 0
        while True:
            params = _base_params(service_key) | {
                "areaCode": JEJU_AREA_CODE,
                "contentTypeId": type_id,
                "numOfRows": str(NUM_ROWS),
                "pageNo": str(page),
                "arrange": "A",
            }
            log_params = {k: v for k, v in params.items() if k != "serviceKey"}
            payload = get_json(
                session, f"{BASE_URL}/areaBasedList2", params, log_params=log_params
            )
            items, total = _response_items(payload, f"areaBasedList2[{type_label}]")
            for raw in items:
                item = as_dict(raw, "spot item")
                content_id = _str_field(item, "contentid")
                name = _str_field(item, "title")
                lng_s = _str_field(item, "mapx")
                lat_s = _str_field(item, "mapy")
                if not content_id or not name or not lat_s or not lng_s:
                    logger.warning("필수필드 누락 스킵: %s", item.get("contentid"))
                    continue
                if content_id in seen:
                    continue
                seen.add(content_id)
                lat, lng = float(lat_s), float(lng_s)
                if not (33.0 <= lat <= 34.1 and 126.0 <= lng <= 127.1):
                    logger.warning("제주 좌표범위 밖 스킵: %s (%s, %s)", name, lat, lng)
                    continue
                addr = _str_field(item, "addr1")
                cat1 = _str_field(item, "cat1")
                cat2 = _str_field(item, "cat2")
                spots.append(
                    Spot(
                        content_id=content_id,
                        content_type_id=type_id,
                        name=name,
                        cat1=cat1,
                        cat2=cat2,
                        cat3=_str_field(item, "cat3"),
                        lat=lat,
                        lng=lng,
                        addr=addr,
                        image_url=_str_field(item, "firstimage"),
                        region=_region_of(_str_field(item, "sigungucode"), addr),
                    )
                )
            fetched += len(items)
            logger.info("%s page=%d 누적 %d/%d", type_label, page, fetched, total)
            if fetched >= total or not items:
                break
            page += 1
            time.sleep(DETAIL_DELAY_SEC)
    return spots


def fetch_opening_hours(
    session: requests.Session, service_key: str, spot: Spot
) -> str | None:
    params = _base_params(service_key) | {
        "contentId": spot.content_id,
        "contentTypeId": spot.content_type_id,
    }
    log_params = {k: v for k, v in params.items() if k != "serviceKey"}
    try:
        payload = get_json(session, f"{BASE_URL}/detailIntro2", params, log_params=log_params)
        items, _ = _response_items(payload, f"detailIntro2[{spot.content_id}]")
    except ExternalApiError as exc:
        logger.warning("운영시간 조회 실패(계속 진행): %s — %s", spot.name, exc)
        return None
    if not items:
        return None
    item = as_dict(items[0], "intro item")
    return _str_field(item, USETIME_FIELD[spot.content_type_id])


def main() -> None:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
    settings = load_settings()
    session = requests.Session()

    spots = fetch_spots(session, settings.data_go_kr_key)
    by_region: dict[str, int] = {}
    for s in spots:
        by_region[s.region] = by_region.get(s.region, 0) + 1
    logger.info("수집 스팟 %d건, 지역분포 %s", len(spots), by_region)
    if len(spots) < 300:
        raise RuntimeError(f"스팟 수가 비정상적으로 적음: {len(spots)} (기대 384+)")

    logger.info("운영시간 보강 시작 (%d건, detailIntro2)", len(spots))
    hours: dict[str, str | None] = {}
    for i, spot in enumerate(spots, 1):
        hours[spot.content_id] = fetch_opening_hours(session, settings.data_go_kr_key, spot)
        if i % 50 == 0:
            logger.info("운영시간 %d/%d", i, len(spots))
        time.sleep(DETAIL_DELAY_SEC)

    rows: list[dict[str, object]] = [
        {
            "content_id": s.content_id,
            "name": s.name,
            "cat1": s.cat1,
            "cat2": s.cat2,
            "cat3": s.cat3,
            "lat": s.lat,
            "lng": s.lng,
            "addr": s.addr,
            "opening_hours": hours.get(s.content_id),
            "image_url": s.image_url,
            "is_outdoor": _is_outdoor(s.cat1, s.cat2),
            "region": s.region,
        }
        for s in spots
    ]
    db = SupabaseRest(settings.supabase_url, settings.supabase_service_role_key)
    inserted = db.insert("spots", rows, on_conflict="content_id")
    logger.info("spots 적재 완료: %d행", inserted)


if __name__ == "__main__":
    main()
