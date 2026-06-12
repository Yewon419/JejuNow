# FABLE_TASKS — JejuNow 자율 구현 지시서

> **새 세션 Fable 전용.** 이 파일 + `BUILD_PLAN.md` + `_keys\JejuNow\발급_체크리스트.md`를 먼저 읽고 시작한다.
> 작성 맥락: Phase 0(키·R1 검증) 완료 후 인계. 이전 세션의 결정·검증·수집은 모두 아래에 박혀 있다.
> 대표 글로벌 표준(`~/.claude/CLAUDE.md`)을 절대 준수. 한국어 반말 peer 톤, 호칭은 "대표님".

---

## 0. 시작 전 필독 (순서대로)

1. `BUILD_PLAN.md` — 전체 설계·아키텍처·스키마·Phase·리스크(R1~R4)·코드표준(§10)·정직성(§11)
2. `_keys\JejuNow\발급_체크리스트.md` — **R1 검증 결과 확정본** + 키 발급 현황
3. 이 파일 — 실행 순서·확보 자산·사람 대기 지점

**이 파일과 BUILD_PLAN이 충돌하면 이 파일이 우선**(더 최신 = R1 결과 반영).

---

## 1. 이미 확보된 자산 (재수집 금지)

| 자산 | 위치 | 상태 |
|---|---|---|
| 데이터랩 인기관광지 8년치 | `data/raw/datalab/*.zip` (202개) + `data/datalab_popular_long.csv` (36,360행) | ✅ 수집 완료 |
| 데이터랩 수집기 | `collect_datalab.py` | ✅ 검증됨(ruff/mypy clean). 재수집 필요시 `KSESSIONID` 환경변수로 |
| TourAPI 4.0 키 | `_keys\JejuNow\.env` (`DATA_GO_KR_SERVICE_KEY_*`) | ✅ 검증됨 (제주 areaCode=39, 관광지 384건) |

**`.env` 위치**: `C:\Users\windg\Desktop\PROJECT\_keys\JejuNow\.env` (repo 밖 중앙보관). 코드는 이 경로에서 로드. **절대 커밋·하드코딩 금지.**

### long CSV 스키마
```
region_code, region_name, ym, age_group, rank, spot_id, spot_name, category, ratio
```
- `region_code`: 50110(제주시) / 50130(서귀포시)
- `ym`: 201801 ~ 202605 (월)
- `age_group`: 전체 / 20 / 30 / 40 / 50 / 60
- `spot_id`: 데이터랩 해시 ID (TourAPI contentId와 **다름** — 이름으로 매핑 필요, §3 참조)
- `ratio`: 그 지역·월·연령대 인기관광지 중 **점유율(%)**. ⚠️ 절대 검색량 아님

---

## 2. R1 최종 결론 — 모델 타겟 (제안서에서 바뀐 핵심)

데이터랩에 스팟×월 **절대 검색량**은 없다. 대신 **스팟×월 인기 점유율(%)**, 기초지자체별 TOP30, 2018-01~2026-05.

→ **모델 타겟을 `nav_search`(절대값)에서 `popularity_ratio`(점유율%)로 변경.**
- 나머지 설계(LightGBM 시계열 회귀, lag/rolling, time-split, day_profile 일중분해)는 **그대로 유효**.
- 점유율 × 월 입도객수 = 의사 절대량 복원 가능(visitors 테이블과 곱). 이 변환은 선택적 파생피처.
- TOP30 밖/결측 스팟: 동일 cat2 평균 대체 + `is_imputed` 플래그 (BUILD_PLAN 규약).
- **정직성**: 발표·리포트에 "타겟=인기 점유율(수요 프록시), 절대 검색량/실측 혼잡도 아님" 명시 (BUILD_PLAN §11).

---

## 3. 실행 순서 (Phase별 + 게이트)

> 대표 표준: >5파일 작업은 단계 분리, 각 Phase 끝에 `mypy . && ruff check .`(백엔드/ml), 프론트 lint·typecheck 통과 후 진행. **게이트 미통과 시 "완료" 보고 금지.**

