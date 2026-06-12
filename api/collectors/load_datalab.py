"""데이터랩 long CSV → Supabase `spot_popularity` 적재 + TourAPI 스팟 이름매핑.

매핑 전략(순서대로, 패스별 건수 로깅):
  1. db/spot_name_map.csv 의 수동 매핑(content_id 채워진 행)
  2. 정규화 이름 완전일치 (공백·괄호내용·특수문자 제거)
  3. TourAPI 명칭의 지역 접두어("제주"/"서귀포"/"제주서귀포") 제거 후 일치
  4. 유일 포함 매칭 (한쪽 정규화명이 다른 쪽에 포함, 후보가 정확히 1개일 때만)
  5. Kakao Local 키워드검색 좌표 → 300m 내 최근접 TourAPI 스팟
실패분은 db/spot_name_map.csv 에 빈 content_id로 남겨 수동 보완 대상으로 리포트.

실행: .venv\\Scripts\\python.exe -m api.collectors.load_datalab
"""

from __future__ import annotations

import csv
import logging
import math
import re
import time
from dataclasses import dataclass
from pathlib import Path

import requests

from api.core.config import load_settings
from api.core.http import as_dict, as_list, get_json
from api.core.supabase import SupabaseRest

logger = logging.getLogger(__name__)

KAKAO_LOCAL_URL = "https://dapi.kakao.com/v2/local/search/keyword.json"
KAKAO_DELAY_SEC = 0.06
KAKAO_MATCH_RADIUS_KM = 0.3
REGION_PREFIXES = ("제주서귀포", "서귀포", "제주")

LONG_CSV = Path("data/datalab_popular_long.csv")
NAME_MAP_CSV = Path("db/spot_name_map.csv")
# long CSV는 이미 정규화된 값 사용 (collect_datalab.py 산출 스키마)
VALID_AGE_GROUPS = frozenset({"전체", "20", "30", "40", "50", "60"})
_PAREN_RE = re.compile(r"[\(\[（【].*?[\)\]）】]")
_STRIP_RE = re.compile(r"[\s·\-_&,'\".]+")


@dataclass(frozen=True)
class DatalabRow:
    region_code: str
    ym: str  # YYYY-MM-01
    age_group: str
    rank: int
    datalab_spot_id: str
    datalab_spot_name: str
    ratio: float


def normalize_name(name: str) -> str:
    out = _PAREN_RE.sub("", name)
    out = _STRIP_RE.sub("", out)
    return out.lower()


def read_long_csv(path: Path) -> list[DatalabRow]:
    rows: list[DatalabRow] = []
    bad = 0
    with path.open(encoding="utf-8-sig", newline="") as fp:
        for rec in csv.DictReader(fp):
            try:
                ym_raw = rec["ym"].strip()
                rank = int(rec["rank"])
                ratio = float(rec["ratio"])
            except (KeyError, ValueError):
                bad += 1
                continue
            if not (len(ym_raw) == 6 and ym_raw.isdigit()):
                bad += 1
                continue
            if not (1 <= rank <= 30 and 0.0 <= ratio <= 100.0):
                bad += 1
                continue
            age = rec["age_group"].strip()
            if age not in VALID_AGE_GROUPS or rec["region_code"] not in ("50110", "50130"):
                bad += 1
                continue
            rows.append(
                DatalabRow(
                    region_code=rec["region_code"],
                    ym=f"{ym_raw[:4]}-{ym_raw[4:]}-01",
                    age_group=age,
                    rank=rank,
                    datalab_spot_id=rec["spot_id"].strip(),
                    datalab_spot_name=rec["spot_name"].strip(),
                    ratio=ratio,
                )
            )
    if bad:
        logger.warning("검증 탈락 행 %d건 (형식·범위 불량)", bad)
    if not rows:
        raise RuntimeError(f"{path}: 유효 행 0건")
    return rows


