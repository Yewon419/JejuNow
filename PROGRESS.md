# JejuNow 진행상황 (재개용)

> 재부팅/새 세션 시 이 파일부터 읽으면 이어서 진행 가능.
> 설계 = `BUILD_PLAN.md`. 자율 구현 지시서 = `FABLE_TASKS.md`.

## 현재 단계 (2026-06-24 기준, 웹데모 배포 + 초안 디자인 반영 완료)
**웹데모 라이브: https://jejunow.vercel.app** (전 페이지 200, 실데이터 렌더 확인)
**남은 사람 단계 (새 세션에서 진행 예정):**
1. **Kakao Web 플랫폼 도메인 등록** — developers.kakao.com → 내 앱 → 플랫폼 → Web →
   `https://jejunow.vercel.app` + `http://localhost:3000` 등록해야 **지도 마커가 표시**됨.
   미등록 시 지도 화면은 리스트 폴백으로 동작(앱 자체는 정상).
2. **(선택) 온보딩 실사진 교체** — 현재 즉흥=노을/계획=밤하늘 그라데이션으로 대체 중.
   실제 제주 사진 받으면 `TravelerTypeSelect.tsx`의 gradient → 이미지로 교체 가능.
3. **(나중) iOS 스토어 제출** = Phase 5 사람 단계: Apple Developer $99·심사. `app/ios/` + `.github/workflows/ios-build.yml` 준비됨

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
- congestion_pred 호라이즌(2026-08-31) 만료 전 `ml.precompute` 재실행 필요 (앱 상수 `app/src/lib/constants.ts`도 동기)
- GitHub: https://github.com/Yewon419/JejuNow (private)
- 정직성: 타겟=점유율%(절대 검색량 아님), 시간대=월예측×휴리스틱 프로파일 합성, 실측 혼잡도 없음, is_imputed 표시 — UI·API·모델 note에 명시됨

## 키 보관
`C:\Users\windg\Desktop\PROJECT\_keys\JejuNow\.env` (repo 밖). 전 키 검증 완료.
