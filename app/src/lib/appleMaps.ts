// Apple 지도 연결 — iOS 내장 지도 앱을 연다.
// App Review 가이드라인 4(Design): 위치 기능이 서드파티 지도 앱에만 묶여 있으면 안 되고,
// 사용자에게 내장 지도 앱을 실행할 선택지를 줘야 한다.
//
// 진입점은 두 가지다. 출발지를 아는 구간(일정의 슬롯 사이)은 경로로, 목적지 하나만
// 아는 경우(지도 마커)는 장소로 연다. 출발지 없이 daddr+dirflg를 넘기면 지도 앱이
// 출발지 선택 화면을 띄운다 — 실기기 확인 2026-09-03.

/** 이동수단 — Apple 지도 dirflg 값에 대응(d=자동차, w=도보, r=대중교통) */
export type AppleMapsMode = "car" | "foot" | "transit";

const DIR_FLAG: Record<AppleMapsMode, string> = {
  car: "d",
  foot: "w",
  transit: "r",
};

type Point = { lat: number; lng: number; name?: string };

function routeParams(to: Point, mode: AppleMapsMode, from: Point): string {
  const q = new URLSearchParams();
  q.set("saddr", `${from.lat},${from.lng}`);
  q.set("daddr", `${to.lat},${to.lng}`);
  q.set("dirflg", DIR_FLAG[mode]);
  return q.toString();
}

function placeParams(at: Point): string {
  const q = new URLSearchParams();
  q.set("ll", `${at.lat},${at.lng}`);
  // ll이 있으면 q는 검색어가 아니라 그 좌표에 찍히는 핀 라벨로 쓰인다
  q.set("q", at.name ?? "선택한 장소");
  return q.toString();
}

/** 지도 앱 실행 — maps:// 스킴을 먼저 시도하고, 열리지 않으면 웹 지도로 폴백.
 *  카카오맵 딥링크(RouteView.openKakaoMap)와 같은 패턴이다. */
function open(query: string): void {
  const webUrl = `https://maps.apple.com/?${query}`;
  const timer = setTimeout(() => window.open(webUrl, "_blank", "noopener"), 1400);
  const cancel = () => clearTimeout(timer);
  window.addEventListener("pagehide", cancel, { once: true });
  document.addEventListener(
    "visibilitychange",
    () => {
      if (document.hidden) cancel();
    },
    { once: true },
  );
  window.location.href = `maps://?${query}`;
}

/** 출발지→도착지 경로를 지도 앱에서 연다 (이동수단 반영) */
export function openAppleMapsRoute(to: Point, mode: AppleMapsMode, from: Point): void {
  open(routeParams(to, mode, from));
}

/** 장소 하나를 지도 앱에서 연다 — 길찾기는 사용자가 지도 앱 안에서 시작한다.
 *  현위치를 우리가 넘기지 않으므로 출발지 선택 화면이 뜨지 않는다. */
export function openAppleMapsPlace(at: Point): void {
  open(placeParams(at));
}
