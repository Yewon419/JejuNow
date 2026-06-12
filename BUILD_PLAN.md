# JEJU NOW — 빌드 계획서 (Fable 인계용)

> 제주 관광 혼잡도 예측 기반 대안 코스 추천 서비스. 2026 관광데이터 활용 공모전(① 웹·앱 개발 부문) 제출작.
> 원본 기획: `jejunow_proposal.pdf`, `jejunow_proposal_v2.docx`
> 작성일 기준 확정 결정 + 미해결 리스크 + 단계별 실행 계획.

---

## 0. 한눈에 — 확정 결정 (Locked decisions)

| 항목 | 결정 | 비고 |
|---|---|---|
| 빌드 목표 | **실데이터·실모델 완전구현** | 데모용 합성 fallback 아님. 진짜 수집→학습→추론→추천 |
| 데이터/키 현황 | **거의 없음** | 발급·수집부터 시작. 대표가 직접 발급, 가이드는 §7 |
| 배포 타깃 | **App Store (iOS)** + 웹 데모 | 같은 코드베이스에서 둘 다 |
| 앱 프레임워크 | **Capacitor + Next.js (React + TypeScript)** | 근거 §3.1 |
| 백엔드 | **FastAPI (Python, strict typing) + Supabase(Postgres)** | 하이브리드 추론 §3.2 |
| 지도 | **Kakao Map (JS SDK)** | 177 스팟 마커 + 혼잡도 색상 |
| 디자인 | **mockup 톤만 유지, 자유 재설계** | `ui-ux-pro-max` 스킬 활용 |
| 모델 | **LightGBM 회귀** | ⚠️ R1 확정으로 타겟 변경: 월별 **인기 점유율(%)**(절대 검색량 아님). `FABLE_TASKS.md §2` 우선 |

---

## 1. 서비스 핵심 (기획 요약)

- **문제**: 제주 방문객 절반이 상위 10개 스팟에 쏠림 → 혼잡·만족도 저하·인프라 과부하. 기존 앱은 "인기 스팟" 추천이라 혼잡을 더 악화.
- **해법**: "지금/그날 어디가 한적한가"를 예측해 **대안 코스로 수요를 자연 분산**시키는 정책 도구.
- **핵심 기능 3종**
  1. **시간별 혼잡도 예측** — 제주 177개 관광지의 시간대별 수요 압력 지수, 지도+타임라인
  2. **대안 코스 즉시 추천** — 혼잡 스팟 탐지 시 동일 카테고리(cat2) 내 여유 스팟 자동 추천
  3. **여행 일정 혼잡도 시뮬레이션** — 사용자가 날짜+스팟 입력 → 슬롯별 예측 혼잡도, 혼잡 슬롯엔 시간 변경/대안 제시

---

## 2. ⚠️ 최우선 리스크 (Phase 0에서 먼저 검증할 것)

이 두 개가 막히면 "실데이터·실모델"이라는 전제 자체가 흔들린다. **코드 짜기 전에 먼저 검증.**

### R1 — 데이터랩 '내비게이션 목적지 검색량'의 실제 수집 경로 (BLOCKER)
- 이게 **모델의 핵심 학습 타겟 변수**다. 제안서는 "한국관광 데이터랩 API"라고 적었지만, 데이터랩(`datalab.visitkorea.or.kr`)의 내비 검색량은 **깔끔한 OpenAPI가 아니라 사이트 내 조회·엑셀 다운로드** 형태일 가능성이 높다.
- **검증 액션**: 데이터랩에서 제주(지역코드) × 관광지별 × 월별 내비 검색량을 (a) API로 받을 수 있는지, (b) 안 되면 다운로드 가능한 최대 입도/관광지 단위가 뭔지 확인.
- **막혔을 때 대안 (우선순위 순)**:
  1. 데이터랩 다운로드(엑셀/CSV) → 스크립트로 파싱·적재 (반자동, 갱신 주기 수동)
  2. 공공데이터포털 내 유사 관광 수요 데이터셋(지역별 방문자 수, 신용카드 소비 등)으로 타겟 대체
  3. TourAPI 자체 신호(있다면) + 입도객 거시지표로 다운스케일
