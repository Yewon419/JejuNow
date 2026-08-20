# 2.1 정보 요청 대응 (2026-08-21)

리젝이 아니라 **정보 요청**입니다. 코드 수정·재빌드 불필요. Resolution Center에 답변 + 화면 녹화만 올리면 심사가 이어집니다.

- 심사 노트(App Review Information > Notes)는 **API로 이미 갱신 완료** (7항목 전부 반영)
- 남은 사람 단계: ① 아이폰 화면 녹화 ② Resolution Center에 아래 문안 붙여넣기 + 영상 첨부

---

## ① 화면 녹화 대본 (아이폰 실기기, 최신 iOS)

**녹화 방법**: 설정 > 제어 센터에 「화면 기록」 추가 → 제어 센터에서 녹화 시작 → 아래 순서대로 조작 → 정지. 사진 앱에 저장됨.

**중요**: 반드시 **앱을 완전히 종료한 상태에서 시작**해야 합니다(Apple이 "recording must begin with launching the app"을 명시). 위치 권한도 **미리 초기화**해두면 권한 프롬프트가 녹화에 잡힙니다 — 설정 > 일반 > 이전 또는 재설정 > 재설정 > 위치 및 개인정보 보호 재설정, 또는 앱 삭제 후 TestFlight 재설치.

목표 길이 2~3분. 각 화면에서 2초쯤 머물러 심사자가 읽을 시간을 줄 것.

| 순서 | 조작 | 보여줄 것 |
|---|---|---|
| 1 | 홈 화면에서 「제주나우」 아이콘 탭 | 앱 실행 (필수 시작점) |
| 2 | 온보딩 질문에 아무거나 선택 | 계정·로그인이 없다는 점 |
| 3 | 홈 탭에서 위아래로 천천히 스크롤 | 붐비는 곳·한적한 스팟·추천 코스 |
| 4 | 「지금 한적한 스팟」 카드 하나 탭 | 상세 진입 |
| 5 | 상세에서 스크롤 | 시간대별 예측 차트, 가장 한적/붐빔 시각, 「비슷한데 더 한적한 곳」 |
| 6 | 하단 「일정에 넣기」 탭 | 일정 담기 |
| 7 | 뒤로 → 지도 탭 | 색상 마커(4단계) |
| 8 | **위치 권한 프롬프트가 뜨면 「앱을 사용하는 동안 허용」** | 권한 요청 장면 (필수 요구사항) |
| 9 | 상단 시간 슬라이더를 좌우로 천천히 드래그 | 시간대에 따라 마커 색이 바뀌는 핵심 기능 |
| 10 | 마커 하나 탭 | 요약 시트 + 시간대별 그래프 |
| 11 | 일정 탭 | 담은 스팟, 시간대별 혼잡도, 붐비는 슬롯의 대안 제안 |
| 12 | 「경로 보기」 칩 탭 | 앱 안에서 그려지는 경로, 닫기 |
| 13 | 「자동으로 짜기」 탭 → 질문 4개 답 → 2지선다 3~4회 선택 | 오토플랜 핵심 기능 |
| 14 | 완성 화면에서 「일정에 담기」 | 결과가 일정에 반영됨 |
| 15 | 우상단 톱니 → 설정 → 자주 묻는 질문 → 개인정보 처리방침 | 데이터 출처·예측값 고지 |

녹화가 끝나면 영상을 PC로 옮겨서(에어드롭·아이클라우드·케이블 아무거나) Resolution Center 첨부에 올리면 됩니다. 파일이 크면 20MB 이하로 압축하거나, 유튜브 **일부 공개(Unlisted)** 링크를 답변에 함께 적어도 됩니다.

---

## ② Resolution Center 회신 문안 (그대로 복사)

