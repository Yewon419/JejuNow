"""POST /simulate — 임의 날짜 일정 라이브 추론."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException

from api.deps import get_predictor
from api.schemas import SimulateRequest, SimulateResponse, SimulateSlotOut

router = APIRouter()

NOTE = (
    "시간대별 값은 월 수요예측(데이터랩 인기점유율%, 수요 프록시) × 일중 휴리스틱 "
    "프로파일의 합성이며 실측 혼잡도가 아닙니다. is_imputed=true는 cat2 평균 대체 추정치."
)


@router.post("/simulate", response_model=SimulateResponse)
def simulate(req: SimulateRequest) -> SimulateResponse:
    predictor = get_predictor()
    slots: list[SimulateSlotOut] = []
    for slot in req.slots:
        try:
            pred = predictor.slot(slot.spot_id, req.date, slot.hour)
        except KeyError as exc:
            raise HTTPException(status_code=404, detail=str(exc)) from exc
        slots.append(
            SimulateSlotOut(
                spot_id=slot.spot_id,
                hour=slot.hour,
                pressure=pred.pressure,
                level=pred.level,
                is_imputed=pred.is_imputed,
                crowded=pred.level >= 3,
            )
        )
    return SimulateResponse(date=req.date, slots=slots, note=NOTE)
