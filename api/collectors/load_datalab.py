"""데이터랩 long CSV → Supabase `spot_popularity` 적재 + TourAPI 스팟 이름매핑.

매핑 전략(순서대로):
  1. db/spot_name_map.csv 의 수동 매핑(content_id 채워진 행) 우선
  2. 정규화 이름 완전일치 (공백·괄호내용·특수문자 제거)
실패분은 db/spot_name_map.csv 에 빈 content_id로 남겨 수동 보완 대상으로 리포트.

실행: .venv\\Scripts\\python.exe -m api.collectors.load_datalab
"""

from __future__ import annotations

import csv
import logging
import re
from dataclasses import dataclass
from pathlib import Path

from api.core.config import load_settings
from api.core.supabase import SupabaseRest

logger = logging.getLogger(__name__)

LONG_CSV = Path("data/datalab_popular_long.csv")
NAME_MAP_CSV = Path("db/spot_name_map.csv")
AGE_NORMALIZE = {
    "전체": "전체",
    "20대": "20",
    "30대": "30",
    "40대": "40",
    "50대": "50",
    "60대이상": "60",
}
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
            age = AGE_NORMALIZE.get(rec["age_group"].strip())
            if age is None or rec["region_code"] not in ("50110", "50130"):
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


def build_mapping(
    db: SupabaseRest, rows: list[DatalabRow]
) -> tuple[dict[str, int], list[tuple[str, str]]]:
    """datalab_spot_id → spots.spot_id 매핑과 미매핑 (id, name) 목록 반환."""
    spots = db.select_all("spots", {"select": "spot_id,content_id,name"})
    by_norm: dict[str, int] = {}
    by_content: dict[str, int] = {}
    for s in spots:
        spot_id_raw, name_raw, content_raw = s["spot_id"], s["name"], s["content_id"]
        if not isinstance(spot_id_raw, int) or not isinstance(name_raw, str):
            raise RuntimeError(f"spots 행 형식 불량: {s!r}")
        norm = normalize_name(name_raw)
        by_norm.setdefault(norm, spot_id_raw)
        if isinstance(content_raw, str):
            by_content[content_raw] = spot_id_raw

    manual = read_manual_map(NAME_MAP_CSV)
    uniq: dict[str, str] = {}  # datalab_spot_id → name
    for r in rows:
        uniq.setdefault(r.datalab_spot_id, r.datalab_spot_name)

    mapping: dict[str, int] = {}
    unmatched: list[tuple[str, str]] = []
    for dl_id, dl_name in uniq.items():
        manual_cid = manual.get(dl_id)
        if manual_cid and manual_cid in by_content:
            mapping[dl_id] = by_content[manual_cid]
            continue
        spot_id = by_norm.get(normalize_name(dl_name))
        if spot_id is not None:
            mapping[dl_id] = spot_id
        else:
            unmatched.append((dl_id, dl_name))
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
    mapping, unmatched = build_mapping(db, rows)
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
