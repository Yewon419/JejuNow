# JejuNow 진행상황 (재개용)

> 재부팅/새 세션 시 이 파일부터 읽으면 이어서 진행 가능.
> 설계 = `BUILD_PLAN.md` + **설계 v2(2026-07-10, 아래)**. 자율 구현 지시서 = `FABLE_TASKS.md`.

## 현재 단계 (2026-07-11, 설계 v2 전체 반영 종료 — 필수 단계 없음)

**웹데모 복구 확인**: Supabase restore(07-11) → 전 라우트 200. Actions 3종 실전 검증 통과
(keepalive·precompute×2·collect-spots). 모델 3-way 재학습 반영: **test MAE 0.4607 /
MAPE 14.87% / top30 83.5%** (이전 0.423은 valid 낙관 편향 — 발표에는 test 수치 사용).
congestion_pred 롤링 적재 확인(07-11~, 주간 갱신). 로컬 API 실측: /simulate 콜드 3.5s·웜 10ms.
공모전 일정 = 개발 5~9월 → **심사 10~11월** — 심사 시점 무중단이 v2 설계의 1순위 목표.

**설계 v2 반영분 (커밋 bf32d38, gate PASS)**
- precompute 롤링(KST 오늘+45일)·upsert 전환, 프론트 호라이즌 동적(+30일)
- `congestion_pred (date,hour)` 인덱스 마이그레이션 0003 — **DB 복구 후 적용 필요**
- Actions 3종(precompute/collect-spots/keepalive) + repo 시크릿 6종 등록됨
- `/keepalive`(DB 쿼리 — Supabase 일시정지 방지), `/spots` 모델 결합 제거
- 프론트 `/simulate`·`/alternatives` 라이브 연결 + Supabase 폴백 (`app/src/lib/api.ts`)
- Railway 탈락($5/월 고정) → `render.yaml`(무료) + UptimeRobot 5분 핑 전략

**iOS 제출 (2026-07-20, Phase 1 완료):** Apple Developer 등록됨 → 번들 ID `com.jejunow.app`
등록 / ASC API 키 `jejunow-ci`(관리자, Key ID 53FC2HF9MX) 발급·`_keys\JejuNow\` 보관 /
GitHub 시크릿 4종 등록 / App Store Connect 앱 레코드 생성(App ID 6792661866, SKU jejunow) /
**ios-build.yml 실행 성공 → TestFlight 빌드 1.0.0(4) 업로드 완료**.

iOS CI 함정 3건 (전부 실패 후 수정):
1. Capacitor SPM 프로젝트는 `.xcworkspace`를 만들지 않음 → `-project App.xcodeproj` 사용
2. 자동 서명은 archive 단계에서 **개발용** 프로파일을 요구 → CI엔 등록 기기가 없어 발급 불가
3. `CODE_SIGN_IDENTITY="Apple Distribution"`을 자동 서명과 함께 주면 "conflicting provisioning
   settings"로 거부 → **무서명 아카이브(`CODE_SIGNING_ALLOWED=NO`) + exportArchive에서 배포
   서명**이 유일하게 통과한 조합. 빌드번호는 `github.run_number` 자동 증가

**등록정보 작성 완료 (2026-07-20):** 스크린샷 4장(1284×2778, 대시보드·지도·일정·상세) /
부제·프로모션·설명·키워드·지원/마케팅 URL·저작권 / 카테고리 여행+내비게이션 /
**출시 방식 = 수동 출시** / 개인정보 처리방침 페이지 신설·배포(`/privacy`).
심사 제출은 **하지 않음**(「심사에 추가」 미클릭).

**iOS 실기기 피드백 2건 수정 (2026-07-20, TestFlight 1.0.0(5)):**
1. 하단바가 홈 인디케이터에 겹침 → `viewportFit: "cover"` 누락이 원인.
   BottomNav엔 이미 `env(safe-area-inset-bottom)` 패딩이 있었지만 cover가 없으면
   **0px으로 계산돼 무효**였다. cover를 켜면 하단 시트도 안전지대를 벗어나므로
   ScheduleBuilder 스팟 선택 시트·RouteView에 세이프에어리어 패딩 동반 추가
2. 스팟 선택 시트를 열면 화면이 확대돼 좌측이 잘림 → **iOS는 포커스된 입력의 글꼴이
   16px 미만이면 페이지를 자동 확대**한다. 검색창이 14px + `autoFocus`라 즉시 발동.
   텍스트 입력 성격 필드를 16px로(검색창·날짜 2곳·시간 select). 체크박스·range는 무관
   ⚠ 둘 다 **브라우저에서는 재현되지 않는 iOS 고유 동작** — 실기기 검증 없이는 못 잡는다

**남은 것 (심사 제출 전 필수):** 앱 심사 정보의 **전화번호**(필수, 미입력으로 해당 섹션
저장 실패 상태) / **연령 등급 설문** / **개인정보 처리방침 URL 등록**(앱 정보 페이지에
`https://jejunow.vercel.app/privacy`)
⚠ 셸이 Vercel URL을 로드하는 웹뷰라 심사 가이드라인 4.2(최소 기능) 리젝 가능성 있음

