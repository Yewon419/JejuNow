"""혼잡도 사전계산 — LivePredictor로 호라이즌 전체를 congestion_pred에 적재.

- 호라이즌: 2026-06-13 ~ 2026-08-31, 시간 9~20시 (웹 데모 지도·슬라이더 범위)
- 합성 로직·정직성 규약은 ml/inference.py 참조 (월예측 × 일중프로파일, is_imputed 표시)

실행: .venv\\Scripts\\python.exe -m ml.precompute
"""

from __future__ import annotations

import logging
from datetime import date, timedelta

from ml.data import make_db
from ml.inference import LivePredictor, level_of

logger = logging.getLogger(__name__)

HORIZON_START = date(2026, 6, 13)
HORIZON_END = date(2026, 8, 31)
HOURS = range(9, 21)


def main() -> None:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
    db = make_db()
    predictor = LivePredictor(db)

    rows: list[dict[str, object]] = []
    day = HORIZON_START
    while day <= HORIZON_END:
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

    logger.info("congestion_pred 행 생성: %d (적재 시작)", len(rows))
    db.delete_all("congestion_pred", "spot_id")
    inserted = db.insert("congestion_pred", rows)
    logger.info("congestion_pred 적재 완료: %d행", inserted)


if __name__ == "__main__":
    main()
