"""외부 API 공용 GET 헬퍼 — retry + 로깅 후 raise (대표 표준).

에러 메시지에 요청 파라미터·status·응답 본문을 포함한다.
serviceKey 같은 비밀값은 log_params로 마스킹해서 넘긴다.
"""

from __future__ import annotations

import logging
import time
from typing import cast

import requests

logger = logging.getLogger(__name__)

MAX_RETRY = 3
RETRY_BACKOFF_SEC = 2.0


class ExternalApiError(RuntimeError):
    """외부 API 호출 실패."""


def get_json(
    session: requests.Session,
    url: str,
    params: dict[str, str],
    *,
    timeout: float = 30.0,
    log_params: dict[str, str] | None = None,
) -> object:
    safe = log_params if log_params is not None else params
    last_err = ""
    for attempt in range(1, MAX_RETRY + 1):
        try:
            resp = session.get(url, params=params, timeout=timeout)
        except requests.RequestException as exc:
            last_err = f"요청예외 {exc!r}"
            logger.warning("GET %s 시도 %d: %s params=%s", url, attempt, last_err, safe)
            time.sleep(RETRY_BACKOFF_SEC * attempt)
            continue
        if resp.status_code == 200:
            try:
                return resp.json()
            except ValueError:
                last_err = f"JSON 파싱 실패 body={resp.text[:300]!r}"
        else:
            last_err = f"status={resp.status_code} body={resp.text[:300]!r}"
        logger.warning("GET %s 시도 %d: %s params=%s", url, attempt, last_err, safe)
        time.sleep(RETRY_BACKOFF_SEC * attempt)
    raise ExternalApiError(f"GET {url} 실패 params={safe}: {last_err}")


def as_dict(value: object, ctx: str) -> dict[str, object]:
    if not isinstance(value, dict):
        raise ExternalApiError(f"{ctx}: dict 응답이 아님 — {type(value).__name__}")
    return cast("dict[str, object]", value)


def as_list(value: object, ctx: str) -> list[object]:
    if not isinstance(value, list):
        raise ExternalApiError(f"{ctx}: list 응답이 아님 — {type(value).__name__}")
    return cast("list[object]", value)
