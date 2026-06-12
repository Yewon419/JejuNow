"""기상청 지상 ASOS 일자료(getWthrDataList) → 월평균 집계 → `weather` 적재.

지점: 184 제주 (주). 결측 월은 188 성산 → 189 서귀포 → 185 고산 순으로 보완.
활용신청 게이트웨이 미반영(403)이면 skip하고 빈 weather로 진행 — 호출부에서 처리.

실행: .venv\\Scripts\\python.exe -m api.collectors.collect_weather
"""

from __future__ import annotations

import logging
import time
from collections import defaultdict

import requests

from api.core.config import load_settings
from api.core.http import ExternalApiError, as_dict, as_list, get_json
from api.core.supabase import SupabaseRest

logger = logging.getLogger(__name__)

ASOS_URL = "https://apis.data.go.kr/1360000/AsosDalyInfoService/getWthrDataList"
STATIONS = ("184", "188", "189", "185")  # 제주, 성산, 서귀포, 고산
START_YEAR = 2018
END_DATE = "20260531"
NUM_ROWS = 400
REQUEST_DELAY_SEC = 0.3


class WeatherNotReadyError(RuntimeError):
    """활용신청 게이트웨이 미반영 등 인증 거부 — skip 대상."""


def _items_of(payload: object, ctx: str) -> list[object]:
    root = as_dict(payload, ctx)
    response = as_dict(root.get("response"), f"{ctx}.response")
    header = as_dict(response.get("header"), f"{ctx}.header")
    code = header.get("resultCode")
    if code == "03":  # NODATA
        return []
    if code != "00":
        msg = header.get("resultMsg")
        raise ExternalApiError(f"{ctx}: resultCode={code!r} msg={msg!r}")
    body = as_dict(response.get("body"), f"{ctx}.body")
    items_obj = body.get("items")
    if items_obj is None or items_obj == "":
        return []
    items = as_dict(items_obj, f"{ctx}.items").get("item")
    if items is None:
        return []
    if isinstance(items, dict):
        return [items]
    return as_list(items, f"{ctx}.item")


def fetch_station_daily(
    session: requests.Session, service_key: str, stn_id: str
) -> dict[str, list[tuple[float | None, float | None]]]:
    """지점의 일자료 → {YYYY-MM: [(avg_temp, precip), ...]}. 403이면 WeatherNotReadyError."""
    by_month: dict[str, list[tuple[float | None, float | None]]] = defaultdict(list)
    for year in range(START_YEAR, 2027):
        start = f"{year}0101"
        end = min(int(f"{year}1231"), int(END_DATE))
        if int(start) > int(END_DATE):
            break
        page = 1
        while True:
            params = {
                "serviceKey": service_key,
                "pageNo": str(page),
                "numOfRows": str(NUM_ROWS),
                "dataType": "JSON",
                "dataCd": "ASOS",
                "dateCd": "DAY",
                "startDt": start,
                "endDt": str(end),
                "stnIds": stn_id,
            }
            log_params = {k: v for k, v in params.items() if k != "serviceKey"}
            try:
                payload = get_json(session, ASOS_URL, params, log_params=log_params)
            except ExternalApiError as exc:
                if "status=403" in str(exc) or "SERVICE_KEY" in str(exc):
                    raise WeatherNotReadyError(f"지점 {stn_id}: 인증 거부 — {exc}") from exc
                raise
            items = _items_of(payload, f"ASOS[{stn_id}/{year}]")
            for raw in items:
                item = as_dict(raw, "asos item")
                tm = item.get("tm")  # YYYY-MM-DD
                if not isinstance(tm, str) or len(tm) < 7:
                    continue
                avg_ta = _float_or_none(item.get("avgTa"))
                sum_rn = _float_or_none(item.get("sumRn"))
                by_month[tm[:7]].append((avg_ta, sum_rn if sum_rn is not None else 0.0))
            if len(items) < NUM_ROWS:
                break
            page += 1
            time.sleep(REQUEST_DELAY_SEC)
        time.sleep(REQUEST_DELAY_SEC)
    return dict(by_month)


def _float_or_none(value: object) -> float | None:
    if isinstance(value, (int, float)):
        return float(value)
    if isinstance(value, str) and value.strip():
        try:
            return float(value)
        except ValueError:
            return None
    return None


def monthly_aggregate(
    daily: dict[str, list[tuple[float | None, float | None]]],
) -> dict[str, tuple[float | None, float | None]]:
    """월별 (평균기온, 강수합). 일수 20 미만인 달은 결측 처리."""
    out: dict[str, tuple[float | None, float | None]] = {}
    for month, days in daily.items():
        temps = [t for t, _ in days if t is not None]
        rains = [r for _, r in days if r is not None]
        if len(temps) < 20:
            out[month] = (None, None)
            continue
        out[month] = (sum(temps) / len(temps), sum(rains))
    return out


def main() -> None:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
    settings = load_settings()
    session = requests.Session()

    merged: dict[str, tuple[float | None, float | None]] = {}
    for stn in STATIONS:
        monthly = monthly_aggregate(fetch_station_daily(session, settings.data_go_kr_key, stn))
        filled = 0
        for month, (temp, rain) in monthly.items():
            if temp is None:
                continue
            if month not in merged or merged[month][0] is None:
                merged[month] = (temp, rain)
                filled += 1
        logger.info("지점 %s: %d개월 채움 (누적 %d)", stn, filled, len(merged))
        if stn == STATIONS[0] and len(merged) >= 99:
            break  # 주지점으로 충분하면 보조지점 생략

    if not merged:
        raise RuntimeError("weather: 수집 결과 0개월")
    rows: list[dict[str, object]] = [
        {"ym": f"{month}-01", "avg_temp": temp, "precip_mm": rain}
        for month, (temp, rain) in sorted(merged.items())
        if temp is not None
    ]
    db = SupabaseRest(settings.supabase_url, settings.supabase_service_role_key)
    inserted = db.insert("weather", rows, on_conflict="ym")
    logger.info("weather 적재 완료: %d행", inserted)


if __name__ == "__main__":
    main()
