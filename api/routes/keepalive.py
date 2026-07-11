"""GET /keepalive — 상시 워밍 핑 (UptimeRobot 대상).

- 실제 DB 쿼리를 매 핑 수행 — Supabase 무료 티어 일시정지 타이머는
  DB 활동으로만 리셋되므로 정적 응답으로는 무의미. (예측기 캐시 히트 시
  DB를 안 건드리므로 이 쿼리는 생략 불가)
- 예측기 워밍 — 재시작 후 첫 핑이 모델·시계열을 로딩(1회 ~20s, 이후 lru_cache 히트)
  → 사용자의 첫 /simulate가 항상 웜 응답.
/health는 Render 헬스체크용이라 DB 무관하게 유지 (DB 순단 시 재시작 루프 방지).
"""

from __future__ import annotations

from fastapi import APIRouter, HTTPException

from api.core.supabase import SupabaseRestError
from api.deps import get_db, get_predictor

router = APIRouter()


@router.get("/keepalive")
def keepalive() -> dict[str, str]:
    try:
        rows = get_db().select("spots", {"select": "spot_id", "limit": "1"})
        if not rows:
            raise HTTPException(status_code=503, detail="DB 응답은 있으나 spots가 비어 있음")
        get_predictor()
    except SupabaseRestError as exc:
        raise HTTPException(status_code=503, detail=f"DB 비활성: {exc}") from exc
    return {"status": "ok", "db": "active", "predictor": "warm"}