```
Hello,

Thank you for the review. Please find the requested information below. A screen
recording captured on a physical iPhone running the latest iOS is attached, showing the
app from launch through its core features, including the optional location permission
prompt. The same information has also been added to the Notes field of the App Review
Information section.

1. SCREEN RECORDING
Attached. It starts by launching the app from the Home Screen and walks through:
onboarding, the Home tab, a spot detail page with its hourly crowding chart and quieter
alternatives, adding a spot to the itinerary, the Map tab with the hour slider, the
optional location permission prompt, the itinerary with in-app driving routes, the
auto-plan flow, and Settings (FAQ and privacy policy).
There are no account registration, login, or account deletion flows because the app has
no accounts at all. There is no paid content, no in-app purchase, and no
user-generated content, so no purchase, subscription, reporting, or blocking flows
exist. Location is the only sensitive permission and its prompt is shown in the
recording.

2. DEVICES AND OPERATING SYSTEMS TESTED
- iPhone 16 (iPhone16,1), iOS 26.6 - primary test device, all features
- iPad Pro 11-inch (iPad14,3), iPadOS 26.6 - layout and all features

3. FUNCTION, PROBLEM SOLVED, AND TARGET AUDIENCE
Visitors to Jeju Island in Korea concentrate on the same small set of famous spots,
which creates severe crowding while comparable places a short drive away stay empty.
JejuNow predicts, hour by hour, how crowded each of 800+ Jeju tourist spots will be, and
helps a visitor either shift to a quieter hour at the same place or switch to a similar
but quieter place nearby. It also checks a planned day itinerary slot by slot and
proposes alternatives for the crowded slots. Target audience: domestic and
international travelers visiting Jeju, and regional tourism planners. The app is an
entry for the 2026 Korea Tourism Data Utilization Contest (app development category).

4. SETUP AND ACCESS INSTRUCTIONS
No setup is required and no credentials are needed. The app has no sign-up or login of
any kind, and no sample files are required. On first launch a single onboarding
question about travel style is shown, after which every feature is immediately
available:
- Home tab: currently crowded spots to avoid and currently quiet spots to consider.
- Map tab: all spots colored by predicted crowding. Drag the hour slider at the top to
  see how the same place changes across the day. Tap a marker for a summary sheet.
- Spot detail: hourly prediction chart with quietest and busiest hours, plus similar
  but quieter alternatives nearby. "Add to plan" adds it to the itinerary.
- Plan tab: predicted crowding per time slot, alternatives for crowded slots, and the
  driving route between consecutive stops drawn inside the app.
- Auto-plan button: answer four preference questions, then repeatedly choose between two
  suggested places; the app builds a full day itinerary that respects travel time.
- Settings: FAQ and privacy policy.
Location permission is optional. It is requested only when a location-based feature is
tapped, and if it is denied every feature still works using a region-wide fallback.

5. EXTERNAL SERVICES, TOOLS, AND PLATFORMS
- Korea Tourism Organization TourAPI 4.0 (data.go.kr): spot names, categories, photos,
  addresses, and opening hours. Open government data; our API key is approved.
- Korea Tourism Data Lab: public monthly search-popularity statistics, used only as
  training data for our own model.
- Kakao Maps JavaScript SDK (map rendering), Kakao Local REST API (place and airport
  search, parking-lot coordinates), and Kakao Navi Directions API (driving routes), all
  under Kakao Developers terms with registered keys.
- Supabase (PostgreSQL) for spot data and precomputed predictions.
- Vercel for web hosting and serverless functions; Render for our FastAPI inference
  server.
- The crowding predictions come from our own LightGBM regression model, which we trained
  on the public statistics listed above. No third-party AI service is used. The app uses
  no authentication provider, no payment processor, and no advertising network.

6. REGIONAL DIFFERENCES
There are none. The app functions consistently across all regions and territories. The
interface is in Korean and the underlying data covers Jeju Island, Korea, but no
feature, content, or capability is gated by the user's country or region.

7. REGULATED INDUSTRY AND THIRD-PARTY MATERIAL
The app does not operate in a regulated industry. It provides no medical, financial,
legal, or gambling services. All tourism content (spot names, descriptions, and photos)
is provided by the Korea Tourism Organization through TourAPI under Korea's Public Data
Act open-data license, which permits redistribution with attribution; the app credits
the Korea Tourism Organization as the data source on its FAQ screen. Map data is served
through Kakao's official SDK under Kakao Developers terms. We can provide our approved
data.go.kr API key issuance record and Kakao Developers app registration on request.

One clarification we want to state plainly: the crowding figures are model predictions
derived from public statistics, not real-time headcounts measured on site. The app
states this on its FAQ screen and marks estimated values with an "estimate" badge, so
users are not misled.

Please let us know if anything else would help complete the review.

Best regards,
Yewon Han
```

---

## 참고

- 심사 노트는 이미 위 내용의 압축본으로 갱신됨(4000자 제한). Resolution Center 답변은 길이 제한이 더 넉넉해 위 전문을 그대로 사용.
- 답변 후 재제출 불필요 — Apple이 같은 제출 건에서 심사를 재개함.
- 화면 녹화 요구는 2.1 응답에서 사실상 필수. 영상 없이 텍스트만 보내면 같은 사유로 다시 요청받을 가능성이 큼.
