// Kakao Maps JS SDK 최소 타입 (공식 @types 부재 — 사용 범위만 선언)
export interface KakaoLatLng {
  readonly __brand?: "KakaoLatLng";
}

export interface KakaoMapObj {
  setCenter(latlng: KakaoLatLng): void;
  setLevel(level: number): void;
  setBounds(bounds: KakaoLatLngBounds): void;
}

export interface KakaoLatLngBounds {
  extend(latlng: KakaoLatLng): void;
}

export interface KakaoPolyline {
  setMap(map: KakaoMapObj | null): void;
}

export interface KakaoCustomOverlay {
  setMap(map: KakaoMapObj | null): void;
  setZIndex(zIndex: number): void;
}

export interface KakaoStaticMap {
  readonly __brand?: "KakaoStaticMap";
}

export interface KakaoMapsApi {
  load(callback: () => void): void;
  LatLng: new (lat: number, lng: number) => KakaoLatLng;
  Map: new (container: HTMLElement, options: { center: KakaoLatLng; level: number }) => KakaoMapObj;
  StaticMap: new (
    container: HTMLElement,
    options: { center: KakaoLatLng; level?: number; marker?: { position?: KakaoLatLng } },
  ) => KakaoStaticMap;
  CustomOverlay: new (options: {
    position: KakaoLatLng;
    content: HTMLElement;
    yAnchor?: number;
    clickable?: boolean;
    zIndex?: number;
  }) => KakaoCustomOverlay;
  event: {
    addListener(target: KakaoMapObj, type: "click", handler: () => void): void;
  };
  LatLngBounds: new () => KakaoLatLngBounds;
  Polyline: new (options: {
    map?: KakaoMapObj;
    path: KakaoLatLng[];
    strokeWeight?: number;
    strokeColor?: string;
    strokeOpacity?: number;
    strokeStyle?: string;
  }) => KakaoPolyline;
}

declare global {
  interface Window {
    kakao?: { maps: KakaoMapsApi };
  }
}
