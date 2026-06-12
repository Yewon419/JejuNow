# JejuNow 진행상황 (재개용)

> 재부팅/새 세션 시 이 파일부터 읽으면 이어서 진행 가능.
> 설계 = `BUILD_PLAN.md`. **자율 구현 지시서 = `FABLE_TASKS.md`** (새 세션 Fable 전용).

## 현재 단계
**Phase 0 완료.** 키·R1 검증·데이터 확보 끝. → 새 세션에서 Fable이 `FABLE_TASKS.md` 읽고 Phase 0.5~ 구현.

## ✅ 완료 (2026-06-12~13)
- **TourAPI 4.0 키** 발급·검증 (제주 areaCode=39, 관광지 384건, resultCode 0000). `_keys\JejuNow\.env`
- **R1 확정** — 모델 타겟 = 데이터랩 **인기 점유율(%)** (절대 검색량 아님). 상세 `발급_체크리스트.md`
- **데이터랩 8년치 수집 완료** — `collect_datalab.py`로 202 zip + `data/datalab_popular_long.csv` 36,360행 (2018-01~2026-05 × 제주시50110·서귀포50130 × 6연령대 × TOP30)
- **FABLE_TASKS.md 작성** — 자율 구현 지시서

## R1 핵심 (모델 타겟 변경)
- 데이터랩에 스팟×월 절대 검색량 없음 → **스팟×월 인기 점유율(%)**, 기초지자체 TOP30, 2018-01~ 가능
- 제안서 원안에서 **타겟만 변경**(절대값→점유율%), 시계열 회귀·lag/rolling·day_profile은 유효
- 데이터랩 ID ↔ TourAPI contentId 다름 → 이름 매핑 필요 (Phase 1 난관)

## 키 발급 현황
- ✅ TourAPI (data.go.kr) — `.env` 적재·검증 완료
- ✅ **Supabase** — URL·anon·service_role 3키 `.env` 적재·검증(auth health OK, 양키 인증통과). DB는 빈 상태(Fable이 Phase1 생성). 프로젝트 ref `vuneeprkjcaxhdhgwcva`
- ✅ **Kakao** — JS·REST 키 `.env` 적재·검증(REST 로컬API 실호출 OK). ⚠️ **Web 도메인 미등록**(포트 형식 문제) → Phase4에서 대표가 `http://localhost`+배포도메인 등록해야 지도 표시
- ✅ 기상청 (ASOS 일자료 15059093) — 활용신청 완료. TourAPI 키 공통 사용. 2026-06-13 시점 게이트웨이 반영 전이라 403(정상, 수십분~1h 후 풀림). Fable Phase1 호출 시 재시도
- (나중) Railway/Vercel/Apple

## 다음 할 일
1. **(대표)** Supabase·Kakao 키 발급 → `.env` (기상청은 선택). 가이드는 `발급_체크리스트.md`
2. **(새 세션 Fable)** `FABLE_TASKS.md` 읽고 Phase 0.5(스캐폴딩)부터 구현 → 웹 데모(Vercel)까지 자율
3. iOS 스토어 제출은 사람 단계(Apple $99·심사) — Fable이 Phase 5에서 멈추고 보고

## 만든 파일
- `BUILD_PLAN.md` — 설계·아키텍처·Phase·리스크
- `FABLE_TASKS.md` — 자율 구현 지시서 (새 세션 진입점)
- `PROGRESS.md` — 이 파일
- `collect_datalab.py` — 데이터랩 수집기 (검증됨)
- `data/raw/datalab/*.zip` (202), `data/datalab_popular_long.csv` (36,360행)
- `_keys\JejuNow\.env`(키·repo밖), `.env.template`, `발급_체크리스트.md`

## 키 보관
`C:\Users\windg\Desktop\PROJECT\_keys\JejuNow\.env` (repo 밖, 커밋 안 됨)
