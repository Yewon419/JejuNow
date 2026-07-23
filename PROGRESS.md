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

**경로 표시 다듬기 + 탭 스와이프 (2026-07-22, 커밋 8f56efb·1b614f8):**
- `formatDuration()`: 60분 이상은 "74분"이 아니라 "1시간 14분" — 경로 칩·RouteView 공유
- `sameLocation()`: 같은 spot_id거나 route 좌표(주차장)가 50m 이내면 경로 칩·모달·조회
  자체를 생략(같은 주차장에 매핑된 인접 명소도 0km라 함께 걸러짐)
- `SwipeNav`: 탭 화면 좌우 스와이프로 홈↔지도↔일정 이동(임계 70px + 수평>수직×2,
  전환 시 tapLight). 지도 위에서는 카카오맵이 터치를 소비해 지도 팬이 우선

**홈 디자인 개선 사이클 (2026-07-22, 커밋 4f32f9e~208c944):**
- 레퍼런스 조사(트리플·Airbnb 2025): 감성 여행앱 공통 = "one accent + photo-led depth +
  가로 행 리듬". 기존 홈은 사진 아래 흰 카드 텍스트 + 전폭 세로 나열이라 평면적
- photo-led 재구성(01150f8): ① 히어로 흰 사진 위 흰 글씨 가독성 수정(스크림 /85 +
  텍스트 섀도 이중 방어) ② 한적한 스팟 전폭 세로 6장 → 세로형(w-40 h-56) 사진 오버레이
  카드 **가로 스냅 캐러셀** 8장 ③ 붐비는 곳도 오버레이 카드 통일 ④ MyPlanCard에 미니
  썸네일·요일 날짜·스팟 수. SpotCard는 미사용화 → 삭제(대표님 승인)
- 상단 히어로 밴드(3208570→208c944): 시간대(새벽~밤) 5단계 **블루 계열 그라데이션**이
  상태바까지 차오르고 bg로 페이드. 해/달 글리프 + 인사말(kstGreeting/kstDayPart) +
  "오늘의 제주" + 요일 날짜. 좌상단 **JejuNow 로고 락업**(icon.svg + 워드마크).
  액센트 글로우 원은 대표님 피드백으로 제거. 혼잡도 4색과 충돌 금지 제약 준수
- ⚠ **`StaleReload`**(6a8b60e): iOS 셸은 SPA라 앱을 켜둔 채로는 배포가 반영되지 않는다.
  15분 이상 백그라운드 후 복귀 시 자동 location.reload(). 이 전까지는 "앱 완전 종료 후
  재실행"이 유일한 반영 경로였음(재설치 불필요 — 대표님이 신형을 구형으로 오인한 소동도
  있었음. 판별 기준: 홈 상단 인사말 유무)
- 검증 루틴: 매 변경 tsc·eslint 0 + Vercel 배포 + Playwright 393·375px 캡처(가로 넘침 0)

**전 화면 다듬기 사이클 (2026-07-22, 커밋 ee91a8b·8b775f0):**
- ⚠ **상세 튜토리얼 잠금 버그 수정**(베타 피드백): 코치마크 앵커(차트·대안)가 첫 화면
  밖인데 body 스크롤은 잠겨 있어 스포트라이트·버튼이 전부 화면 밖 — 어두운 오버레이만
  남고 끌 수 없었다. 측정 전 앵커를 뷰포트 중앙으로 스크롤(잠금 일시 해제 후 복원),
  그래도 화면 밖이면 그 단계 건너뜀, 말풍선은 화면 안으로 클램프. 로컬+프로덕션
  Playwright 실측: 2단계 모두 버튼 inView, 완주 후 done 저장·잠금 해제 확인
- **spotDisplayName**: 원본 이름의 괄호·대괄호 수식("성산일출봉 [유네스코 세계자연유산]")이
  좁은 카드에서 본이름을 잘라먹던 것을 표시용으로 분리. 일정 슬롯·홈 플랜·캐러셀·
  붐빔 카드·지도 시트·경로 모달·대안 목록 적용. 스팟 선택 시트는 동명 구분 위해 원본
  유지, 상세 히어로는 수식을 제목 아래 보조 표기로
- **LevelBadge onPhoto**: 10% 알파 배경 칩이 사진 위에서 묻힘(캡처 실측) → 흰 불투명
  (0.92) 칩 변형 추가, 홈 캐러셀·붐비는 곳 오버레이에 적용
