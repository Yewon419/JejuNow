"""JejuNow FastAPI 진입점.

실행: .venv\\Scripts\\uvicorn.exe api.main:app --reload
"""

from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from api.routes.alternatives import router as alternatives_router
from api.routes.congestion import router as congestion_router
from api.routes.keepalive import router as keepalive_router
from api.routes.simulate import router as simulate_router
from api.routes.spots import router as spots_router

app = FastAPI(
    title="JejuNow API",
    version="0.1.0",
    description=(
        "제주 관광 혼잡도 예측 API. 혼잡도 = 데이터랩 인기점유율(수요 프록시) 예측 × "
        "일중 휴리스틱 프로파일 합성 — 실측 혼잡도 아님."
    ),
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # 공모전 데모 — 운영 전환 시 도메인 제한
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)
app.include_router(spots_router)
app.include_router(congestion_router)
app.include_router(simulate_router)
app.include_router(alternatives_router)
app.include_router(keepalive_router)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}