### Phase 0.5 — 스캐폴딩
- [ ] 모노레포 구조 생성: `app/`(Next.js+Capacitor) `api/`(FastAPI) `ml/`(LightGBM) `db/`(Supabase 마이그레이션). BUILD_PLAN §9.
- [ ] `git init` + `.gitignore` (`.env`·`data/raw`·`node_modules`·`__pycache__`·`*.ipa` 등). **`_keys\`는 이미 repo 밖.**
- [ ] Python: `pyproject.toml`(ruff+mypy strict), `from __future__ import annotations` 전제. Node: TS strict.
- **Gate**: 빈 구조에서 ruff/mypy/tsc 통과.

### Phase 1 — 데이터 파이프라인
> **Supabase MCP 우선**: 이 세션에 `supabase` MCP 도구가 붙어 인증돼 있으면(ToolSearch로 확인) 스키마 생성·마이그레이션·적재를 **MCP로 직접** 수행(psql 직접연결 불필요). 안 붙어있으면 `.env`의 `service_role_key`로 마이그레이션 스크립트 실행. 결과 스키마는 동일해야 함. MCP 인증(OAuth)은 사람이 미리 해둠 — 안 돼있으면 §4로 보고.
- [ ] `db/` Supabase 스키마 마이그레이션 (BUILD_PLAN §4.2). 단 `search_volume` → **`spot_popularity(spot_id, region_code, ym, age_group, rank, ratio, is_imputed)`** 로 변경(R1 반영).
- [ ] `collect_spots`: TourAPI `areaBasedList2`(areaCode=39) 384 스팟 → `spots` 적재(좌표·cat2·운영시간·이미지). UTF-8 응답.
- [ ] **데이터랩 ↔ TourAPI 스팟 매핑**: long CSV `spot_name` ↔ TourAPI `title` 정규화 매칭(공백·괄호 제거 후 일치, 실패분은 수동매핑 테이블 `db/spot_name_map.csv`로 남기고 리포트). 핵심 난관 — 정직하게 매칭률 로깅.
- [ ] `data/datalab_popular_long.csv` → `spot_popularity` 적재.
- [ ] `collect_weather`: 기상청 **"지상 ASOS 일자료 조회서비스"(data.go.kr 15059093, `getWthrDataList`)** 호출 → 제주 일별 기온·강수 → **월평균 집계** → `weather` 적재. 인증키는 `.env`의 `DATA_GO_KR_SERVICE_KEY`(TourAPI와 공통). 제주 ASOS 지점번호: **184 제주 / 188 성산 / 189 서귀포 / 185 고산**(주로 184 제주 사용, 결측 시 인근 지점 보완). 활용신청 미승인이면 skip + 빈 `weather` + 로그(§4). **참고**: 기상청 서비스는 2026-06-13 활용신청 완료했으나 게이트웨이 반영 전이라 그 시점 403이었음 — Phase 1 호출 시엔 풀려있을 가능성 높음. 그래도 403이면 반영대기로 보고 skip 후 나중 재시도.
- [ ] `collect_visitors`: 제주 월 입도객(데이터랩 또는 공공데이터). 확보 어려우면 거시피처 생략하고 로그.
- [ ] 외부 호출 전부 retry+로깅 후 raise, 에러에 요청파라미터·status·응답본문. 적재 전 null/이상치 검증.
- **Gate**: `spot_popularity` 적재 완료 + 매핑률·결측 리포트 출력.

### Phase 2 — 모델 (ml/)
- [ ] 피처: month·quarter·is_peak·is_holiday + lag(1·3·12m)·rolling(3·6m) + (있으면)날씨·입도객 + cat2·region·is_outdoor + **age_group**.
- [ ] 타겟 = `popularity_ratio`. time-based split(~2025.06 학습 / 2025.07~ 검증). **미래 누수 금지**(lag/rolling은 시점 이전만).
- [ ] 검증: MAE/MAPE + 랭킹 일치(상위/하위 30% 분류 정확도). 실측 부재 정직 명시.
- [ ] `day_profile` 일중분해 prior(cat2×요일×시간) — 휴리스틱이면 근거 문서화(BUILD_PLAN §R2).
- [ ] `precompute` → `congestion_pred(spot_id, date, hour, pressure, level)` 적재.
- **Gate**: 검증지표 산출 + 시간대 분해 sanity check + 누수 점검 통과.

### Phase 3 — 백엔드 (api/)
- [ ] FastAPI strict typing: `/spots` `/congestion` `/simulate`(라이브추론) `/alternatives`(동일 cat2 하위30%).
- [ ] Supabase 연결, 배치 잡(cron) 구조.
- [ ] Railway/Render 배포 (키 있으면). 없으면 로컬 실행 + 배포 설정파일만 준비.
- **Gate**: API 계약 확정, `mypy`·`ruff` clean, 주요 엔드포인트 스모크 테스트.

### Phase 4 — 프론트 (app/)
- [ ] Next.js(React+TS) + 디자인시스템. `ui-ux-pro-max` 스킬로 톤(다크 시작+라이트 카드) 유지, 레이아웃 재설계. 모바일 우선.
- [ ] 5화면: 온보딩 / 대시보드 / 일정 / **혼잡도 지도(Kakao Map 마커·혼잡색·시간슬라이더)** / 코스상세. BUILD_PLAN §6.
- [ ] 일정 시뮬레이션 UX(혼잡슬롯 경고·대안). PWA 매니페스트.
- [ ] **Vercel 배포 → 웹 데모 링크** (Fable 자율의 현실적 종착점).
- **Gate**: Vercel 배포 + 핵심 플로우 E2E.

### Phase 5 — 셸 (사람 검수 후)
- [ ] Capacitor iOS 프로젝트 구성까지. `.ipa` 빌드·TestFlight·App Store 제출은 **사람 단계**(§4) — 여기서 멈추고 대표께 보고.

---

## 4. ⚠️ 사람만 할 수 있는 것 (Fable은 막히면 멈추지 말고 skip+표시 후 계속)

| 항목 | 영향 | Fable 대응 |
|---|---|---|
| 기상청 키 미발급 | 날씨 피처 없음 | `weather` skip, 모델은 나머지 피처로 진행. 로그에 명시 |
| Kakao Web 도메인 미등록 | 그 도메인에서 지도 API 거부 | **JS·REST 키는 발급·검증됨**. 단 카카오 Web 플랫폼에 도메인 미등록 상태(포트 형식 문제로 보류). Phase 4에서 dev/배포 도메인 확정되면 **대표가 `http://localhost`(포트 없이)·Vercel 도메인 등록**해야 지도 표시. 그 전까진 지도 외 구현 진행 |
| Railway/Vercel 미연결 | 배포 불가 | 배포 설정파일(`vercel.json` 등)까지만, 실배포는 대기 |
| Apple Developer($99)·iOS 빌드·심사 | 스토어 제출 불가 | Phase 5에서 멈추고 보고 |