- **결론 전까지 모델 코드 착수 금지.** 타겟 변수가 정해져야 §5 전체가 정해진다.

### R2 — 월별 데이터 ↔ "시간대별" UI 의 입도 간극 (설계 결정 필요)
- 데이터랩 검색량은 **월별**이고 입도객 통계도 월별인데, UI/제안서는 **"시간대별(hourly) 혼잡도"**와 "오늘/내일 타임라인"을 약속한다. **제안서엔 이 변환 로직이 없다.**
- **해결 설계**: 2단계 분해
  1. **월별 수요 압력 지수** = LightGBM 회귀 출력 (스팟 × 월)
  2. **일중(시간대) 분포 프로파일** = 카테고리(자연/해변/실내/시장 등) × 요일 × 시간대 가중치 곡선을 prior로 곱해 시간대 지수로 분해
     - 프로파일 출처 후보: TourAPI 운영시간, 일반적 관광 방문 패턴(오전/오후 피크), 기상(야외는 낮 집중) — 데이터 없으면 **휴리스틱 프로파일을 명시적 가정으로** 정의(코드·문서에 근거 기재).
- 즉 "시간대별"은 모델 직접 출력이 아니라 **월 수요 × 일중 프로파일** 합성이라는 걸 코드·발표자료에 정직하게 명시한다.

### R3 — 실측 혼잡도 ground truth 부재 (검증 한계)
- 실제 현장 혼잡도 라벨이 없으므로 모델 검증은 **검색량 hold-out 예측 정확도(프록시)**로만 가능.
- 발표/리포트에 "현재 검증 = 수요 프록시 기준, 실측 연동은 발전방향(장기)"이라고 한계를 명확히. 과장 금지.

### R4 — iOS 빌드 환경 (대표 = Windows)
- Capacitor도 iOS 빌드엔 **Mac/Xcode** 필요. Windows 우회: **GitHub Actions `macos-latest` 러너** 또는 Codemagic으로 클라우드 빌드 → `.ipa` 산출 → TestFlight 업로드.
- Apple Developer **연 $99** 필수(§7). 등록 전까지는 웹 데모 + 시뮬레이터로 개발 가능.

---

## 3. 아키텍처

```
┌─────────────────────────────────────────────────────────────┐
│  CLIENT (단일 코드베이스)                                      │
│  Next.js (React + TS)  ──build──>  Vercel (웹 데모 PWA)        │
│         │                                                     │
│         └────────  Capacitor 셸  ──>  iOS .ipa  ──> App Store  │
│  Kakao Maps JS SDK (지도·마커·혼잡색상)                         │
└───────────────┬─────────────────────────────────────────────┘
                │ REST (HTTPS)
┌───────────────▼─────────────────────────────────────────────┐
│  BACKEND  FastAPI (Python, strict typing)                     │
│   - /spots            177 스팟 메타 (TourAPI 동기화)           │
│   - /congestion       배치 precompute 결과 조회 (date, spot)  │
│   - /simulate         임의 날짜 일정 → 라이브 추론             │
│   - /alternatives     혼잡 스팟 → 동일 cat2 여유 대안          │
│  ── 배치 잡 (cron) ──                                          │
│   - collect_*         TourAPI / 데이터랩 / 기상청 수집         │
│   - train_model       LightGBM 재학습                         │
│   - precompute        177스팟 × 예측horizon 혼잡지수 적재      │
│  Railway 또는 Render 호스팅                                    │
└───────────────┬─────────────────────────────────────────────┘
                │
┌───────────────▼─────────────────────────────────────────────┐
│  Supabase (Postgres)                                          │
│   spots / search_volume / visitors / weather                 │
│   congestion_pred / day_profile / user_trips                 │
│  + Storage(스팟 이미지 캐시), Auth(선택)                       │
└─────────────────────────────────────────────────────────────┘
```

### 3.1 앱 프레임워크 = Capacitor + Next.js (근거)
- **Kakao Map JS SDK가 가장 성숙** — RN(Expo)용 Kakao 네이티브 래퍼는 커뮤니티 의존이라 유지보수·버전 리스크. 웹 JS SDK는 공식·안정.
- **하나의 코드베이스 → 웹 데모(Vercel) + App Store 셸** 동시 산출. 공모전 심사 데모 링크와 제출 앱이 동일 코드.
- Windows 반복 개발 마찰 최소. iOS 빌드만 클라우드(§R4).
- 트레이드오프: 웹뷰 기반이라 순수 네이티브 대비 모션 한계 — 디자인·트랜지션으로 충분히 커버(공모전 데모 수준엔 무리 없음).

