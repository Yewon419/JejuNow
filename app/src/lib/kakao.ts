// Kakao Maps JS SDK 최소 타입 (공식 @types 부재 — 사용 범위만 선언)
export interface KakaoLatLng {
  readonly __brand?: "KakaoLatLng";
}

export interface KakaoMapObj {
  setCenter(latlng: KakaoLatLng): void;
  setLevel(level: number): void;
}

export interface KakaoCustomOverlay {
  setMap(map: KakaoMapObj | null): void;
}

export interface KakaoMapsApi {
  load(callback: () => void): void;
  LatLng: new (lat: number, lng: number) => KakaoLatLng;
  Map: new (container: HTMLElement, options: { center: KakaoLatLng; level: number }) => KakaoMapObj;
  CustomOverlay: new (options: {
    position: KakaoLatLng;
    content: HTMLElement;
    yAnchor?: number;
    clickable?: boolean;
    zIndex?: number;
  }) => KakaoCustomOverlay;
}

declare global {
  interface Window {
    kakao?: { maps: KakaoMapsApi };
  }
}
