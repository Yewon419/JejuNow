"""앱 전역 싱글턴 — 설정·DB·라이브 예측기 (지연 초기화)."""

from __future__ import annotations

from functools import lru_cache

from api.core.config import Settings, load_settings
from api.core.supabase import SupabaseRest
from ml.data import SpotMeta, load_spots
from ml.inference import LivePredictor


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return load_settings()


@lru_cache(maxsize=1)
def get_db() -> SupabaseRest:
    settings = get_settings()
    return SupabaseRest(settings.supabase_url, settings.supabase_service_role_key)


@lru_cache(maxsize=1)
def get_spot_meta() -> dict[int, SpotMeta]:
    """스팟 메타만 필요한 경로용 — 모델·시계열 로딩(get_predictor)을 트리거하지 않는다."""
    return load_spots(get_db())


@lru_cache(maxsize=1)
def get_predictor() -> LivePredictor:
    """모델+시계열 로딩이 무거워 첫 호출 시 1회만 초기화."""
    return LivePredictor(get_db())
