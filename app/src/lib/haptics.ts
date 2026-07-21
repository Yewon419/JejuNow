// 햅틱 래퍼 — Capacitor Haptics를 감싸고, 웹·미지원 환경에서는 조용히 무시한다.
// 각 컴포넌트에서 직접 부르지 말고 이 세 함수만 쓴다(강도 정책을 한 곳에서 관리).
import { Capacitor } from "@capacitor/core";
import { Haptics, ImpactStyle, NotificationType } from "@capacitor/haptics";

// 네이티브(iOS)에서만 동작. 웹뷰가 아닌 브라우저에서는 no-op.
const enabled = Capacitor.isNativePlatform();

/** 가벼운 확인 — 탭 전환, 카드·마커 선택처럼 자주 일어나는 가벼운 터치 */
export function tapLight(): void {
  if (!enabled) return;
  void Haptics.impact({ style: ImpactStyle.Light }).catch(() => {});
}

/** 결정·토글 — 유형 선택, 슬롯 추가·삭제, 권한 허용처럼 상태를 바꾸는 터치 */
export function tapMedium(): void {
  if (!enabled) return;
  void Haptics.impact({ style: ImpactStyle.Medium }).catch(() => {});
}

/** 완료 — 일정 저장, 튜토리얼 끝처럼 한 흐름을 마쳤을 때 */
export function notifySuccess(): void {
  if (!enabled) return;
  void Haptics.notification({ type: NotificationType.Success }).catch(() => {});
}