### 3.2 백엔드 = FastAPI + Supabase, 하이브리드 추론 (근거)
- **배치 precompute**: 대시보드·지도·"오늘/내일"은 미리 계산한 `congestion_pred` 테이블 조회 → 빠르고 저렴.
- **라이브 추론**: 일정 시뮬레이션은 사용자가 **임의 미래 날짜**를 고르므로 `/simulate`에서 그 시점 피처 벡터 구성해 실시간 추론. → 제안서의 "실시간 추론" 명분도 유지.
- FastAPI = 대표 Python 표준(strict typing, `from __future__ import annotations`, no `Any`/`Dict[str,Any]`)과 일치.

---

## 4. 데이터 파이프라인

### 4.1 데이터 소스
| 소스 | 용도 | 발급/수집 |
|---|---|---|
| TourAPI 4.0 (국문관광정보) | 스팟 명칭·좌표·카테고리·운영시간·이미지. `areaBasedList2`(areaCode=39 제주), `detailCommon2` | 공공데이터포털 키 |
| 한국관광 데이터랩 — 내비 검색량 | **모델 학습 타겟** (스팟×월, 2021.01~). ⚠️R1 | 데이터랩(경로 검증 필요) |
| 한국관광 데이터랩 — 제주 입도객 | 거시 보조 피처(월 입도객·전년比) | 데이터랩 |
| 기상청 API | 월평균 기온·강수(야외 수요 직결) | 공공데이터포털 키 |

### 4.2 적재 스키마 (Supabase / Postgres)
```
spots(spot_id PK, content_id, name, cat1, cat2, cat3,
      lat, lng, addr, opening_hours, image_url, is_outdoor, region)
search_volume(spot_id FK, ym DATE, nav_search INT)      -- 학습 타겟
visitors(ym DATE, total_visitors INT, yoy_growth FLOAT)
weather(ym DATE, avg_temp FLOAT, precip_mm FLOAT)
congestion_pred(spot_id FK, date DATE, hour INT, pressure FLOAT, level SMALLINT)
day_profile(cat2 TEXT, weekday INT, hour INT, weight FLOAT)  -- 일중 분해 prior
user_trips(trip_id PK, user_id, date, spots JSONB, created_at)
```
- **177 스팟 커버리지 유지**: 데이터 미확보 스팟은 동일 cat2 평균값 대체(제안서 규약). 대체분은 `is_imputed` 플래그로 표시.
- 외부 데이터는 **적재 전 검증**(null/이상치/지연 가정) — 대표 표준. 수집 로그에 요청 파라미터·status·응답 본문 기록.

### 4.3 수집 잡 (FastAPI 배치, cron)
- `collect_spots` (TourAPI, 주 1회) / `collect_search_volume`(월 1회 또는 수동) / `collect_visitors` / `collect_weather`
- 모든 외부 호출: **retry + 로깅 후 raise**, 에러 메시지에 요청 파라미터·status·응답 본문 포함.

---

## 5. 모델 (LightGBM)

> **착수 전제: §R1(타겟 변수 수집 경로) 확정.**

- **타겟**: 스팟×월 내비 검색량(수요 프록시). 정규화 후 상위 30% = 혼잡 예상, 하위 30% = 여유(대안 후보).
- **피처** (제안서 표):
  - 시간: `month, quarter, is_peak, is_holiday, is_long_weekend`
  - Lag: `lag_1m, lag_3m, lag_12m, rolling_mean_3m, rolling_mean_6m`
  - 날씨: `avg_temp, precipitation_mm`
  - 거시: `jeju_total_visitors, yoy_growth`
  - 스팟: `cat2, region, is_outdoor`
