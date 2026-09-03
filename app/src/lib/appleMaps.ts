// Apple 지도 연결 — iOS 내장 지도 앱으로 길찾기를 넘긴다.
// App Review 가이드라인 4(Design): 위치 기능이 서드파티 지도 앱에만 묶여 있으면 안 되고,
// 사용자에게 내장 지도 앱을 실행할 선택지를 줘야 한다.

/** 이동수단 — Apple 지도 dirflg 값에 대응(d=자동차, w=도보, r=대중교통) */
export type AppleMapsMode = "car" | "foot" | "transit";

const DIR_FLAG: Record<AppleMapsMode, string> = {
  car: "d",
  foot: "w",
  transit: "r",
};

type Point = { lat: number; lng: number; name?: string };

function params(to: Point, mode: AppleMapsMode, from?: Point): string {
  const q = new URLSearchParams();
  if (from) q.set("saddr", `${from.lat},${from.lng}`);
  q.set("daddr", `${to.lat},${to.lng}`);
  q.set("dirflg", DIR_FLAG[mode]);
  // 도착지 이름 — 지도 앱 핀 라벨에 쓰인다
  if (to.name) q.set("q", to.name);
  return q.toString();
}

/** 웹 폴백 URL — iOS에서는 유니버설 링크로 지도 앱이 열리고, 그 외 환경에서는 웹 지도가 뜬다 */
export function appleMapsUrl(to: Point, mode: AppleMapsMode = "car", from?: Point): string {
  return `https://maps.apple.com/?${params(to, mode, from)}`;
}

/** 지도 앱 실행 — maps:// 스킴을 먼저 시도하고, 열리지 않으면 웹 지도로 폴백.
 *  카카오맵 딥링크(RouteView.openKakaoMap)와 같은 패턴이다. */
export function openAppleMaps(to: Point, mode: AppleMapsMode = "car", from?: Point): void {
  const webUrl = appleMapsUrl(to, mode, from);
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
  window.location.href = `maps://?${params(to, mode, from)}`;
}