**⚠ 장애 복구 (2026-07-20): 웹데모 전 페이지 500이었음. 원인 2건 모두 조치**
- Supabase 프로젝트 재차 일시정지(호스트 DNS 소멸) → Resume로 복구. 데이터 온전.
  **무중단 체계가 못 막았다**: UptimeRobot이 5분마다 치는 `/keepalive`는 Render 경유인데
  DB가 죽으면 503만 뱉고 DB를 깨우지 못한다(Render 자체는 정상, `/health` 200).
  구조적 해결은 미착수 — 승인 필요
- `spots.overview` 컬럼 부재로 상세 페이지 전량 500. 마이그레이션
  `0004_spots_overview_tel.sql`이 원격 DB에 **적용된 적 없었음**(코드만 07-13에 머지).
  SQL Editor로 적용 → 전 라우트 200 복구
- ⚠ **심사 기간과 겹치는 기한**: Supabase 일시정지 안내에 "90일 내 복구 가능,
  2026-10-18까지". 심사가 10~11월이라 재정지 후 방치되면 복구 불가 구간에 들어간다

**TestFlight:** 내부 그룹 `Internal`(자동 배포 켬) + 대표 계정 테스터 등록.
이후 `ios-build.yml` 실행분은 이 그룹에 자동 전달된다.

**완료 기록 (2026-07-12, deploy_vercel.ps1):** REST→CLI 전환은 8a3d11b에서 이미
반영돼 있었음(잔여 표시가 stale). 전환 후 첫 E2E 실행으로 검증 — env 5종
등록(production·preview)·env pull 무결성 통과·프로덕션 배포·전 라우트 200.

**완료 기록 (2026-07-12, 온보딩 실사진):** 그라데이션 카드 2장 → TourAPI 실사진
(즉흥=노을해안로 노을, 계획=광치기해변 새벽 일출 — "밤하늘" 컨셉은 TourAPI에 야간
사진이 없어 새벽 일출로 조정). 첫 화면 무중단을 위해 외부 핫링크 대신
`app/public/onboarding/` 번들. 로컬 시각 검증(기본+375px) 완료.

**무중단 체계 (심사 10~11월 대비, 2026-07-11 완성):**
- UptimeRobot 5분 핑 → `/keepalive`(매 핑 DB 쿼리 + 예측기 워밍) — 21분 유휴 실측으로
  슬립 방지 검증(3.4s 응답, 콜드 20s+ 아님). 장애 시 가입 이메일로 알림
- 주간 Actions: precompute 롤링(월 09:30 KST)·collect-spots(수 00:10)·Supabase 백업 핑(월·목)
- 프론트는 API 장애 시 Supabase precompute 폴백 — 어느 한쪽이 죽어도 데모 유지

**완료 기록 (2026-07-12, 위치 기반 3종):** 대시보드 근처 추천(현위치→일정 중심→전역 폴백) /
경로 칩 거리·시간 표시(카카오 호출 캐시 공유) / 대안 정렬 근거리 우선(TS·Python 동기).
Render 신정렬 반영 확인(07-12): dd60ffa 자동배포에 포함돼 있었음 — 라이브 /alternatives
응답 거리 오름차순 실측 검증. Manual Deploy 불필요.

**완료 기록 (2026-07-11 저녁, UI 사이클):** 지도 시트(사진 배경+흰 글씨+시간대 차트) /
상세 히어로 그라데이션 / 폰 프레임(max-w-md) / 이미지 정규화(http→https·BMP·detailImage2 보강) /
**경로 보기 인앱화** — 카카오내비→Vercel 함수(/api/kakao-route)→폴리라인 렌더 (함덕→김녕 E2E).
⚠ 카카오가 Render IP를 플래그(-401 KA, 유효 헤더도 거부) → Render의 /route는 사용 불가 존치,
카카오 호출은 Vercel 함수 경유가 유일 경로. 도로 밖 좌표(103)는 외부 카카오맵 폴백.

**완료 기록 (2026-07-11):** Supabase restore → 전 라우트 200 / 인덱스 0003 적용(대표) /
Render 배포 `https://jejunow-api.onrender.com` (/keepalive 200·simulate 콜드 19.9s·웜 0.4s) /
Vercel 재배포(NEXT_PUBLIC_API_URL 등록, CLI 48은 auth.json 정적 토큰이 아니라 CLI 명령으로
env 등록해야 함 — deploy_vercel.ps1의 REST 방식은 토큰 만료로 실패) /
**프로덕션 E2E: /schedule에서 POST /simulate·GET /alternatives 200 확인 (라이브 추론 실물화)** /
collect-spots로 운영시간 567→710 (잔여 91은 TourAPI 원천에 정보 없음 추정) /
UptimeRobot 모니터 등록·Up (대표) / Kakao JS 키 도메인 등록(신 콘솔: 플랫폼 키 → JS 키 수정 →
JavaScript SDK 도메인, 브라우저 자동화) → **지도 마커 라이브 렌더 확인**