- **분할**: time-based split (학습 ~2025.06 / 검증 2025.07~). **미래 누수 금지** — lag/rolling은 시점 이전 데이터만.
- **검증 지표**: 검증구간 MAE/MAPE + 랭킹 일치(상위/하위 30% 분류 정확도). 실측 부재(§R3) 정직 명시.
- **시간대 분해**: §R2 — 월 예측 × `day_profile` prior → `congestion_pred(date, hour)`.
- **대안 추천(4단계)**: 혼잡 스팟과 **동일 cat2** 내 수요압력 하위 30% 스팟 선정 → TourAPI로 운영정보·이미지 실시간 보강.

---

## 6. 앱 화면 (5종, mockup 톤 유지·자유 재설계)

mockup 순서: 시작화면 → 메인 대시보드 → 일정 페이지 → 혼잡도 예측 지도 → 코스 상세.

| 화면 | 핵심 내용 |
|---|---|
| **시작/온보딩** | 여행자 타입 선택(즉흥/계획). 다크 톤 히어로 |
| **메인 대시보드** | "오늘의 제주" — 지금 한적한 스팟 카드, 추천 코스 카드, 날씨 |
| **일정** | 내 여행 타임라인. 슬롯별 예측 혼잡도, 혼잡 슬롯 경고+시간변경/대안 |
| **혼잡도 지도** | Kakao Map + 177 마커, 혼잡도 색상(여유→혼잡 그라데이션), 시간 슬라이더 |
| **코스 상세** | 스팟별 운영정보·이미지·이동, "대안으로 안내하기" CTA |

- 디자인: `ui-ux-pro-max` 스킬로 톤(다크 시작 + 라이트 카드) 유지하되 레이아웃·컴포넌트는 재설계. 모바일 우선, PWA 매니페스트 + Capacitor 셸.

---

## 7. 대표 직접 발급 가이드 (계정·키) — 착수 전 준비물

