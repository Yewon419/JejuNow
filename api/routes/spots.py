"""GET /spots — 스팟 메타 목록."""

from __future__ import annotations

from fastapi import APIRouter

from api.deps import get_spot_meta
from api.schemas import SpotOut

router = APIRouter()


@router.get("/spots", response_model=list[SpotOut])
def list_spots() -> list[SpotOut]:
    spots = get_spot_meta()
    return [
        SpotOut(
            spot_id=m.spot_id,
            name=m.name,
            cat1=m.cat1,
            cat2=m.cat2,
            lat=m.lat,
            lng=m.lng,
            addr=m.addr,
            opening_hours=m.opening_hours,
            image_url=m.image_url,
            is_outdoor=m.is_outdoor,
            region=m.region,
        )
        for m in spots.values()
    ]