### 디자인 (2026-06-24, 제안서 초안 반영 완료)
- 제안서 PDF 5p 목업 기준 **다크 네이비 → 라이트 테마** 전면 전환 (커밋 `3185393`)
- 토큰: `app/src/app/globals.css` (흰 배경/카드 #f4f6f9·#fff, 다크텍스트 #16213a, primary 틸 #0e7d8c, CTA 다크 #16213a, 혼잡 lv1~4 라이트 대비값)
- 온보딩: 큰 사진카드 2장(즉흥 노을/계획 밤하늘 그라데이션) — `TravelerTypeSelect.tsx`
- 대시보드: 붐비는 곳 2카드 → 큰 추천코스 카드(`FeatureCourseCard.tsx`) → 한적 그리드
- 일정: 세로 타임라인(연결선+컬러점) — `ScheduleBuilder.tsx`, `LevelDot` 추가
- 상세: 풀폭 히어로+둥근 시트+대안 썸네일 카드. 지도: 흰 시트·흰테두리 마커
- ⚠️ 다음 비주얼 변경 시 globals.css 토큰만 고치면 전 화면 반영됨

### 배포 메모 (2026-06-13)
- Vercel 프로젝트 `yewon419s-projects/jejunow`, 도메인 `jejunow.vercel.app`
- **함정 1**: `값 | npx vercel env add` 파이프가 env 값을 오염(40자→1104자)시켜 500 유발.
  → API(`POST /v10/projects/{id}/env`)로 등록해야 함. `scripts\deploy_vercel.ps1`이 API 방식으로 수정됨
- **함정 2**: 새 프로젝트 기본 Deployment Protection(SSO) → 401. API로 `ssoProtection:null` 해제
- Node 22.x 고정(로컬 검증 버전). NEXT_PUBLIC은 빌드타임 인라인이라 env 변경 후 재배포 필수
- 재배포: `powershell -File scripts\deploy_vercel.ps1` (login 상태에서)

## Phase별 결과
- **0.5 스캐폴딩** ✅ 모노레포(app/api/ml/db) + ruff/mypy strict + tsc/eslint 게이트
- **1 데이터** ✅ spots 801(lDongRegnCd=50, lcls 신분류) / spot_popularity 36,360행
  (매핑 5패스: exact 160·prefix 6·contain 19·kakao 47 = **스팟 76.1%, 행 89.2%**, 미매핑 73스팟 → `db/spot_name_map.csv`)
  / weather 101개월(ASOS 184) / visitors **skip**(공개 API 미확보)
- **2 모델** ✅ LightGBM(타겟=인기점유율%): 검증(2025-07~2026-05) **MAE 0.423, MAPE 14.1%, top30 87.2%, bottom30 73.7%**.
  day_profile 4,872행(lcls×요일×시간 휴리스틱). precompute **768,960행**(801스팟×2026-06-13~08-31×9~20시).
  성산일출봉 sanity: 평일13시 74/토13시 100/18시 15 — 주말·일중 효과 정상
- **3 백엔드** ✅ FastAPI `/spots /congestion /simulate /alternatives` 스모크 통과.
  Railway 토큰 없음 → Dockerfile·railway.toml만 준비(§4 규약)
- **4 프론트** ✅ 5화면(온보딩/대시보드/지도/일정/상세) + PWA + Vercel 배포 완료 + 초안 라이트 디자인 반영
- **5 셸** ✅(준비까지) Capacitor iOS 프로젝트 생성, GitHub Actions macOS 빌드 워크플로.
  .ipa·TestFlight·심사 = 사람 단계 — **여기서 정지**

## 운영 메모
- **TourAPI 일일쿼터(1000회) 소진됨** — 운영시간 567/801만 확보. 자정 리셋 후
  `python -m api.collectors.collect_spots` 재실행하면 나머지 보강(쿼터 fail-fast+기존값 보존 패치됨)
- congestion_pred 호라이즌: **주간 Actions(precompute.yml)가 KST 오늘+45일 롤링 재계산** —
  만료 개념 없음. 프론트는 +30일만 노출(constants.ts 동적 계산)이라 상수 동기 불필요
- GitHub: https://github.com/Yewon419/JejuNow (private)
- 정직성: 타겟=점유율%(절대 검색량 아님), 시간대=월예측×휴리스틱 프로파일 합성, 실측 혼잡도 없음, is_imputed 표시 — UI·API·모델 note에 명시됨

## 키 보관
`C:\Users\windg\Desktop\PROJECT\_keys\JejuNow\.env` (repo 밖). 전 키 검증 완료.
