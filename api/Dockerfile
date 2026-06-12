# JejuNow FastAPI — Railway/Render 배포용 (빌드 컨텍스트 = repo 루트)
#   docker build -f api/Dockerfile -t jejunow-api .
# 환경변수(배포 대시보드에서 주입): DATA_GO_KR_SERVICE_KEY_DECODING, SUPABASE_URL,
#   SUPABASE_SERVICE_ROLE_KEY, SUPABASE_ANON_KEY, KAKAO_JS_KEY, KAKAO_REST_API_KEY
# 주의: ml/artifacts(model.txt 등)는 ml.train 산출물 — 빌드 전 존재해야 함.

FROM python:3.10-slim

WORKDIR /srv
RUN pip install --no-cache-dir fastapi uvicorn requests pandas lightgbm python-dotenv holidays \
    && apt-get update && apt-get install -y --no-install-recommends libgomp1 \
    && rm -rf /var/lib/apt/lists/*

COPY api/ api/
COPY ml/ ml/
COPY data/datalab_popular_long.csv data/datalab_popular_long.csv

EXPOSE 8000
CMD ["sh", "-c", "uvicorn api.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
