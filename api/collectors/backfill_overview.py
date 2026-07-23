"""spots.overview·tel 초기 백필 — DB에 overview 없는 스팟만 detailCommon2 조회 후 upsert.

collect_spots 주간 실행은 운영시간 801콜을 쓰므로(일일 쿼터 1000) 초기 백필
(~801콜)은 이 스크립트로 분리 실행한다. 재실행 안전 — missing만 조회하며,
쿼터 소진 시 확보분까지 적재하고 종료(다음 실행이 잔여분 이어감).

선행: db/migrations/0004_spots_overview_tel.sql 적용.
실행: .venv\\Scripts\\python.exe -m api.collectors.backfill_overview
"""

from __future__ import annotations

import logging
import time

import requests

from api.collectors.collect_spots import (
    DETAIL_DELAY_SEC,
    QuotaExceededError,
    fetch_overview_tel,
)
from api.core.config import load_settings
from api.core.supabase import SupabaseRest

logger = logging.getLogger(__name__)


def main() -> None:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
    settings = load_settings()
    db = SupabaseRest(settings.supabase_url, settings.supabase_service_role_key)
    session = requests.Session()

    targets: list[tuple[str, str]] = []
    for row in db.select_all(
        "spots", {"select": "content_id,name,overview", "order": "spot_id"}
    ):
        cid, name, ov = row.get("content_id"), row.get("name"), row.get("overview")
        if isinstance(cid, str) and isinstance(name, str) and not isinstance(ov, str):
            targets.append((cid, name))
    logger.info("백필 대상 %d건 (overview 없는 스팟)", len(targets))

    patches: list[dict[str, object]] = []
    for i, (cid, name) in enumerate(targets, 1):
        try:
            ov, tel, homepage = fetch_overview_tel(session, settings.data_go_kr_key, cid, name)
        except QuotaExceededError as exc:
            logger.warning("쿼터 소진 — 백필 중단(%d/%d): %s", i, len(targets), exc)
            break
        if ov or tel or homepage:
            patches.append(
                {"content_id": cid, "overview": ov, "tel": tel, "homepage": homepage}
            )
        if i % 100 == 0:
            logger.info("백필 %d/%d (확보 %d)", i, len(targets), len(patches))
        time.sleep(DETAIL_DELAY_SEC)

    if not patches:
        logger.info("적재할 소개 없음 — 종료")
        return
    # 부분 upsert: 충돌 행은 payload에 있는 컬럼(overview·tel)만 갱신됨.
    # content_id가 전부 DB에서 온 값이라 신규 insert(NOT NULL 위반) 경로 없음.
    inserted = db.insert("spots", patches, on_conflict="content_id")
    logger.info("소개 백필 완료: %d행 (대상 %d건)", inserted, len(targets))


if __name__ == "__main__":
    main()
