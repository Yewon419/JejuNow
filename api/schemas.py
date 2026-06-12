"""API 응답·요청 모델 (pydantic, strict typing)."""

from __future__ import annotations

import datetime

from pydantic import BaseModel, Field


class SpotOut(BaseModel):
    spot_id: int
    name: str
    cat1: str | None
    cat2: str | None
    lat: float
    lng: float
    addr: str | None
    opening_hours: str | None
    image_url: str | None
    is_outdoor: bool | None
    region: str


class CongestionOut(BaseModel):
    spot_id: int
    pressure: float = Field(description="수요 압력 0~100 (지역 내 상대값)")
    level: int = Field(description="1 여유 ~ 4 혼잡")
    is_imputed: bool = Field(description="True면 cat2 평균 대체 추정치")


class SimulateSlotIn(BaseModel):
    spot_id: int
    hour: int = Field(ge=0, le=23)


class SimulateRequest(BaseModel):
    date: datetime.date
    slots: list[SimulateSlotIn]


class SimulateSlotOut(BaseModel):
    spot_id: int
    hour: int
    pressure: float
    level: int
    is_imputed: bool
    crowded: bool = Field(description="level>=3 — 시간변경·대안 권장")


class SimulateResponse(BaseModel):
    date: datetime.date
    slots: list[SimulateSlotOut]
    note: str


class AlternativeOut(BaseModel):
    spot_id: int
    name: str
    cat2: str | None
    lat: float
    lng: float
    image_url: str | None
    region: str
    pressure: float
    level: int
    is_imputed: bool
    distance_km: float = Field(description="기준 스팟에서의 직선거리")
