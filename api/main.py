"""JejuNow FastAPI 진입점 — 라우트는 Phase 3에서 구현."""

from __future__ import annotations

from fastapi import FastAPI

app = FastAPI(title="JejuNow API", version="0.1.0")


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}
