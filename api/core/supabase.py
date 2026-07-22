"""Supabase PostgREST 클라이언트 — service_role 키로 적재·조회.

supabase-py 대신 PostgREST REST를 직접 호출(strict typing 유지, 의존성 최소).
"""

from __future__ import annotations

import json
import logging
import time

import requests

logger = logging.getLogger(__name__)

BATCH_SIZE = 500
MAX_RETRY = 3
RETRY_BACKOFF_SEC = 2.0


class SupabaseRestError(RuntimeError):
    """Supabase REST 호출 실패."""


class SupabaseRest:
    def __init__(self, url: str, service_role_key: str) -> None:
        self._base = url.rstrip("/") + "/rest/v1"
        self._session = requests.Session()
        self._session.headers.update(
            {
                "apikey": service_role_key,
                "Authorization": f"Bearer {service_role_key}",
                "Content-Type": "application/json",
            }
        )

    def _request(
        self,
        method: str,
        path: str,
        *,
        params: dict[str, str] | None = None,
        body: str | None = None,
        prefer: str | None = None,
    ) -> str:
        url = f"{self._base}/{path}"
        headers = {"Prefer": prefer} if prefer else {}
        last_err = ""
        for attempt in range(1, MAX_RETRY + 1):
            try:
                resp = self._session.request(
                    method, url, params=params, data=body, headers=headers, timeout=60
                )
            except requests.RequestException as exc:
                last_err = f"요청예외 {exc!r}"
                logger.warning("%s %s 시도 %d: %s", method, path, attempt, last_err)
                time.sleep(RETRY_BACKOFF_SEC * attempt)
                continue
            if 200 <= resp.status_code < 300:
                return resp.text
            last_err = f"status={resp.status_code} params={params} body={resp.text[:300]!r}"
            if 400 <= resp.status_code < 500:
                break  # 클라이언트 오류는 재시도 무의미
            logger.warning("%s %s 시도 %d: %s", method, path, attempt, last_err)
            time.sleep(RETRY_BACKOFF_SEC * attempt)
        raise SupabaseRestError(f"{method} {path} 실패: {last_err}")

    def insert(
        self,
        table: str,
        rows: list[dict[str, object]],
        *,
        on_conflict: str | None = None,
    ) -> int:
        """배치 INSERT (on_conflict 지정 시 upsert). 적재 행 수 반환."""
        total = 0
        for i in range(0, len(rows), BATCH_SIZE):
            batch = rows[i : i + BATCH_SIZE]
            params: dict[str, str] = {}
            prefer = "return=minimal"
            if on_conflict:
                params["on_conflict"] = on_conflict
                prefer = "return=minimal,resolution=merge-duplicates"
            self._request(
                "POST",
                table,
                params=params,
                body=json.dumps(batch, ensure_ascii=False),
                prefer=prefer,
            )
            total += len(batch)
            logger.info("%s 적재 %d/%d", table, total, len(rows))
        return total

    def select(self, table: str, params: dict[str, str]) -> list[dict[str, object]]:
        text = self._request("GET", table, params=params)
        parsed: object = json.loads(text)
        if not isinstance(parsed, list):
            raise SupabaseRestError(f"{table} SELECT: list 응답이 아님 — {type(parsed).__name__}")
        out: list[dict[str, object]] = []
        for item in parsed:
            if not isinstance(item, dict):
                raise SupabaseRestError(f"{table} SELECT: dict 행이 아님")
            out.append({str(k): v for k, v in item.items()})
        return out

    def select_all(
        self, table: str, params: dict[str, str], *, page: int = 1000
    ) -> list[dict[str, object]]:
        """offset 페이지네이션으로 전체 행 조회."""
        rows: list[dict[str, object]] = []
        offset = 0
        while True:
            q = dict(params)
            q["limit"] = str(page)
            q["offset"] = str(offset)
            chunk = self.select(table, q)
            rows.extend(chunk)
            if len(chunk) < page:
                return rows
            offset += page

    def update(self, table: str, params: dict[str, str], patch: dict[str, object]) -> None:
        """조건부 UPDATE (PATCH). params는 PostgREST 필터, patch는 갱신할 컬럼.
        upsert(INSERT ON CONFLICT)와 달리 identity PK·NOT NULL 컬럼과 무관하게 지정 행만 갱신한다.
        """
        if not params:
            raise SupabaseRestError(f"{table} UPDATE: 빈 필터 금지")
        self._request(
            "PATCH",
            table,
            params=params,
            body=json.dumps(patch, ensure_ascii=False),
            prefer="return=minimal",
        )

    def delete_all(self, table: str, key_col: str) -> None:
        """테이블 전체 삭제 (재적재용). PostgREST는 필터 필수라 not.is.null 사용."""
        self._request("DELETE", table, params={key_col: "not.is.null"})

    def delete_where(self, table: str, params: dict[str, str]) -> None:
        """조건부 삭제 (롤링 호라이즌 과거분 정리용). params는 PostgREST 필터."""
        if not params:
            raise SupabaseRestError(f"{table} DELETE: 빈 필터 금지 — delete_all을 사용할 것")
        self._request("DELETE", table, params=params)
