// 현위치 조회 단일 창구. 네이티브(iOS 셸)에서는 @capacitor/geolocation으로
// CLLocationManager를 직접 써서 WKWebView의 사이트(origin) 위치 권한 팝업을 없앤다
// (앱 권한 + "jejunow.vercel.app이 위치를 사용하려 합니다" 이중 팝업 — 베타 피드백 2026-08-19).
// 웹 브라우저에서는 기존 navigator.geolocation 그대로.
import { Capacitor } from "@capacitor/core";
import { Geolocation } from "@capacitor/geolocation";

export interface GeoPoint {
  lat: number;
  lng: number;
}

interface GeoOptions {
  timeout: number;
  maximumAge: number;
}

export function getCurrentPosition(
  onSuccess: (point: GeoPoint) => void,
  onError: () => void,
  options: GeoOptions,
): void {
  if (Capacitor.isNativePlatform()) {
    Geolocation.getCurrentPosition(options)
      .then((pos) => onSuccess({ lat: pos.coords.latitude, lng: pos.coords.longitude }))
      .catch(onError);
    return;
  }
  if (!navigator.geolocation) {
    onError();
    return;
  }
  navigator.geolocation.getCurrentPosition(
    (pos) => onSuccess({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
    onError,
    options,
  );
}
