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

**iOS 실기기 피드백 3~4건차 + 로딩 개선 (2026-07-20, TestFlight 1.0.0(7)):**
- 하단바가 떠 보임(빌드 5 회귀) → **인셋을 바깥 래퍼에 주면 배경 있는 자식이 통째로
  밀려 올라간다.** 네이티브 UITabBar는 `bottom:0`에 붙은 채 높이만 커지고(콘텐츠 49pt +
  인셋 34pt = 83pt) 홈 인디케이터를 배경으로 덮는다. 인셋을 배경 요소 자신의 padding으로
  이동. `backdrop-blur`는 fixed 요소에서 iOS 스크롤 부하가 커 불투명 배경으로 교체
- 상단 검은 띠 → `capacitor.config.ts`의 `contentInset: "automatic"`이 원인.
  이 값은 iOS `contentInsetAdjustmentBehavior`에 매핑되고 **기본값은 `never`**.
  viewport-fit=cover로 CSS가 이미 env()로 인셋을 처리하는데 UIKit이 또 넣어 이중 처리되며
  스크롤뷰 배경(검정)이 드러났다. `never`로 되돌리고 각 화면 상단에 safe-area-inset-top 반영
- 이미지: 썸네일 2곳(상세 대안 56px·대시보드 붐빔 96px)이 CSS `backgroundImage`로 원본을
  직접 받고 있었다(최대 594KB 1장). next/image 교체 → **상세 이미지 1,022KB → 41KB**
- 폰트: CSS `@import`는 이 파일 수신 후에야 발견돼 직렬 대기(우리 CSS → jsdelivr CSS →
  폰트). layout의 `<link>`+`preconnect`로 이동

**캐싱 = ISR 전환 (2026-07-20):**
- `force-dynamic`이 **모든 fetch를 no-store로 덮어써**(Next 문서 명시) `supabase.ts`에
  걸어둔 revalidate(spots 3600·congestion 1800·weather 86400)가 전부 무효였다
- 페이지별 revalidate: dashboard·map·spots 300초, schedule 3600초(시각 의존 없음).
  시각 의존값은 5분마다 재평가되고 시가 바뀌면 fetch 키(`hour=eq.N`)가 달라져 새로 조회
- ⚠ **`spots/[id]`는 `revalidate`만으로 캐시가 안 생긴다.** `generateStaticParams`가 없으면
  완전 동적 라우트로 취급된다(실측 x-vercel-cache 연속 MISS). 빈 배열을 반환해 프리렌더 0개로
  두되 정적+폴백 라우트로 등록 → 빌드 표기 ƒ(Dynamic)→●(SSG), 재측정 MISS→HIT 확인
- 실측: 문서 수신 300~1000ms → **28~113ms**, FCP 대시보드 0.8~1.0초·상세 0.7~0.9초
- 부수 효과: Supabase 장애 시에도 캐시된 HTML이 계속 서빙된다(무중단에 유리)

**온보딩·튜토리얼 (2026-07-20, 3 Phase 완료, TestFlight 1.0.0(9)):**
- ⚠ **온보딩 반복 버그 수정**: `jejunow:travelerType`을 쓰기만 하고 읽는 코드가 없었다.
  Capacitor가 매 실행마다 루트를 여는 구조와 겹쳐 재방문자도 온보딩을 매번 봤다.
  `OnboardingGate`가 저장값을 읽어 목적지로 replace(판정 전엔 미렌더 — 깜빡임 방지)
- **코치마크 방식**: 좌표가 아니라 `data-coach` DOM 앵커를 런타임 측정 → 화면 크기·데이터
  변화에 견딘다. 스포트라이트는 box-shadow 확장으로 구멍. 대상 없으면 그 단계 건너뜀
- ⚠ **한 단계도 못 보여줬으면 완료 저장 안 함** — 빈 일정처럼 대상이 없는 화면에서 조용히
  완료 처리되어 영영 안 뜨는 문제를 막는다. 일정은 항상 존재하는 「+ 스팟 추가」를 앵커로
