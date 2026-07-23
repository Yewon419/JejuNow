// Kakao Maps JS SDK 최소 타입 (공식 @types 부재 — 사용 범위만 선언)
export interface KakaoLatLng {
  readonly __brand?: "KakaoLatLng";
}

export interface KakaoPoint {
  readonly __brand?: "KakaoPoint";
}

export interface KakaoProjection {
  coordsFromContainerPoint(point: KakaoPoint): KakaoLatLng;
}

export interface KakaoMapObj {
  setCenter(latlng: KakaoLatLng): void;
  setLevel(
    level: number,
    options?: { anchor?: KakaoLatLng; animate?: boolean | { duration: number } },
  ): void;
  getLevel(): number;
  setBounds(bounds: KakaoLatLngBounds): void;
  setZoomable(zoomable: boolean): void;
  getProjection(): KakaoProjection;
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
  setPosition(latlng: KakaoLatLng): void;
}

export interface KakaoStaticMap {
  readonly __brand?: "KakaoStaticMap";
}

export interface KakaoMapsApi {
  load(callback: () => void): void;
  LatLng: new (lat: number, lng: number) => KakaoLatLng;
  Point: new (x: number, y: number) => KakaoPoint;
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
    addListener(target: KakaoMapObj, type: "click" | "zoom_changed", handler: () => void): void;
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
