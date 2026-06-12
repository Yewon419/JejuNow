# JejuNow — 한적한 제주를 찾아서

제주 관광지 **혼잡도 예측 + 대안 코스 추천** 서비스. 2026 관광데이터 활용 공모전 출품작.

상위 스팟 쏠림(혼잡·만족도 저하)을 완화하기 위해, "지금/그날 어디가 한적한가"를 예측해
같은 카테고리의 한적한 대안으로 수요를 분산시킨다.

## 아키텍처

```
app/  Next.js 16 (TS, Tailwind v4) + Capacitor iOS 셸 → Vercel(PWA 웹데모) / App Store
api/  FastAPI — /spots /congestion /simulate(라이브 추론) /alternatives
ml/   LightGBM 월 수요예측 + 일중분해 prior + precompute 배치
db/   Supabase(Postgres) 마이그레이션 — spots, spot_popularity, weather,
      day_profile, congestion_pred(+is_imputed), user_trips
```

- **데이터**: 한국관광 데이터랩 인기관광지 점유율 8년(2018-01~2026-05, 36,360행) ·
  TourAPI 4.0 제주 801스팟(lDongRegnCd=50) · 기상청 ASOS 101개월
- **모델**: LightGBM 회귀, 타겟 = 스팟×월 **인기 점유율%**(수요 프록시).
  time-split 검증(2025-07~) MAE 0.423 / MAPE 14.1% / 상위30% 랭킹일치 87.2%
- **시간대 분해**: 월 예측 × (카테고리×요일×시간) 휴리스틱 프로파일 합성

## 정직성 (한계 명시)

- 타겟은 **절대 검색량이 아니라 인기 점유율%** — 수요 프록시이며 실측 혼잡도가 아님
- "시간대별" 값은 모델 직접 출력이 아니라 **월 예측 × 일중 프로파일 합성**
- 데이터랩 TOP30 밖/미매핑 스팟은 동일 카테고리 평균 대체(`is_imputed=true`, UI에 "추정" 표시)
- 모델 검증은 점유율 hold-out 기준 — 실측 혼잡도 라벨 부재

## 실행

```powershell
# 백엔드 (키는 _keys\JejuNow\.env — repo 밖)
.venv\Scripts\uvicorn.exe api.main:app --reload

# 파이프라인 (순서대로)
python -m api.collectors.collect_spots     # TourAPI (일일쿼터 1000 주의)
python -m api.collectors.collect_weather   # 기상청 ASOS
python -m api.collectors.load_datalab      # 데이터랩 CSV 적재 + 이름매핑(5패스)
python -m ml.profile                       # 일중 prior
python -m ml.train                         # 학습 (ml/artifacts/)
python -m ml.precompute                    # 혼잡도 사전계산 (호라이즌 ~2026-08-31)

# 프론트
cd app; npm run dev

# 배포 (vercel login 1회 후)
powershell -File scripts\deploy_vercel.ps1
```

게이트: `mypy . ; ruff check .` (Python), `npx tsc --noEmit ; npm run lint` (app/) — 전부 clean 유지.
