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

## 관광공사 데이터 활용 (공모전 필수요건)

| 소스 | 용도 | 활용 위치 |
|---|---|---|
| TourAPI 4.0 `areaBasedList2` | 제주 801스팟 명칭·좌표·분류 동기화 | `api/collectors/collect_spots.py` (주간 Actions) |
| TourAPI 4.0 `detailIntro2` | 운영시간 — 일중 프로파일 개·폐장 경계 | 동일 수집기 → `ml/profile.py` |
| 한국관광 데이터랩 인기관광지 점유율 | **모델 학습 타겟** (스팟×월, 8년) | `collect_datalab.py` → `ml/train.py` |
| 기상청 ASOS (공공데이터포털) | 월 기온·강수 피처 | `api/collectors/collect_weather.py` |

- 제주 월 입도객(거시 피처)은 제안서 계획이었으나 **미반영 유지**: 공공데이터포털
  제공분은 연 1회 갱신 파일(외국인 점유율 분석용)이라 월 단위 라이브 피처로 부적합,
  data.ijto.or.kr는 OpenAPI 미제공(사이트 조회 전용). 실측 연동과 함께 발전방향으로 명시.

## 일중 프로파일(day_profile) 근거

실측 시간대 방문 데이터가 없어 **명시적 가정의 휴리스틱**으로 정의한다 (`ml/profile.py`):
카테고리별 피크시각·폭(가우시안, 예: 자연경관 오후 피크·전시시설 낮 균등) ×
요일 가중(토·일 1.35, 금 1.10) × TourAPI 운영시간 개·폐장 경계. 성산일출봉 sanity
(평일13시 74 / 토13시 100 / 18시 15)로 방향성만 검증 — 곡선 자체의 실측 캘리브레이션은
발전방향(실측 혼잡도 연동 시).

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
python -m ml.precompute                    # 혼잡도 사전계산 (KST 오늘+45일 롤링, upsert)

# 프론트
cd app; npm run dev

# 배포 (vercel login 1회 후)
powershell -File scripts\deploy_vercel.ps1
```

게이트: `mypy . ; ruff check .` (Python), `npx tsc --noEmit ; npm run lint` (app/) — 전부 clean 유지.

## 심사 기간 무중단 운영 (10~11월 심사 대비)

- **Render 무료**(`render.yaml`)에 FastAPI 배포 — `/simulate` 라이브 추론·`/alternatives`.
  15분 슬립은 **UptimeRobot 5분 핑 → `/keepalive`**로 워밍. `/keepalive`는 실제 DB 쿼리를
  수행해 **Supabase 무료 티어 일시정지(7일 무활동, DB 쿼리만 활동으로 집계)까지 방지**.
- 프론트는 API 실패 시 Supabase precompute 조회로 자동 폴백 — 콜드스타트에도 데모 유지.
- GitHub Actions: 주간 `precompute`(롤링 재계산) · `collect-spots`(쿼터 리셋 직후 수·00:10 KST) ·
  `keepalive`(Supabase 백업 핑, 월·목). 무료 워크스페이스 750h/월 한도 — 상시 서비스 1개만.
