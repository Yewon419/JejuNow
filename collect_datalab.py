"""데이터랩 인기관광지 8년치 수집기 — getCsvData.do POST 직접 호출.

2018-01 ~ 2026-05 (101개월) × (제주시 50110 / 서귀포시 50130) = 202 요청.
각 요청은 6개 연령대(전체/20~60) zip(6 csv)을 반환한다.

산출물:
    data/raw/datalab/{SGG_CD}_{YM}.zip      원본 zip 보존(재파싱용)
    data/datalab_popular_long.csv           통합 long-format

실행:
    $env:DATALAB_KSESSIONID="<브라우저 KSESSIONID 값>"
    python collect_datalab.py
    python collect_datalab.py --start 202401 --end 202405   # 부분 수집

세션쿠키(KSESSIONID)는 곧 만료되므로 하드코딩 금지, 환경변수로만 주입.
"""

from __future__ import annotations

import argparse
import csv
import io
import json
import os
import sys
import time
import zipfile
from dataclasses import dataclass
from pathlib import Path

import requests

DATALAB_URL = "https://datalab.visitkorea.or.kr/visualize/getCsvData.do"
REFERER = "https://datalab.visitkorea.or.kr/datalab/portal/loc/getPopuTourAttrac.do"
ORIGIN = "https://datalab.visitkorea.or.kr"
QID_POPULAR = "MM_HO_HOT_001_003_DETAIL"
USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36"
)
AGE_GROUPS: tuple[tuple[str, str], ...] = (
    ("all", "전체"),
    ("20", "20대"),
    ("30", "30대"),
    ("40", "40대"),
    ("50", "50대"),
    ("60", "60대이상"),
)
DEFAULT_START = "201801"
DEFAULT_END = "202605"
REQUEST_DELAY_SEC = 0.6
MAX_RETRY = 3
RETRY_BACKOFF_SEC = 2.0
CONSECUTIVE_FAIL_ABORT = 3  # 연속 실패 시 쿠키 만료로 보고 중단

RAW_DIR = Path("data/raw/datalab")
OUT_CSV = Path("data/datalab_popular_long.csv")
LONG_HEADER = (
    "region_code",
    "region_name",
    "ym",
    "age_group",
    "rank",
    "spot_id",
    "spot_name",
    "category",
    "ratio",
)


@dataclass(frozen=True)
class Region:
    code: str
    name: str


REGIONS: tuple[Region, ...] = (
    Region("50110", "제주특별자치도 제주시"),
    Region("50130", "제주특별자치도 서귀포시"),
)


class CookieExpiredError(RuntimeError):
    """응답이 zip이 아니라 로그인/HTML — 세션쿠키 만료로 추정."""


def month_range(start_ym: str, end_ym: str) -> list[str]:
    year, month = int(start_ym[:4]), int(start_ym[4:])
    end_year, end_month = int(end_ym[:4]), int(end_ym[4:])
    out: list[str] = []
    while (year, month) <= (end_year, end_month):
        out.append(f"{year}{month:02d}")
        month += 1
        if month > 12:
            month, year = 1, year + 1
    return out


def build_params(region: Region, ym: str) -> list[dict[str, str]]:
    return [
        {
            "SGG_CD": region.code,
            "SGG_NM": region.name,
            "BASE_YM1": ym,
            "BASE_YM2": ym,
            "srchAreaDate": "1",
            "TAB_DIV": "1",
            "RENAME": region.name,
            "AGEG_DIV_CD": age_cd,
            "ALL_YN": "N",
            "qid": QID_POPULAR,
            "dnname": f"세대별 인기관광지({label})",
        }
        for age_cd, label in AGE_GROUPS
    ]


def make_session(ksession: str) -> requests.Session:
    session = requests.Session()
    session.headers.update(
        {
            "User-Agent": USER_AGENT,
            "Referer": REFERER,
            "Origin": ORIGIN,
            "Accept": "application/json",
        }
    )
    session.cookies.set("KSESSIONID", ksession, domain="datalab.visitkorea.or.kr")
    return session