- 적용: 지도 2단계, 대시보드 2단계, 상세 2단계, 일정 1단계
- **설정 화면 신설**(`/settings`, 탭 아닌 독립 라우트 + 대시보드 헤더 톱니):
  사용법 다시 보기 / 여행자 유형 다시 고르기 / 데이터·출처 안내 / 개인정보 처리방침 링크
  — 유형 재선택은 온보딩 1회화로 사라진 경로를 복구한 것
- 서버 컴포넌트에서 클라이언트 `CoachMark`를 그대로 렌더 가능 — 래퍼 불필요(초기 계획 정정)
- ✅ **버전 단일 출처화**(2026-07-20): `package.json`(0.1.0 → **1.0.0**)이 유일한 출처.
  `next.config`가 `env.NEXT_PUBLIC_APP_VERSION`으로 인라인하고, `ios-build.yml`은
  하드코딩을 걷어내고 `node -p require('./package.json').version`으로 읽어
  `MARKETING_VERSION`에 주입. **버전 올릴 땐 package.json만 고치면 된다**
  (CI 로그로 `MARKETING_VERSION = 1.0.0` 주입 실측 확인). 설정 화면 하단에 표기

**디자인 감성 개선 P1~P5 (2026-07-21, 여행앱 레퍼런스 조사 기반):**
- 조사 핵심: 감성적 여행앱은 색을 늘리지 않고 사진·액센트 1개·미세모션·문구·empty state에 몰아넣음
- P1 히어로 정리: 상세 히어로에 운영시간(4줄)이 사진을 덮던 문제 → 이름·지역·주소만 남기고
  운영시간·전화는 사진 밖 카드로. 이름 2rem, 그라데이션 강화