> 계정 생성은 내가 대신 못 함. 아래 발급해서 키를 **`C:\Users\windg\Desktop\PROJECT\_keys\JejuNow\`** (프로젝트 밖 중앙 보관, repo에 안 올라감)에 넣어줘. 막히면 단계별로 도와줄게.

1. **공공데이터포털** (`data.go.kr`) — TourAPI 4.0 + 기상청 API 활용신청 → 서비스키. (회원가입→ 해당 OpenAPI "활용신청" → 마이페이지에서 인증키 확인)
2. **한국관광 데이터랩** (`datalab.visitkorea.or.kr`) — 내비 검색량·입도객 조회/다운로드 계정. **§R1 경로부터 같이 확인.**
3. **Kakao Developers** (`developers.kakao.com`) — 앱 생성 → JavaScript 키 + 플랫폼(웹 도메인/iOS 번들ID) 등록.
4. **Supabase** (`supabase.com`) — 프로젝트 생성 → URL + anon/service key.
5. **Railway 또는 Render** — FastAPI 배포용 계정.
6. **Vercel** — 웹 데모 배포(이미 사용 중).
7. **Apple Developer** (`developer.apple.com`) — **연 $99**. App Store 제출·TestFlight 필수. (§R4 — 보류 가능, 그동안 웹+시뮬레이터로 개발)
8. **GitHub** — `Yewon419` 하위 신규 repo (`git init` 후). iOS 클라우드 빌드(macOS 러너)도 여기.

**모든 키는 `.env` / gitignore. 하드코딩·커밋 금지.**

---

## 8. 단계별 실행 계획 (Phase)

> 대표 표준: >5파일 작업은 단계 분리, 각 Phase 완료·검증·승인 후 다음. 각 Phase 끝에 `mypy . && ruff check .`(백엔드), 린트·타입체크(프론트) 통과 후 "완료" 보고.

### Phase 0 — 리스크 해소 & 환경 (코드 거의 없음, 검증 위주)
- [ ] §R1 데이터랩 내비 검색량 수집 경로 확정 (API/다운로드/대체)
- [ ] 키 발급(§7) — 최소 공공데이터포털·Kakao·Supabase
- [ ] TourAPI `areaBasedList2`(제주)로 177 스팟 목록·좌표 1회 수집 검증
- [ ] repo 생성, 모노레포 구조(`/app` Next.js, `/api` FastAPI, `/ml` 학습), Supabase 스키마 마이그레이션
- **Gate**: 타겟 변수 확보 가능 확인. 못 하면 대체안(§R1) 대표 승인.

### Phase 1 — 데이터 파이프라인
- [ ] 수집 잡 4종(spots/search_volume/visitors/weather) + 적재 + 검증·로깅
- [ ] 177 커버리지 채우기(미확보 cat2 평균 대체 + `is_imputed`)
- **Gate**: Supabase에 학습용 테이블 적재 완료, 결측·이상치 리포트.

### Phase 2 — 모델
- [ ] 피처 엔지니어링(§5) + time-based split + LightGBM 학습
- [ ] 검증 지표(MAE/MAPE/랭킹정확도) + 누수 점검
- [ ] `day_profile` 일중 분해 prior 정의(§R2)
- [ ] `precompute` 배치 → `congestion_pred` 적재
- **Gate**: 검증 지표 합의, 시간대 분해 결과 sanity check.

### Phase 3 — 백엔드 API
- [ ] FastAPI `/spots /congestion /simulate /alternatives` (strict typing)
- [ ] 라이브 추론(`/simulate`) + 대안 추천 로직(cat2 하위 30%)
- [ ] Railway/Render 배포
- **Gate**: API 계약 확정, `mypy`·`ruff` clean.

### Phase 4 — 프론트 (5화면)
- [ ] Next.js 셋업 + 디자인 시스템(ui-ux-pro-max, 톤 유지)
- [ ] 5화면 + Kakao Map(마커·혼잡색상·시간 슬라이더)
- [ ] 일정 시뮬레이션 UX(혼잡 슬롯 경고·대안)
- [ ] PWA 매니페스트
- **Gate**: 웹 데모 Vercel 배포, 핵심 플로우 E2E.

### Phase 5 — 앱 패키징 & 제출
- [ ] Capacitor 셸 + iOS 프로젝트
- [ ] GitHub Actions macOS 러너(또는 Codemagic) → `.ipa` 클라우드 빌드
- [ ] Apple Developer 등록 → TestFlight → App Store 심사 제출 (대표 계정 필요)
- [ ] 공모전 제출물(데모 링크·발표자료·한계 명시)
- **Gate**: TestFlight 동작, 제출 패키지 완성.

---

## 9. 디렉터리 구조 (제안)

```
JejuNow/
├─ app/            # Next.js (React+TS) + Capacitor
│  ├─ src/...
│  ├─ capacitor.config.ts
│  └─ ios/
├─ api/            # FastAPI (strict typing)
│  ├─ collectors/  # TourAPI / 데이터랩 / 기상청
│  ├─ routes/
│  └─ jobs/        # precompute, train trigger
├─ ml/             # LightGBM 학습·피처
│  ├─ features.py
│  ├─ train.py
│  └─ profile.py   # 일중 분해 prior
├─ db/             # Supabase 마이그레이션
└─ BUILD_PLAN.md

# 키·시크릿은 repo 밖 중앙 보관:
#   C:\Users\windg\Desktop\PROJECT\_keys\JejuNow\  (.env, .env.template, 발급_체크리스트.md)
```

---

## 10. 코드 표준 (대표 글로벌 규칙)
- Python: `from __future__ import annotations`, strict typing 전체, `Any`/`Dict[str,Any]` 금지. 순수 함수·composition. ruff. import 상단. 명시적 raise.
- 외부 API: retry+로깅 후 raise, 에러에 요청 파라미터·status·응답 본문.
- 금융코드 아님이지만 외부 데이터 검증 원칙 동일 적용(null/malformed/지연 가정).
- 비밀키 하드코딩·커밋 금지. `git push --force` 금지(필요시 `--force-with-lease`). `--no-verify` 금지.
- 작업 완료 보고 전: `mypy . && ruff check .` 통과. 미통과면 "완료" 보고 금지.

---

## 11. 정직성 체크리스트 (발표·리포트 과장 방지)
- "시간대별"은 모델 직접 출력 아님 → 월 예측 × 일중 프로파일 합성임을 명시(§R2).
- 모델 검증 = 수요 프록시 기준, 실측 혼잡도 부재(§R3).
- 데이터 미확보 스팟은 cat2 평균 대체(`is_imputed`) — 커버리지 유지용 가정.
- 일중 분포 prior가 휴리스틱이면 그 근거를 문서화.