**원칙**: 키·계정 없다고 전체 멈추지 말 것. 가능한 부분 끝까지 진행하고, 막힌 지점을 **명확히 리포트**. 절대 mock을 실데이터인 척 보고하지 말 것(정직성).

---

## 5. 코드 표준 (대표 글로벌 — 위반 시 게이트 실패)

- Python: `from __future__ import annotations`, strict typing 전체, **`Any`/`Dict[str,Any]` 금지**. 순수함수·composition·dataclass/Pydantic. ruff. import 상단. 명시적 raise.
- 외부 API: retry+로깅 후 raise, 에러에 요청파라미터·status·응답본문. 외부데이터 적재 전 검증(null/malformed/지연 가정).
- 비밀키 하드코딩·커밋 금지. `.env`/gitignore. `git push --force` 금지(필요시 `--force-with-lease`). `--no-verify` 금지.
- 작업 완료 보고 전 `mypy . && ruff check .` 통과. 미통과면 "완료" 보고 금지.
- 스코프 규율: 요청 밖 기능·리팩터·추상화 추가 금지. 최소 수술적 변경.

## 6. 정직성 체크리스트 (BUILD_PLAN §11)
- "시간대별"은 모델 직접출력 아님 → 월예측 × 일중프로파일 합성 명시.
- 모델 검증 = 수요 프록시(점유율) 기준, 실측 혼잡도 부재.
- 타겟은 절대 검색량 아닌 **인기 점유율%** — 발표자료에 명시.
- 데이터 미확보 스팟은 cat2 평균 대체(`is_imputed`).
- mock/skip한 부분을 실데이터처럼 보고 금지.

---

## 7. 보고 방식
- 각 Phase 게이트 통과 시: 바뀐 파일 목록 + `mypy`/`ruff`(또는 tsc/lint) 결과 + 다음 Phase 예고.
- 막힌 지점(§4)은 즉시 별도 표시.
- 추정·불확실은 "모름/확인필요"로 명시하고 소스·코드로 확인. 라이브러리 API 시그니처 임의 발명 금지.