- P2 사진 톤 통일: `.photo-warm`(saturate/contrast/sepia 약하게) 유틸로 TourAPI 사진 색온도 난잡함 정돈
- P3 색: 배경 찬 회색 → warm 오프화이트(#f6f4ef). 액센트(CTA) 다크네이비 → **스카이블루 #1a9fff**
  (⚠ 감귤은 혼잡도 오렌지와 충돌 + 전국 확대로 기각. 시안 대조로 확정)
- P4 모션(CSS만): 혼잡도 차트 막대 draw-in(왼→오른쪽 stagger), 카드 순차 등장. reduced-motion 자동 존중
- P5 empty state: 빈 일정·검색없음·데이터없음을 라인 아이콘+안내 문구 장면으로(전국 확대라 제주 로컬 일러 지양)
- ⚠ **혼잡도 4색(초록~빨강)은 정보라 warm 필터·감성 그라데이션 절대 미적용** — 전 단계 관통 제약
- ⚠ **전국 확대 계획** 확인(디자인·색·카피에서 제주 로컬 특화 지양) — 상세 [[project_jejunow]]
- 검증: 전 단계 tsc·eslint 0오류 + web-runtime-verify로 화면별 스크린샷/모션 프레임 대조

**경로 기능 2단 보강 (2026-07-21~22):**
- 진단: 경로는 고장이 아니었다. 앱·인증·Vercel 함수·지도 렌더 전부 정상(도로 접근 좋은
  스팟은 앱 내 폴리라인 정상). 성산일출봉 등 **유명 관광지 좌표가 봉우리·해안 정중앙**이라
  카카오내비가 "주변 도로 없음(102)"으로 거부 → 폴백으로 빠지던 구조적 한계.
  ⚠ 카카오내비 API에 좌표→도로 스냅(radius) 옵션 없음(origin/destination은 name·angle만)
- ① 폴백 UX 개선(커밋 560f050): `fetchRoute` 리턴을 실패 이유 union으로 —
  422=`offroad`(확정, 캐시 유지)는 "도보·자연 구간이라 경로를 그릴 수 없어요" 안내 톤 +
  직선거리(haversine), 그 외=`error`(콜드스타트·타임아웃, 캐시 비움)는 재시도 톤
- ② 도로 접근점 좌표 보정(커밋 78a03dc): 스팟별 최근접 주차장(카카오 PK6, 반경 800m)
  좌표를 `route_lat/lng`로 저장, **경로 계산에만** 사용(마커·거리·상세 표시는 원 좌표 유지).
  590/802(73.6%) 확보. 800m는 전체 dry-run 거리 분포로 결정(≤300m 396·1km↑ 오매칭 82개 배제)
  - 마이그레이션 0005(`spots.route_lat/lng`, Chrome으로 원격 SQL Editor 적용),
    `api/collectors/backfill_route_coords.py`, `SupabaseRest.update`(PATCH) 추가
  - ⚠ **대량 백필 upsert 불가 함정**: `spot_id`는 generated always identity라 값 삽입
    거부(428C9), `content_id`는 PostgREST가 non-PK unique 충돌을 못 잡아 신규 INSERT로
    빠져 name not-null 위반(23502). → **개별 UPDATE(PATCH by spot_id)**가 유일 해법.
    즉시 반영이라 중단돼도 확보분 남음(재실행 안전). 스팟 추가 시 `--apply`로 재실행
  - `routeCoord()` 헬퍼로 `fetchRoute`·`RouteView`가 route 좌표 우선(없으면 원 좌표 폴백).
    지도 라벨도 폴리라인과 정합되게 route 좌표로
  - 검증: 성산일출봉→만장굴 원좌표 422 → route좌표 **200(22.4km·35분)** 앱 내 지도 렌더 확인
  - ✅ **TestFlight 1.0.0(19) 업로드**(2026-07-22, run 29888556059): `server.url`이 Vercel이라
    두 커밋은 기존 빌드에서도 앱 새로고침으로 반영되지만, 새 빌드로 스냅샷도 갱신

**심사 준비 항목 (2026-07-20):**
- ✅ 연령 등급 **4+** (7단계 설문 전부 응답, 172개국 적용). 「제한되지 않은 웹 액세스」는
  **아니요** — 웹뷰지만 주소창·자유 브라우징 UI가 없어 임의 웹페이지 탐색이 불가.
  여기서 「예」면 17+로 뛴다
- ✅ 개인정보 처리방침 URL `https://jejunow.vercel.app/privacy` 등록
- ✅ **앱이 수집하는 개인정보** 입력 완료 — ⚠ **게시는 대표님 지시로 보류**(제출 직전에
  게시). 입력값: `사용 데이터 > 제품 상호 작용` + `진단 > 기타 진단 데이터`, 둘 다 목적은
  **앱 기능**만, 신원 연결 **아니요**, 추적 **아니요**
- ⛔ **전화번호**(앱 심사 정보) — 대표님 실제 번호라 대행 불가. 이것 없이는 제출 불가

**「데이터를 수집합니다」로 신고한 근거** (심사 문의 대비):
- Apple의 「수집」 정의 = 기기 밖으로 전송되어 **요청을 실시간 처리하는 데 필요한 시간을
  초과하여** 접근 가능한 경우. 그리고 "서버 로그처럼 상호작용 데이터를 보관하면 수집에 해당"
- 근거는 서드파티가 아니라 **자사 인프라**: Vercel 런타임 로그를 보관하며, 실제로 2026-07-20
  `spots.overview` 오류를 그 로그로 진단했다(보관 실증)
- Apple은 웹뷰도 네이티브와 동일 취급("앱 기능용 웹뷰"인 경우, 열린 웹 탐색 제공 시만 예외)
  → 카카오 지도 JS SDK도 신고 범위 안. 단 Privacy Manifest 의무는 없음(런타임 로드 JS)
- **미신고 항목의 근거는 실측**: 위치는 GPS를 심어두고 경로 보기까지 열어도 좌표가 어떤
  요청에도 실리지 않음(길찾기는 관광지 좌표만 전송). 식별자는 전 화면에서 쿠키 생성 0건
- 외부 호스트 실측: 카카오 3곳(dapi/t1.daumcdn/mts.daumcdn), jsdelivr(폰트), 자사 2곳
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