- 추천 코스 카드 대비는 확대 실측 결과 기존 스크림 /85가 정상 작동 — 미수정(오판 정정)
- ✅ layout Pretendard `<link rel="stylesheet">` hydration 경고 2건 해소(승인 후 커밋
  e634154): React 19는 `precedence`가 있어야 stylesheet를 head로 호이스팅해 관리한다.
  dev·프로덕션 실측 — stylesheet HEAD 안, 폰트 로드 정상, 경고 0건
- 검증: tsc·eslint 0 / Vercel 배포 / 전 화면 393·375px 재캡처(가로 넘침 0)

**상세 페이지 개편 (2026-07-22 저녁, 커밋 aa38ad4 — 레퍼런스 조사 기반):**
- 조사: Airbnb/Klook(스티키 하단 CTA 바), Google 지도 피크 시간대("지금" 마커),
  네이버 플레이스/트리플(아이콘 정보 행), Airbnb 위치 섹션(미니 지도). 대표님 4건 전부 승인
- 스티키 바: 지금 혼잡도 요약(LevelDot+라벨+추정 표시, date가 오늘일 때만) + "일정에 넣기".
  BottomNav와 같은 bottom:0 + 배경 padding 인셋 구조. 본문 pb-32로 가림 방지
- 차트 "지금": 현재 시각 막대 ring + 「지금」 라벨 + 시각 볼드. `kstTodayStr()` 신설
  (컴포넌트에서 Date.now 직접 호출은 react-hooks/purity 룰이 막는다 — lib 헬퍼로)
- SpotInfoCard(client): 운영·전화·주소 아이콘 행, 주소 탭 복사(클립보드+햅틱).
  히어로의 주소는 여기로 이동(중복 제거 — "히어로엔 이름·수식만"으로 결정 변경)
- SpotMiniMap: Kakao **StaticMap**(스크롤 중 제스처 충돌 없음) + 「지도에서 보기」 →
  `/map?spot=` 포커스(센터+레벨8+시트 오픈). ⚠ 포커스 파라미터는 서버 searchParams로
  읽으면 라우트가 동적이 돼 ISR이 죽는다 — MapView에서 useSearchParams(+page Suspense)
- ⚠ **잠재 버그 수정**: SDK가 이미 로드된 채 지도 탭 진입(상세 미니 지도·경로 모달 경유)
  시 같은 src의 next/script onLoad가 재발화하지 않아 지도가 영영 "불러오는 중"이었다.
  MapView·SpotMiniMap에 마운트 시 window.kakao 체크 + 1회 실행 가드(RouteView 기존 방어와 동일)
- ⚠ localhost는 Kakao JS 키 도메인 미등록이라 SDK가 ERR_BLOCKED_BY_ORB로 죽는다 —
  지도 관련 검증은 프로덕션에서만 가능
- 검증: tsc·eslint 0 / 프로덕션 실측(스티키 바·지금 마커·미니 지도·포커스 시트·신규
  방문 지도 81마커·가로 넘침 0)

**지도 화면 개편 (2026-07-23, 커밋 05f7130 — 5건 전부 승인):**
- 풀블리드 지도 + 플로팅 컨트롤(날짜·시간 카드/필터 칩/범례 필/현위치 버튼) —
  기존 헤더 175px 회수. h1은 sr-only로 유지
- 마커 솎아내기: 줌 레벨 9+에서 화면 ~34px 격자당 대표 1개(높은 혼잡 우선, 레벨10 실측
  100m/px 기준 환산). 81→59개. 카카오 클러스터러는 혼잡도 4색 정보가 뭉개져 미채택.
  줌인(≤8) 전체 표시. `zoom_changed` 리스너 + `getLevel` 타입 추가
- 「한적한 곳만」 필터 칩(기준 lv1~2 — lv1 배지명 "여유"와 혼동 피해 홈 어휘 사용,
  13시 실측: 붐빔5·혼잡1 소거) / 추정치 포함도 칩으로 전환
- 선택 마커 위 이름 칩 라벨 / 현위치 버튼(제주 bbox 안 이동+파란 점, 밖은 토스트 —
  웹뷰에서 alert 금지 제약 준수)
- ⚠ **SwipeNav 잠재 버그 수정**: window 터치 리스너라 시간 슬라이더를 70px 이상
  드래그하면 탭이 전환됐다. input·select·textarea 위 터치 시작은 스와이프에서 제외