def fetch_zip(session: requests.Session, region: Region, ym: str) -> bytes:
    files = {"params": (None, json.dumps(build_params(region, ym), ensure_ascii=False))}
    last_err = ""
    for attempt in range(1, MAX_RETRY + 1):
        try:
            resp = session.post(DATALAB_URL, files=files, timeout=30)
        except requests.RequestException as exc:
            last_err = f"요청예외 {exc!r}"
            time.sleep(RETRY_BACKOFF_SEC * attempt)
            continue
        ctype = resp.headers.get("Content-Type", "")
        if resp.status_code == 200 and "zip" in ctype:
            return resp.content
        if resp.status_code in (401, 403) or "html" in ctype.lower():
            raise CookieExpiredError(
                f"인증 실패 추정 status={resp.status_code} ctype={ctype!r}"
            )
        last_err = f"status={resp.status_code} ctype={ctype!r} body={resp.text[:200]!r}"
        time.sleep(RETRY_BACKOFF_SEC * attempt)
    raise RuntimeError(f"datalab POST 실패 region={region.code} ym={ym}: {last_err}")


def decode_csv(raw: bytes) -> str:
    for enc in ("utf-8-sig", "cp949"):
        try:
            return raw.decode(enc)
        except UnicodeDecodeError:
            continue
    raise RuntimeError("csv 디코딩 실패 (utf-8-sig·cp949 모두 불가)")


def parse_zip_rows(zip_bytes: bytes, region: Region, ym: str) -> list[tuple[str, ...]]:
    """zip 내 6개 csv 전체를 long-format 행 리스트로 변환."""
    rows: list[tuple[str, ...]] = []
    with zipfile.ZipFile(io.BytesIO(zip_bytes)) as zf:
        for name in zf.namelist():
            text = decode_csv(zf.read(name))
            lines = [ln for ln in text.splitlines() if ln.strip()]
            for line in lines[1:]:  # 헤더 제외
                cols = [c.strip() for c in line.split(",")]
                if len(cols) < 6:
                    continue  # 깨진 행 방어
                rank, spot_id, spot_name, category, age_grp, ratio = cols[:6]
                rows.append(
                    (
                        region.code,
                        region.name,
                        ym,
                        age_grp,
                        rank,
                        spot_id,
                        spot_name,
                        category,
                        ratio,
                    )
                )
    return rows


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="데이터랩 인기관광지 수집기")
    parser.add_argument("--start", default=DEFAULT_START, help="시작 연월 YYYYMM")
    parser.add_argument("--end", default=DEFAULT_END, help="종료 연월 YYYYMM")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    ksession = os.environ.get("DATALAB_KSESSIONID", "").strip()
    if not ksession:
        sys.exit("환경변수 DATALAB_KSESSIONID 가 필요합니다.")

    months = month_range(args.start, args.end)
    total = len(months) * len(REGIONS)
    RAW_DIR.mkdir(parents=True, exist_ok=True)
    OUT_CSV.parent.mkdir(parents=True, exist_ok=True)

    session = make_session(ksession)
    all_rows: list[tuple[str, ...]] = []
    failures: list[str] = []
    consecutive_fail = 0
    done = 0

    print(f"수집 시작: {len(months)}개월 × {len(REGIONS)}지역 = {total} 요청")
    for region in REGIONS:
        for ym in months:
            done += 1
            tag = f"{region.code}/{ym}"
            try:
                zip_bytes = fetch_zip(session, region, ym)
            except CookieExpiredError as exc:
                print(f"\n[중단] 세션쿠키 만료 추정 @ {tag}: {exc}")
                print("→ 브라우저에서 KSESSIONID 새로 떠서 다시 실행(이미 받은 건 보존).")
                _write_long_csv(all_rows)
                sys.exit(1)
            except RuntimeError as exc:
                failures.append(tag)
                consecutive_fail += 1
                print(f"[{done}/{total}] FAIL {tag}: {exc}")
                if consecutive_fail >= CONSECUTIVE_FAIL_ABORT:
                    print(f"\n[중단] 연속 {CONSECUTIVE_FAIL_ABORT}회 실패 — 점검 필요.")
                    _write_long_csv(all_rows)
                    sys.exit(1)
                continue

            consecutive_fail = 0
            (RAW_DIR / f"{region.code}_{ym}.zip").write_bytes(zip_bytes)
            rows = parse_zip_rows(zip_bytes, region, ym)
            all_rows.extend(rows)
            if done % 20 == 0 or done == total:
                print(f"[{done}/{total}] {tag} 누적행 {len(all_rows)}")
            time.sleep(REQUEST_DELAY_SEC)

    _write_long_csv(all_rows)
    print(f"\n완료: {len(all_rows)}행 → {OUT_CSV}")
    if failures:
        print(f"실패 {len(failures)}건: {failures}")


def _write_long_csv(rows: list[tuple[str, ...]]) -> None:
    with OUT_CSV.open("w", encoding="utf-8-sig", newline="") as fp:
        writer = csv.writer(fp)
        writer.writerow(LONG_HEADER)
        writer.writerows(rows)


if __name__ == "__main__":
    main()
