"""학습 데이터 로딩 — Supabase에서 spot_popularity·spots·weather 조회.

visitors(월 입도객)는 공개 API 미확보로 생략(FABLE_TASKS §4 — 거시피처 skip).
"""

from __future__ import annotations

import csv
import logging
from dataclasses import dataclass
from datetime import date
from pathlib import Path

from api.core.config import load_settings
from api.core.supabase import SupabaseRest

logger = logging.getLogger(__name__)

LONG_CSV = Path("data/datalab_popular_long.csv")


@dataclass(frozen=True)
class PopRow:
    datalab_spot_id: str
    region_code: str
    ym: date
    age_group: str
    rank: int
    ratio: float
    spot_id: int | None


@dataclass(frozen=True)
class SpotMeta:
    spot_id: int
    content_id: str
    name: str
    cat1: str | None
    cat2: str | None
    is_outdoor: bool | None
    region: str
    lat: float
    lng: float
    addr: str | None
    opening_hours: str | None
    image_url: str | None


def _parse_date(value: object, ctx: str) -> date:
    if not isinstance(value, str) or len(value) < 10:
        raise RuntimeError(f"{ctx}: date 형식 불량 {value!r}")
    return date(int(value[:4]), int(value[5:7]), int(value[8:10]))


def make_db() -> SupabaseRest:
    settings = load_settings()
    return SupabaseRest(settings.supabase_url, settings.supabase_service_role_key)


def load_popularity(db: SupabaseRest) -> list[PopRow]:
    raw = db.select_all(
        "spot_popularity",
        {
            "select": "datalab_spot_id,region_code,ym,age_group,rank,ratio,spot_id",
            "is_imputed": "eq.false",
            "order": "id",
        },
    )
    rows: list[PopRow] = []
    for r in raw:
        dl_id, region, age = r["datalab_spot_id"], r["region_code"], r["age_group"]
        rank, ratio, spot_id = r["rank"], r["ratio"], r["spot_id"]
        if (
            not isinstance(dl_id, str)
            or not isinstance(region, str)
            or not isinstance(age, str)
            or not isinstance(rank, int)
            or not isinstance(ratio, (int, float))
            or not isinstance(spot_id, (int, type(None)))
        ):
            raise RuntimeError(f"spot_popularity 행 형식 불량: {r!r}")
        rows.append(
            PopRow(
                datalab_spot_id=dl_id,
                region_code=region,
                ym=_parse_date(r["ym"], "spot_popularity.ym"),
                age_group=age,
                rank=rank,
                ratio=float(ratio),
                spot_id=spot_id,
            )
        )
    if not rows:
        raise RuntimeError("spot_popularity가 비어 있음 — Phase 1 적재 선행 필요")
    logger.info("spot_popularity %d행 로드", len(rows))
    return rows


def load_spots(db: SupabaseRest) -> dict[int, SpotMeta]:
    raw = db.select_all(
        "spots",
        {
            "select": (
                "spot_id,content_id,name,cat1,cat2,is_outdoor,region,"
                "lat,lng,addr,opening_hours,image_url"
            )
        },
    )
    out: dict[int, SpotMeta] = {}
    for r in raw:
        spot_id, name, region = r["spot_id"], r["name"], r["region"]
        lat, lng, content_id = r["lat"], r["lng"], r["content_id"]
        cat1, cat2, outdoor = r["cat1"], r["cat2"], r["is_outdoor"]
        addr, hours, image = r["addr"], r["opening_hours"], r["image_url"]
        if (
            not isinstance(spot_id, int)
            or not isinstance(content_id, str)
            or not isinstance(name, str)
            or not isinstance(region, str)
            or not isinstance(lat, (int, float))
            or not isinstance(lng, (int, float))
            or not isinstance(cat1, (str, type(None)))
            or not isinstance(cat2, (str, type(None)))
            or not isinstance(outdoor, (bool, type(None)))
            or not isinstance(addr, (str, type(None)))
            or not isinstance(hours, (str, type(None)))
            or not isinstance(image, (str, type(None)))
        ):
            raise RuntimeError(f"spots 행 형식 불량: {r!r}")
        out[spot_id] = SpotMeta(
            spot_id=spot_id,
            content_id=content_id,
            name=name,
            cat1=cat1,
            cat2=cat2,
            is_outdoor=outdoor,
            region=region,
            lat=float(lat),
            lng=float(lng),
            addr=addr,
            opening_hours=hours,
            image_url=image,
        )
    if not out:
        raise RuntimeError("spots가 비어 있음 — Phase 1 적재 선행 필요")
    logger.info("spots %d건 로드", len(out))
    return out


def load_datalab_categories(path: Path = LONG_CSV) -> dict[str, str]:
    """datalab_spot_id → 데이터랩 분류(관광명소 등). DB엔 미저장이라 로컬 CSV에서."""
    out: dict[str, str] = {}
    with path.open(encoding="utf-8-sig", newline="") as fp:
        for rec in csv.DictReader(fp):
            out.setdefault(rec["spot_id"].strip(), rec["category"].strip())
    if not out:
        raise RuntimeError(f"{path}: 데이터랩 분류 0건")
    return out


def load_weather(db: SupabaseRest) -> dict[date, tuple[float | None, float | None]]:
    raw = db.select_all("weather", {"select": "ym,avg_temp,precip_mm"})
    out: dict[date, tuple[float | None, float | None]] = {}
    for r in raw:
        temp, rain = r["avg_temp"], r["precip_mm"]
        if not isinstance(temp, (int, float, type(None))) or not isinstance(
            rain, (int, float, type(None))
        ):
            raise RuntimeError(f"weather 행 형식 불량: {r!r}")
        out[_parse_date(r["ym"], "weather.ym")] = (
            float(temp) if temp is not None else None,
            float(rain) if rain is not None else None,
        )
    logger.info("weather %d개월 로드", len(out))
    return out