- 검증: tsc·eslint 0 / 프로덕션 실측(솎아내기 마커 수·필터 색 분포·선택 라벨·현위치
  파란 점[geolocation 목]·가로 넘침 0). ⚠ 지도 검증은 프로덕션 전용(localhost 도메인 미등록)

**오토플랜(자동 일정) 알고리즘 코어 (2026-07-23, 커밋 2e2e15f — UI는 다음 단계):**
- 대표님 스펙: 취향 4문(빡빡함·이동수단·혼잡 허용·여정 끝[제자리/새 위치/공항/기타])
  → 현위치(미허용 시 지역 랜덤) 기준 2지선다 반복, 이전 장소와 가깝게, 어느 쪽을
  골라도 최적 루트, 개수는 빡빡함 기반
- 보충 4건(승인 하 추가): ① 도달 가능성 불변식(남은 라운드×반경, 시간 창 인지,
  최종구간 무완화 상한) ② B안 다양성 강제(카테고리 상이 or 방향 60°+) + 카테고리
  취향 학습 ③ 시간 커서(9~20시) — 혼잡도가 시각 기반이라 필수 ④ 완화 사다리
  (반경 ×1.5 → 혼잡 +1) + 스킵 + endFeasible 사전 판정 + 방향성 앵커 회랑
- 구현: `app/src/lib/autoplan.ts` (순수 함수, JSON 직렬화 상태, mulberry32 시드 —
  Math.random 금지·react purity 대비). 기존 ScheduleSlot 포맷으로 변환 지원
- 검증: `app/scripts/autoplan-sim.mts` — 실데이터 648 플레이스루(81조합×시드4×시작2),
  랜덤 선택+10% 스킵. **불변식 위반 0** / 목표 달성 플랜 최종구간 max 18.7km(반경 내) /
  0스팟 3건(도보+외지 시작 — endFeasible로 대부분 사전 차단) / 고갈 조기종료 24.8%는
  한적만+대중교통 등 희박 조합의 정직한 부분 플랜(UI에서 잔여 이동 안내 예정).
  재실행: `$env:SUPABASE_URL·ANON_KEY 설정 후 npx tsx scripts/autoplan-sim.mts`
- 한계 명시(정직성): 대중교통·도보는 라우팅 API 없어 속도·반경 모델(추정 표기 예정),
  운영시간 미반영(원천 비정형). ⚠ 커밋 메시지에 큰따옴표 넣으면 PS→git 인자 분리 깨짐
- ✅ **UI 완료 (커밋 a3bfeb8)**: 일정 탭 「자동으로 짜기」 → AutoPlanFlow 오버레이.
  질문 4문(칩) → 현위치 시도(제주 밖·거부 시 제주시/서귀포시 선택→지역 랜덤 시작) →
  2지선다 사진 카드(홈 캐러셀 문법, 혼잡 배지·거리·추정 이동시간) + 「둘 다 별로」·
  「여기까지만」 → 완성 목록 + 잔여 이동 안내 + 기존 일정 대체 라벨 → ScheduleSlot 저장.
  도착지 「다른 장소」=스팟 검색, endFeasible=false면 질문으로 되돌려 경고
- E2E(프로덕션): 질문→위치 허용(제주 좌표)→4라운드(스킵 1회 포함)→저장→타임라인 반영
  실측. 완성 플랜이 공항 방향으로 수렴, 최종구간 1.9km — 회랑·불변식 실동작 확인
- ⚠ 이벤트 핸들러의 Date.now도 react-hooks/purity가 잡는다(false positive) —
  좁게 eslint-disable + 사유 주석

**여정 양끝·공항 검색·제스처 4건 (2026-07-23, 커밋 9c595fa):**
- 일정 타임라인 양끝에 출발(먹색 점)·도착(블루 점) 표시. `jejunow:schedule`에
  `journey{origin,end}` 확장(하위 호환 — MyPlanCard 등 기존 파서 영향 없음).
  슬롯 전부 삭제 시 journey도 제거
- 공항 = 검색 선택: `/api/kakao-places`(카카오 로컬 키워드 프록시, 공항 전용으로 좁힘 —
  검색어에 공항 강제 + 카테고리 필터 + 잡음 정규식[주차·게이트·백화점 등]).
  실측 제주→1건, 김포→국내선·국제선. ⚠ 카카오 호출은 Vercel 함수 경유 원칙 준수
