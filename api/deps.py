"""앱 전역 싱글턴 — 설정·DB·라이브 예측기 (지연 초기화)."""

from __future__ import annotations

from functools import lru_cache

from api.core.config import Settings, load_settings
from api.core.supabase import SupabaseRest
from ml.inference import LivePredictor


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return load_settings()


@lru_cache(maxsize=1)
def get_db() -> SupabaseRest:
    settings = get_settings()
    return SupabaseRest(settings.supabase_url, settings.supabase_service_role_key)


@lru_cache(maxsize=1)
def get_predictor() -> LivePredictor:
    """모델+시계열 로딩이 무거워 첫 호출 시 1회만 초기화."""
    return LivePredictor(get_db())