def read_manual_map(path: Path) -> dict[str, str]:
    """수동 매핑 (datalab_spot_id → content_id). 파일 없거나 빈 content_id는 무시."""
    if not path.exists():
        return {}
    out: dict[str, str] = {}
    with path.open(encoding="utf-8-sig", newline="") as fp:
        for rec in csv.DictReader(fp):
            content_id = rec.get("content_id", "").strip()
            if content_id:
                out[rec["datalab_spot_id"].strip()] = content_id
    return out


@dataclass(frozen=True)
class SpotRef:
    spot_id: int
    norm: str
    lat: float
    lng: float


def _haversine_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    rad = math.pi / 180
    a = (
        math.sin((lat2 - lat1) * rad / 2) ** 2
        + math.cos(lat1 * rad) * math.cos(lat2 * rad) * math.sin((lng2 - lng1) * rad / 2) ** 2
    )
    return 6371 * 2 * math.asin(math.sqrt(a))


def _strip_region_prefix(norm: str) -> str:
    for prefix in REGION_PREFIXES:
        if norm.startswith(prefix) and len(norm) > len(prefix) + 1:
            return norm[len(prefix) :]
    return norm


def _kakao_resolve(
    session: requests.Session, rest_key: str, name: str
) -> tuple[float, float] | None:
    """Kakao Local 키워드검색 → (lat, lng). 결과 없으면 None."""
    session.headers["Authorization"] = f"KakaoAK {rest_key}"
    payload = get_json(
        session,
        KAKAO_LOCAL_URL,
        {"query": f"제주 {name}", "size": "3"},
        log_params={"query": f"제주 {name}"},
    )
    docs = as_list(as_dict(payload, "kakao").get("documents"), "kakao.documents")
    for raw in docs:
        doc = as_dict(raw, "kakao doc")
        x, y = doc.get("x"), doc.get("y")
        if isinstance(x, str) and isinstance(y, str):
            return float(y), float(x)
    return None


def build_mapping(
    db: SupabaseRest, rows: list[DatalabRow], kakao_rest_key: str
) -> tuple[dict[str, int], list[tuple[str, str]]]:
    """datalab_spot_id → spots.spot_id 매핑과 미매핑 (id, name) 목록 반환."""
    raw_spots = db.select_all("spots", {"select": "spot_id,content_id,name,lat,lng"})
    refs: list[SpotRef] = []
    by_content: dict[str, int] = {}
    for s in raw_spots:
        spot_id_raw, name_raw, content_raw = s["spot_id"], s["name"], s["content_id"]
        lat_raw, lng_raw = s["lat"], s["lng"]
        if (
            not isinstance(spot_id_raw, int)
            or not isinstance(name_raw, str)
            or not isinstance(lat_raw, (int, float))
            or not isinstance(lng_raw, (int, float))
        ):
            raise RuntimeError(f"spots 행 형식 불량: {s!r}")
        refs.append(
            SpotRef(spot_id_raw, normalize_name(name_raw), float(lat_raw), float(lng_raw))
        )
        if isinstance(content_raw, str):
            by_content[content_raw] = spot_id_raw

    by_norm: dict[str, int] = {}
    by_stripped: dict[str, int] = {}
    for ref in refs:
        by_norm.setdefault(ref.norm, ref.spot_id)
        by_stripped.setdefault(_strip_region_prefix(ref.norm), ref.spot_id)

    manual = read_manual_map(NAME_MAP_CSV)
    uniq: dict[str, str] = {}  # datalab_spot_id → name
    for r in rows:
        uniq.setdefault(r.datalab_spot_id, r.datalab_spot_name)

    mapping: dict[str, int] = {}
    pass_counts = {"manual": 0, "exact": 0, "prefix": 0, "contain": 0, "kakao": 0}
    pending: list[tuple[str, str]] = []
    for dl_id, dl_name in uniq.items():
        manual_cid = manual.get(dl_id)
        if manual_cid and manual_cid in by_content:
            mapping[dl_id] = by_content[manual_cid]
            pass_counts["manual"] += 1
            continue
        dl_norm = normalize_name(dl_name)
        spot_id = by_norm.get(dl_norm)
        if spot_id is not None:
            mapping[dl_id] = spot_id
            pass_counts["exact"] += 1
            continue
        spot_id = by_stripped.get(dl_norm)
        if spot_id is not None:
            mapping[dl_id] = spot_id
            pass_counts["prefix"] += 1
            continue
        if len(dl_norm) >= 4:
            candidates = {
                ref.spot_id
                for ref in refs
                if (dl_norm in ref.norm or (len(ref.norm) >= 4 and ref.norm in dl_norm))
            }
            if len(candidates) == 1:
                mapping[dl_id] = candidates.pop()
                pass_counts["contain"] += 1
                continue
        pending.append((dl_id, dl_name))

    kakao_session = requests.Session()
    unmatched: list[tuple[str, str]] = []
    for dl_id, dl_name in pending:
        coords = _kakao_resolve(kakao_session, kakao_rest_key, dl_name)
        time.sleep(KAKAO_DELAY_SEC)
        if coords is None:
            unmatched.append((dl_id, dl_name))
            continue
        lat, lng = coords
        nearest: tuple[float, int] | None = None
        for ref in refs:
            dist = _haversine_km(lat, lng, ref.lat, ref.lng)
            if nearest is None or dist < nearest[0]:
                nearest = (dist, ref.spot_id)
        if nearest is not None and nearest[0] <= KAKAO_MATCH_RADIUS_KM:
            mapping[dl_id] = nearest[1]
            pass_counts["kakao"] += 1
        else:
            unmatched.append((dl_id, dl_name))
    logger.info("매핑 패스별: %s", pass_counts)
    return mapping, unmatched