- SwipeNav 구분: 가로 스크롤 컨테이너(scrollWidth>clientWidth && overflow-x
  auto/scroll 상향 탐색) 안 터치는 탭 전환 제외 — 홈 캐러셀 스크롤이 탭을 넘기던 문제.
  스와이프 전환 시 진입 방향 슬라이드 모션(page-from-left/right 220ms, 탭 바 탭은 무모션,
  모션 종료 후 시간차 해제 — ⚠ react-hooks/refs가 렌더 중 ref 읽기를 막아 state로 구현)
- 상세 닫기 제스처(DetailDismiss): ① 최상단(scrollY≤2)에서 아래로 90px+ 빠르게(0.45px/ms)
  ② 좌측 24px 엣지→우로 70px+. history 있으면 back, 없으면 대시보드. 오버레이(코치마크·
  모달)가 body 스크롤 잠근 동안 비활성. ⚠ 시간은 Date.now 대신 e.timeStamp(purity 룰 회피)
- E2E(프로덕션): 공항 검색·선택→완주→타임라인 「출발 · 내 위치 / 도착 · 제주국제공항」
  렌더+저장 / 엣지·당김 제스처로 상세 이탈 / 일반 영역 스와이프 → /map+모션 클래스 /
  캐러셀 안 스와이프 → 탭 유지

**날짜별 일정·제스처 보강 (2026-07-23, 커밋 db1ce58 — 실기기 피드백 3건):**
- 「날짜 바꿔도 계획이 그대로」 → 일정 저장을 날짜별로 분리. `lib/scheduleStore.ts`
  (v2 `{current, byDate}`, v1 자동 이관, HORIZON_START 이전·빈 일정 정리).
  소비자 4곳(ScheduleBuilder·MyPlanCard·QuietNearby·OnboardingPlanner) 일괄 전환.
  E2E: v1 시드 이관→날짜 전환 시 0곳→복귀 시 복원, 저장 포맷 v2 확인
- 당김 닫기 시각 반응: 래퍼 transform 직접 조작(저항 0.55)으로 화면이 손가락을
  따라 내려오고, 140px(또는 70px+0.5px/ms 플릭) 넘으면 닫힘·미달이면 스냅백.
  touchmove는 passive:false(당김 중 preventDefault로 네이티브 바운스 차단).
  ⚠ 고정 하단 바는 transform 컨테이닝 블록에 걸리면 위치가 깨진다 — 래퍼 밖 형제로
- 엣지 스와이프 미동작 → 판정 완화(32px·50px·비율 1.2) + **touchcancel 폴백**
  (iOS가 엣지 제스처를 자체 소비하면 touchend가 안 온다 — touchmove 마지막 좌표로 판정)
- E2E: 당김 중 translateY(44px) 실측·완료 시 이탈 / 엣지 touchend·touchcancel 양 경로 닫힘

**엣지 백 스와이프 = 애플 표준 전환 (2026-07-23, 커밋 5afa6c8, iOS 재빌드):**
- 실기기에서 JS 엣지 스와이프 불통(2차 시도까지 실패) → 근본 원인: iOS 시스템이
  엣지 터치를 점유해 웹으로 이벤트가 오지 않는다(합성 이벤트만 통과). **JS로는 불가**
- 애플 표준 = WKWebView `allowsBackForwardNavigationGestures`. Capacitor 기본 꺼짐 →
  `SwipeBackViewController: CAPBridgeViewController` 서브클래스에서 활성화,
  Main.storyboard customClass 연결. ⚠ 새 .swift 파일은 pbxproj 등록이 필요해
  AppDelegate.swift 안에 클래스 추가(파일 추가 회피)
- 네이티브 제스처는 SPA pushState 히스토리에도 동작(WKBackForwardList) — 전 화면
  공통 뒤로가기, 인터랙티브 스냅샷 애니메이션 표준 제공
- DetailDismiss는 당김 닫기만 유지(JS 엣지 로직 제거). 웹 데모는 브라우저 자체
  백 스와이프가 있어 무손실

**아이패드 호환 (2026-07-23, 커밋 85fdd46 — 세로·가로 전 방향):**
- iOS 셸은 원래 iPad 네이티브(TARGETED_DEVICE_FAMILY "1,2", iPhone 세로+가로·iPad
  4방향 회전 선언) — **재빌드 불필요**, 웹 레이아웃만 대응
- 폰 프레임을 md+(768px)에서 max-w-2xl 중앙 컬럼으로: 루트·BottomNav 2xl /
  상세 스티키 바·오토플랜·경로 모달·스팟 선택 시트 xl / 지도 플로팅 컨트롤은
  중앙 max-w-md 캡 + 시트 xl
