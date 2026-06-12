"""환경설정 로더 — repo 밖 중앙보관 .env(_keys\\JejuNow)에서 키를 읽는다.

배포 환경에서는 JEJUNOW_ENV_FILE 또는 프로세스 환경변수로 주입한다.
키 하드코딩·커밋 금지.
"""

from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path

from dotenv import load_dotenv

DEFAULT_ENV_FILE = Path(r"C:\Users\windg\Desktop\PROJECT\_keys\JejuNow\.env")


@dataclass(frozen=True)
class Settings:
    data_go_kr_key: str
    supabase_url: str
    supabase_service_role_key: str
    supabase_anon_key: str
    kakao_js_key: str


def _required(name: str) -> str:
    value = os.environ.get(name, "").strip()
    if not value:
        raise RuntimeError(f"환경변수 {name} 누락 — {DEFAULT_ENV_FILE} 또는 배포 env 확인")
    return value


def load_settings() -> Settings:
    env_file = Path(os.environ.get("JEJUNOW_ENV_FILE", str(DEFAULT_ENV_FILE)))
    if env_file.exists():
        load_dotenv(env_file, encoding="utf-8")
    return Settings(
        data_go_kr_key=_required("DATA_GO_KR_SERVICE_KEY_DECODING"),
        supabase_url=_required("SUPABASE_URL"),
        supabase_service_role_key=_required("SUPABASE_SERVICE_ROLE_KEY"),
        supabase_anon_key=_required("SUPABASE_ANON_KEY"),
        kakao_js_key=_required("KAKAO_JS_KEY"),
    )
