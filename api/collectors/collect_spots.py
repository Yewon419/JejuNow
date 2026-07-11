"""TourAPI 4.0 제주 스팟 수집 → Supabase `spots` 적재.

areaBasedList2를 **법정동 코드(lDongRegnCd=50)**로 조회한다 — legacy areaCode=39는
신규 등록 스팟(비자림 등 areacode 공란)을 누락시킴(2026-06-13 검증: 384 vs 568건).
카테고리도 legacy cat1~3 대신 **신분류 lclsSystm1~3**을 cat1~3 컬럼에 저장
(803/803 채워짐, legacy는 526/803만).

수집 대상: 관광지(12)·문화시설(14)·레포츠(28). detailIntro2로 운영시간 보강.
firstimage 없는 스팟은 detailImage2(originimgurl 첫 장)로 이미지 보강 — 원천에도 없으면 null 유지.

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
JEJU_LDONG_CODE = "50"
CONTENT_TYPES: tuple[tuple[str, str], ...] = (
    ("12", "관광지"),
    ("14", "문화시설"),
    ("28", "레포츠"),
)
NUM_ROWS = 100
DETAIL_DELAY_SEC = 0.12
# 법정동 시군구: 110=제주시, 130=서귀포시
LDONG_REGION = {"110": "제주시", "130": "서귀포시"}
# 운영시간 필드는 contentTypeId마다 다름
USETIME_FIELD = {"12": "usetime", "14": "usetimeculture", "28": "usetimeleports"}
# is_outdoor 휴리스틱 (lclsSystm2 기준, 코드명은 lclsSystmCode2 API 확인값)
OUTDOOR_LCLS2 = {
    "NA01",  # 자연경관(산)
    "NA02",  # 자연경관(하천·해양)
    "NA03",  # 자연생태
    "NA04",  # 자연공원
    "NA05",  # 기타자연관광
    "LS01",  # 육상레저스포츠
    "LS02",  # 수상레저스포츠
    "LS03",  # 항공레저스포츠
    "HS01",  # 역사유적지
    "VE02",  # 테마공원
    "VE03",  # 도시공원
    "AC05",  # 캠핑
}
INDOOR_LCLS2 = {"VE06", "VE07", "VE09"}  # 공연·전시·교육시설


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


def _region_of(ldong_sgg: str | None, addr: str | None) -> str:
    if ldong_sgg in LDONG_REGION:
        return LDONG_REGION[ldong_sgg]
    if addr and "서귀포시" in addr:
        return "서귀포시"
    return "제주시"


def _is_outdoor(lcls2: str | None) -> bool | None:
    if lcls2 in OUTDOOR_LCLS2:
        return True
    if lcls2 in INDOOR_LCLS2:
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
                "lDongRegnCd": JEJU_LDONG_CODE,
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
                lcls2 = _str_field(item, "lclsSystm2")
                spots.append(
                    Spot(
                        content_id=content_id,
                        content_type_id=type_id,
                        name=name,
                        cat1=_str_field(item, "lclsSystm1"),
                        cat2=lcls2,
                        cat3=_str_field(item, "lclsSystm3"),
                        lat=lat,
                        lng=lng,
                        addr=addr,
                        image_url=_str_field(item, "firstimage"),
                        region=_region_of(_str_field(item, "lDongSignguCd"), addr),
                    )
                )
            fetched += len(items)
            logger.info("%s page=%d 누적 %d/%d", type_label, page, fetched, total)
            if fetched >= total or not items:
                break
            page += 1
            time.sleep(DETAIL_DELAY_SEC)
    return spots


class QuotaExceededError(RuntimeError):
    """data.go.kr 일일 쿼터 소진(429) — 이후 detail 호출 중단."""


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
        if "quota" in str(exc).lower() or "status=429" in str(exc):
            raise QuotaExceededError(str(exc)) from exc
        logger.warning("운영시간 조회 실패(계속 진행): %s — %s", spot.name, exc)
        return None
    if not items:
        return None
    item = as_dict(items[0], "intro item")
    return _str_field(item, USETIME_FIELD[spot.content_type_id])


def fetch_first_image(
    session: requests.Session, service_key: str, spot: Spot
) -> str | None:
    """firstimage 부재 스팟용 — detailImage2의 첫 originimgurl (없으면 None)."""
    params = _base_params(service_key) | {
        "contentId": spot.content_id,
        "imageYN": "Y",
        "numOfRows": "1",
    }
    log_params = {k: v for k, v in params.items() if k != "serviceKey"}
    try:
        payload = get_json(session, f"{BASE_URL}/detailImage2", params, log_params=log_params)
        items, _ = _response_items(payload, f"detailImage2[{spot.content_id}]")
    except ExternalApiError as exc:
        if "quota" in str(exc).lower() or "status=429" in str(exc):
            raise QuotaExceededError(str(exc)) from exc
        logger.warning("이미지 조회 실패(계속 진행): %s — %s", spot.name, exc)
        return None
    if not items:
        return None
    item = as_dict(items[0], "image item")
    return _str_field(item, "originimgurl")


def main() -> None:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
    settings = load_settings()
    session = requests.Session()

    spots = fetch_spots(session, settings.data_go_kr_key)
    by_region: dict[str, int] = {}
    for s in spots:
        by_region[s.region] = by_region.get(s.region, 0) + 1
    logger.info("수집 스팟 %d건, 지역분포 %s", len(spots), by_region)
    if len(spots) < 700:
        raise RuntimeError(f"스팟 수가 비정상적으로 적음: {len(spots)} (기대 ~800)")

    db = SupabaseRest(settings.supabase_url, settings.supabase_service_role_key)
    # 쿼터 소진 등으로 이번에 못 받은 운영시간·이미지는 기존 DB 값 보존
    existing_hours: dict[str, str] = {}
    existing_images: dict[str, str] = {}
    for row in db.select_all("spots", {"select": "content_id,opening_hours,image_url"}):
        cid, oh, img = row.get("content_id"), row.get("opening_hours"), row.get("image_url")
        if isinstance(cid, str) and isinstance(oh, str):
            existing_hours[cid] = oh
        if isinstance(cid, str) and isinstance(img, str):
            existing_images[cid] = img

    logger.info("운영시간 보강 시작 (%d건, detailIntro2)", len(spots))
    hours: dict[str, str | None] = {}
    quota_hit = False
    for i, spot in enumerate(spots, 1):
        if quota_hit:
            hours[spot.content_id] = None
            continue
        try:
            hours[spot.content_id] = fetch_opening_hours(session, settings.data_go_kr_key, spot)
        except QuotaExceededError as exc:
            quota_hit = True
            hours[spot.content_id] = None
            logger.warning("쿼터 소진 — 운영시간 보강 중단(%d/%d): %s", i, len(spots), exc)
            continue
        if i % 100 == 0:
            logger.info("운영시간 %d/%d", i, len(spots))
        time.sleep(DETAIL_DELAY_SEC)

    # 이미지 보강 — firstimage도 기존 DB 값도 없는 스팟만 detailImage2 조회 (~40건)
    need_image = [
        s for s in spots if s.image_url is None and s.content_id not in existing_images
    ]
    logger.info("이미지 보강 시작 (%d건, detailImage2)", len(need_image))
    backfilled: dict[str, str] = {}
    for i, spot in enumerate(need_image, 1):
        if quota_hit:
            break
        try:
            img = fetch_first_image(session, settings.data_go_kr_key, spot)
        except QuotaExceededError as exc:
            quota_hit = True
            logger.warning("쿼터 소진 — 이미지 보강 중단(%d/%d): %s", i, len(need_image), exc)
            break
        if img:
            backfilled[spot.content_id] = img
        time.sleep(DETAIL_DELAY_SEC)
    logger.info("이미지 보강 결과: %d/%d건 확보", len(backfilled), len(need_image))

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
            "opening_hours": hours.get(s.content_id) or existing_hours.get(s.content_id),
            "image_url": s.image_url
            or backfilled.get(s.content_id)
            or existing_images.get(s.content_id),
            "is_outdoor": _is_outdoor(s.cat2),
            "region": s.region,
        }
        for s in spots
    ]
    inserted = db.insert("spots", rows, on_conflict="content_id")
    logger.info("spots 적재 완료: %d행", inserted)


if __name__ == "__main__":
    main()