def write_unmatched_report(unmatched: list[tuple[str, str]], manual: dict[str, str]) -> None:
    """미매핑분을 spot_name_map.csv로 (기존 수동 매핑 행 보존)."""
    NAME_MAP_CSV.parent.mkdir(parents=True, exist_ok=True)
    with NAME_MAP_CSV.open("w", encoding="utf-8-sig", newline="") as fp:
        writer = csv.writer(fp)
        writer.writerow(("datalab_spot_id", "datalab_spot_name", "content_id"))
        for dl_id, cid in manual.items():
            writer.writerow((dl_id, "", cid))
        for dl_id, name in unmatched:
            writer.writerow((dl_id, name, ""))


def main() -> None:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
    settings = load_settings()
    db = SupabaseRest(settings.supabase_url, settings.supabase_service_role_key)

    rows = read_long_csv(LONG_CSV)
    logger.info("CSV 유효 행 %d건", len(rows))

    manual = read_manual_map(NAME_MAP_CSV)
    mapping, unmatched = build_mapping(db, rows, settings.kakao_rest_api_key)
    uniq_total = len(mapping) + len(unmatched)
    mapped_rows = sum(1 for r in rows if r.datalab_spot_id in mapping)
    logger.info(
        "매핑률: 스팟 %d/%d (%.1f%%), 행 %d/%d (%.1f%%)",
        len(mapping),
        uniq_total,
        100 * len(mapping) / uniq_total,
        mapped_rows,
        len(rows),
        100 * mapped_rows / len(rows),
    )
    write_unmatched_report(unmatched, manual)
    logger.info("미매핑 %d스팟 → %s (수동 보완용)", len(unmatched), NAME_MAP_CSV)

    payload: list[dict[str, object]] = [
        {
            "spot_id": mapping.get(r.datalab_spot_id),
            "datalab_spot_id": r.datalab_spot_id,
            "datalab_spot_name": r.datalab_spot_name,
            "region_code": r.region_code,
            "ym": r.ym,
            "age_group": r.age_group,
            "rank": r.rank,
            "ratio": r.ratio,
            "is_imputed": False,
        }
        for r in rows
    ]
    db.delete_all("spot_popularity", "id")
    inserted = db.insert("spot_popularity", payload)
    logger.info("spot_popularity 적재 완료: %d행", inserted)


if __name__ == "__main__":
    main()
