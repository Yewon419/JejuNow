"""혼잡도 사전계산 — LivePredictor로 호라이즌 전체를 congestion_pred에 적재.

- 호라이즌: KST 오늘 ~ +44일 롤링, 시간 9~20시 (웹 데모 지도·슬라이더 범위)
  · app/src/lib/constants.ts는 +30일만 노출 — 주 1회 재실행 지연을 흡수하는 마진
- 적재는 upsert(PK 충돌 병합) 후 과거분 삭제 — 빈 테이블 노출 구간 없음
- 합성 로직·정직성 규약은 ml/inference.py 참조 (월예측 × 일중프로파일, is_imputed 표시)

실행: .venv\\Scripts\\python.exe -m ml.precompute
"""

from __future__ import annotations

import logging
from datetime import date, datetime, timedelta, timezone

from ml.data import make_db
from ml.inference import LivePredictor, level_of

logger = logging.getLogger(__name__)

WINDOW_DAYS = 45
HOURS = range(9, 21)


def kst_today() -> date:
    return (datetime.now(timezone.utc) + timedelta(hours=9)).date()


def main() -> None:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
    db = make_db()
    predictor = LivePredictor(db)

    horizon_start = kst_today()
    horizon_end = horizon_start + timedelta(days=WINDOW_DAYS - 1)
    logger.info("호라이즌: %s ~ %s (롤링 %d일)", horizon_start, horizon_end, WINDOW_DAYS)

    rows: list[dict[str, object]] = []
    day = horizon_start
    while day <= horizon_end:
        month = date(day.year, day.month, 1)
        weekday = day.weekday()
        pressures = predictor.month_pressures(month)
        for spot_id, meta in predictor.spots.items():
            base, is_imp = pressures[spot_id]
            for hour in HOURS:
                weight = predictor.profile_weight(meta.cat2, weekday, hour)
                pressure = round(min(100.0, base * weight), 2)
                rows.append(
                    {
                        "spot_id": spot_id,
                        "date": day.isoformat(),
                        "hour": hour,
                        "pressure": pressure,
                        "level": level_of(pressure),
                        "is_imputed": is_imp,
                    }
                )
        day += timedelta(days=1)

    logger.info("congestion_pred 행 생성: %d (upsert 시작)", len(rows))
    inserted = db.insert("congestion_pred", rows, on_conflict="spot_id,date,hour")
    logger.info("congestion_pred upsert: %d행", inserted)
    db.delete_where("congestion_pred", {"date": f"lt.{horizon_start.isoformat()}"})
    db.delete_where("congestion_pred", {"date": f"gt.{horizon_end.isoformat()}"})
    logger.info("호라이즌 밖(%s 미만·%s 초과) 잔재 삭제", horizon_start, horizon_end)


if __name__ == "__main__":
    main()
