"""spots.homepage 초기 백필 — homepage 없는 스팟 전체를 detailCommon2로 조회해 개별 UPDATE.

상세 페이지 「홈페이지·예매」 링크용. 확보한 스팟만 즉시 반영(PATCH by content_id)이라
중단돼도 확보분이 남고 재실행이 잔여분을 이어간다. 쿼터(일 1000) 소진 시 종료.

선행: db/migrations/0006_spots_homepage.sql 적용.
실행: .venv\\Scripts\\python.exe -m api.collectors.backfill_homepage
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
        "spots", {"select": "content_id,name,homepage", "order": "spot_id"}
    ):
        cid, name, hp = row.get("content_id"), row.get("name"), row.get("homepage")
        if isinstance(cid, str) and isinstance(name, str) and not isinstance(hp, str):
            targets.append((cid, name))
    logger.info("백필 대상 %d건 (homepage 없는 스팟)", len(targets))

    found = 0
    for i, (cid, name) in enumerate(targets, 1):
        try:
            _, _, homepage = fetch_overview_tel(session, settings.data_go_kr_key, cid, name)
        except QuotaExceededError as exc:
            logger.warning("쿼터 소진 — 백필 중단(%d/%d, 확보 %d): %s", i, len(targets), found, exc)
            break
        if homepage:
            db.update("spots", {"content_id": f"eq.{cid}"}, {"homepage": homepage})
            found += 1
        if i % 100 == 0:
            logger.info("백필 %d/%d (확보 %d)", i, len(targets), found)
        time.sleep(DETAIL_DELAY_SEC)

    logger.info("homepage 백필 종료: 대상 %d건 중 %d건 확보", len(targets), found)


if __name__ == "__main__":
    main()
