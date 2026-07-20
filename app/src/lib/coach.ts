// 코치마크(스포트라이트) 정의와 완료 상태 저장.
// 앵커는 좌표가 아니라 DOM의 data-coach 속성으로 잡는다 — 화면 크기·데이터가 바뀌어도 따라간다.

export type CoachStep = {
  /** 대상 요소의 data-coach 값. 해당 요소가 없으면 이 단계는 건너뛴다. */
  anchor: string;
  title: string;
  body: string;
};

export type CoachId = "map" | "dashboard" | "spot" | "schedule";

const STORAGE_PREFIX = "jejunow:coach:";

export function isCoachDone(id: CoachId): boolean {
  try {
    return localStorage.getItem(STORAGE_PREFIX + id) === "done";
  } catch {
    // 프라이빗 모드 등 저장 불가 — 매번 보여주기보다 건너뛴다
    return true;
  }
}

export function markCoachDone(id: CoachId): void {
  try {
    localStorage.setItem(STORAGE_PREFIX + id, "done");
  } catch {
    // 저장 불가 환경 무시
  }
}

const ALL_COACH_IDS: CoachId[] = ["map", "dashboard", "spot", "schedule"];

/** 설정에서 「사용법 다시 보기」 — 전 화면의 완료 표시를 지운다 */
export function resetAllCoach(): void {
  try {
    for (const id of ALL_COACH_IDS) localStorage.removeItem(STORAGE_PREFIX + id);
  } catch {
    // 저장 불가 환경 무시
  }
}

export const DASHBOARD_COACH: CoachStep[] = [
  {
    anchor: "dash-feature",
    title: "지금 한적한 곳부터",
    body: "같은 종류의 관광지 중 지금 시간대에 덜 붐빌 곳을 골라 보여줍니다. 위치를 허용하면 제주 안에 계실 때 내 주변 기준으로 바뀝니다.",
  },
  {
    anchor: "dash-quiet",
    title: "카드의 색 배지가 혼잡도예요",
    body: "눌러서 들어가면 그곳의 시간대별 예측과, 비슷하지만 더 한적한 대안을 볼 수 있어요.",
  },
];

export const SPOT_COACH: CoachStep[] = [
  {
    anchor: "spot-chart",
    title: "시간대별로 확인하세요",
    body: "가장 한적한 시간과 가장 붐비는 시간이 함께 표시됩니다. 굳이 포기하지 않고 시간을 바꿔서 가는 선택도 있어요.",
  },
  {
    anchor: "spot-alt",
    title: "비슷한데 더 한적한 곳",
    body: "여기가 붐빈다면 같은 성격의 가까운 대안을 제안합니다. 해수욕장에는 해수욕장을, 오름에는 오름을 추천해요.",
  },
];

export const SCHEDULE_COACH: CoachStep[] = [
  {
    anchor: "sched-add",
    title: "하루 일정을 담아 보세요",
    body: "스팟을 시간대별로 담으면 각 시간의 예측 혼잡도를 한눈에 점검하고, 붐비는 구간은 대안을 제안합니다. 장소 사이 이동 거리와 시간도 함께 나와요.",
  },
];

export const MAP_COACH: CoachStep[] = [
  {
    anchor: "map-hour",
    title: "시간을 옮겨 보세요",
    body: "같은 곳도 시간대에 따라 붐비는 정도가 달라져요. 슬라이더를 옮기면 지도의 색이 그 시간 기준으로 바뀝니다.",
  },
  {
    anchor: "map-legend",
    title: "색은 네 단계예요",
    body: "여유, 보통, 붐빔, 혼잡 순서로 진해집니다. 현장에서 센 실제 인원이 아니라 공개 통계로 예측한 값이라 참고용으로 봐주세요.",
  },
];
