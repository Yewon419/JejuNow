// 코치마크(스포트라이트) 정의와 완료 상태 저장.
// 앵커는 좌표가 아니라 DOM의 data-coach 속성으로 잡는다 — 화면 크기·데이터가 바뀌어도 따라간다.

export type CoachStep = {
  /** 대상 요소의 data-coach 값. 해당 요소가 없으면 이 단계는 건너뛴다. */
  anchor: string;
  title: string;
  body: string;
};

export type CoachId = "map";

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
