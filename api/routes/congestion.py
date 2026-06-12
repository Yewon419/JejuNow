"""GET /congestion — 사전계산된 혼잡도 조회 (date·hour 단위)."""

from __future__ import annotations

import datetime
from typing import Annotated

from fastapi import APIRouter, HTTPException, Query

from api.deps import get_db
from api.schemas import CongestionOut

router = APIRouter()


@router.get("/congestion", response_model=list[CongestionOut])
def get_congestion(
    date: Annotated[datetime.date, Query(description="YYYY-MM-DD")],
    hour: Annotated[int, Query(ge=0, le=23)],
) -> list[CongestionOut]:
    db = get_db()
    rows = db.select_all(
        "congestion_pred",
        {
            "select": "spot_id,pressure,level,is_imputed",
            "date": f"eq.{date.isoformat()}",
            "hour": f"eq.{hour}",
        },
    )
    if not rows:
        raise HTTPException(
            status_code=404,
            detail="사전계산 호라이즌 밖 — POST /simulate로 라이브 추론을 사용하세요.",
        )
    out: list[CongestionOut] = []
    for r in rows:
        spot_id, pressure, level, imputed = r["spot_id"], r["pressure"], r["level"], r["is_imputed"]
        if (
            not isinstance(spot_id, int)
            or not isinstance(pressure, (int, float))
            or not isinstance(level, int)
            or not isinstance(imputed, bool)
        ):
            raise HTTPException(status_code=500, detail=f"congestion_pred 행 형식 불량: {r!r}")
        out.append(
            CongestionOut(
                spot_id=spot_id, pressure=float(pressure), level=level, is_imputed=imputed
            )
        )
    return out
