"""GET /alternatives — 동일 cat2 내 여유(하위 압력) 대안 스팟 추천."""

from __future__ import annotations

import datetime
import math
from typing import Annotated

from fastapi import APIRouter, HTTPException, Query

from api.deps import get_predictor
from api.schemas import AlternativeOut

router = APIRouter()

MAX_ALTERNATIVES = 5


def _haversine_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    rad = math.pi / 180
    a = (
        math.sin((lat2 - lat1) * rad / 2) ** 2
        + math.cos(lat1 * rad) * math.cos(lat2 * rad) * math.sin((lng2 - lng1) * rad / 2) ** 2
    )
    return 6371 * 2 * math.asin(math.sqrt(a))


@router.get("/alternatives", response_model=list[AlternativeOut])
def get_alternatives(
    spot_id: Annotated[int, Query(description="혼잡 기준 스팟")],
    date: Annotated[datetime.date, Query(description="YYYY-MM-DD")],
    hour: Annotated[int, Query(ge=0, le=23)],
) -> list[AlternativeOut]:
    predictor = get_predictor()
    origin = predictor.spots.get(spot_id)
    if origin is None:
        raise HTTPException(status_code=404, detail=f"미등록 spot_id={spot_id}")

    candidates: list[AlternativeOut] = []
    for other_id, meta in predictor.spots.items():
        if other_id == spot_id or meta.cat2 != origin.cat2:
            continue
        pred = predictor.slot(other_id, date, hour)
        candidates.append(
            AlternativeOut(
                spot_id=other_id,
                name=meta.name,
                cat2=meta.cat2,
                lat=meta.lat,
                lng=meta.lng,
                image_url=meta.image_url,
                region=meta.region,
                pressure=pred.pressure,
                level=pred.level,
                is_imputed=pred.is_imputed,
                distance_km=round(_haversine_km(origin.lat, origin.lng, meta.lat, meta.lng), 2),
            )
        )
    # 동일 cat2 내 수요압력 하위 30% (BUILD_PLAN §5) → 비추정·근거리 우선
    # (app/src/lib/alternatives.ts와 동일 규칙 — 여유 풀 안에서는 가까운 곳이 실용적)
    candidates.sort(key=lambda c: c.pressure)
    bottom = candidates[: max(1, round(len(candidates) * 0.3))]
    bottom.sort(key=lambda c: (c.is_imputed, c.distance_km, c.pressure))
    return bottom[:MAX_ALTERNATIVES]
