# JejuNow 진행상황 (재개용)

> 재부팅/새 세션 시 이 파일부터 읽으면 이어서 진행 가능.
> 설계 = `BUILD_PLAN.md`. 자율 구현 지시서 = `FABLE_TASKS.md`.

## 현재 단계
**Fable 자율 구현 진행 중 (2026-06-13).** Phase 0.5 완료 → Phase 1 진행 중.

## Phase 0.5 — 스캐폴딩 ✅ (커밋 5e7c3c4)
- 모노레포: `app/`(Next.js 15+TS+Tailwind) `api/`(FastAPI) `ml/` `db/migrations/`
- `.venv` + ruff/mypy strict + tsc/eslint 게이트 전부 통과
- git init + .gitignore (.env·data/raw 등 제외)

## Phase 1 — 데이터 파이프라인 (진행 중)
- ✅ Supabase 스키마 적용 (MCP `apply_migration`): spots, **spot_popularity**(R1 반영),
  visitors, weather, day_profile, congestion_pred(+is_imputed), user_trips. RLS=읽기공개·쓰기차단
- ✅ weather 101개월 적재 (ASOS 184 제주, 2018-01~2026-05). **기상청 키 게이트웨이 반영됨** — skip 불필요
- 🔄 spots 재수집 중 (백그라운드)
- ⬜ spot_popularity 재적재 (매핑 개선 후)
- ❌ **visitors(월 입도객) skip** — 공개 API 미확보. 거시피처 없이 진행, 모델 note에 명시

### 결정·발견 로그 (2026-06-13)
1. **TourAPI areaCode=39는 불완전** — 비자림·오설록 등 신규등록 스팟은 legacy areacode 공란.
   `lDongRegnCd=50`(법정동) 조회로 전환 → 관광지 568+문화시설 96+레포츠 139 = **803건** (기존 384+55+87=526).
2. **카테고리 = 신분류 lclsSystm1~3** 채택 (803/803 채워짐, legacy cat은 526/803).
   cat1~3 컬럼에 lcls 코드 저장. day_profile·is_outdoor 휴리스틱도 lcls 기준으로 재작성.
3. **이름매핑 5패스**: 수동맵 → 정규화 일치 → 지역접두어 제거 → 유일 포함 → **Kakao Local 좌표 매칭**(300m).
   첫 시도(정규화 일치만)는 스팟 34%/행 46.5%로 부족했음. 미매핑은 `db/spot_name_map.csv` 리포트.
4. 데이터랩 long CSV의 age_group은 이미 `전체/20/30/40/50/60` 정규형 (첫 적재 시 83% 탈락 버그 수정).
5. PowerShell `Select-Object -First`가 파이프라인 조기종료로 적재 중단시킴 — 백그라운드 실행+파일 로그로 전환.
6. visitors: 데이터랩은 세션쿠키 필요(만료됨), 공공데이터포털 월 입도객 API 미신청 — **skip**.

## Phase 2~5 계획 (FABLE_TASKS.md 참조)
- Phase 2: ml/train(LightGBM, 타겟=인기점유율%), profile(일중 prior), precompute(2026-06-13~08-31, 9~20시)
- Phase 3: FastAPI /spots /congestion /simulate /alternatives. Railway 토큰 없음 → 배포설정만
- Phase 4: 5화면 + Kakao Map + Vercel 배포. ⚠️ Kakao Web 도메인 미등록 — 대표가 localhost+Vercel 도메인 등록 필요
- Phase 5: Capacitor iOS 구성까지 하고 정지(사람 단계)

## 키 보관
`C:\Users\windg\Desktop\PROJECT\_keys\JejuNow\.env` (repo 밖). 전 키 검증 완료(기상청 포함).