- 검증: 768×1024(세로)·1024×768(가로)·1366×1024(13" 가로) × 홈·지도·일정·상세
  가로 넘침 0, 시각 확인
- ⚠ **사람 단계 예고**: 디바이스 패밀리에 iPad가 포함돼 있어 심사 제출 시 ASC가
  13" iPad 스크린샷을 요구할 것(현재 등록분은 iPhone 4장뿐). Playwright로 2064×2752
  캡처 생성 가능 — 제출 준비 때 처리

**지도 핀치 버벅임 수정 (2026-07-23, 커밋 f2cb8cc — 실기기 피드백):**
- 원인 ①: 802개 스팟 전부의 CustomOverlay를 지도에 부착(숨김 마커는 포털 내용만
  비움) → 카카오가 팬·줌 매 프레임 802개 DOM 재배치. **보이는 마커만 setMap 부착**하는
  동기화 이펙트로 전환(visibleMarkers 집합을 포털 렌더와 공유). 실측 부착 59개
- 원인 ②: zoom_changed가 핀치 중 레벨마다 발화 → 솎아내기 재계산+포털 리렌더 폭주.
  **120ms 디바운스**로 핀치 종료 후 1회만 반영
- 검증: 부착 마커 59(솎아내기와 일치)·지도 컨테이너 div 총 192(이전 802+ 오버레이)·
  줌·마커 탭·시트 회귀 없음. 체감 개선은 실기기 확인 필요

**핀치 연속 줌 + 아이패드 프레임 병목 (2026-07-23, 커밋 06e519e — 실기기 피드백 2건):**
- 핀치가 레벨 단위로 뚝뚝: **카카오 JS SDK는 정수 레벨 래스터 — 연속 줌 옵션 없음**
  (문서 확인). 터치 기기에서 `setZoomable(false)` 후 커스텀 핀치: 제스처 동안
  컨테이너 CSS scale 연속 확대(transform-origin=핀치 중심, capture+stopPropagation으로
  카카오 두 손가락 오해 차단) → 종료 시 `round(log2(scale))` 레벨을
  `setLevel(level, {anchor: 핀치 중심 좌표})`로 스냅. 더블탭 줌인(300ms·30px)도 재구현.
  실측: scale 1.5→2.5 연속 적용·종료 시 해제·레벨 반영
- 아이패드 프레임 여전히 좁음(실기기 스크린샷 576px): **(tabs) 레이아웃의 잔존
  max-w-xl이 루트 md:max-w-2xl보다 좁아 병목**. 폭 결정을 루트 레이아웃으로 일원화
  (tabs는 무제약) + lg에서 max-w-3xl. 실측 세로 672·가로 768px
- ⚠ 교훈: 프레임 폭은 루트 한 곳에서만 — 중간 레이아웃의 max-w가 조용히 병목이 된다

**아이패드 가로 2단 + 홈페이지·예매 링크 (2026-07-23, 커밋 3beb081):**
- 가로(lg+) 재최적화: 홈 = 좌(내 여행·붐빔)/우(추천·캐러셀) 2단 그리드(캐러셀
  음수 마진 lg 해제), 상세 = 좌(히어로 스티키)/우(정보 스크롤) 2단. 1194×834 실측
- 예매 연결: `spots.homepage` 신설(마이그레이션 0006 — Chrome SQL Editor로 적용).
  TourAPI detailCommon2 homepage 앵커 HTML에서 href 추출.
  `backfill_homepage.py`(개별 PATCH·재실행 안전) + collect_spots 주간 보강 편입.
  상세 정보 카드에 「홈페이지 · 예매 안내」 외부 링크 행(globe 아이콘)
- 게이트: tsc·eslint·ruff·mypy 전부 0

**아이패드 실기기 가로 넘침 수정 (2026-07-23, 커밋 24c0c25):**
- 실기기(WKWebView) 세로·가로 모두 콘텐츠가 프레임 오른쪽으로 넘침 — Chromium
  Playwright는 무증상이라 통과했던 것. **Playwright WebKit 엔진으로 재현**(세로
  overflowX 652px): WebKit은 그리드 자식 안 가로 스크롤러(캐러셀) 콘텐츠 폭을
  트랙 최소폭에 반영한다. min-w-0·grid-cols-1 명시·캐러셀 max-w 캡으로 해소
- ⚠ **교훈: iOS 웹뷰 렌더링 검증은 Chromium만으론 불충분 — Playwright webkit
  엔진을 함께 돌릴 것** (`npx playwright install webkit`)

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
