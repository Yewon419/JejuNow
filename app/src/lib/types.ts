export type Spot = {
  spot_id: number;
  name: string;
  cat1: string | null;
  cat2: string | null;
  lat: number;
  lng: number;
  // 자동차 경로 계산용 도로 접근점(최근접 주차장). 없으면 null → lat/lng로 폴백.
  // 표시(마커·거리·상세)에는 쓰지 않는다 — 경로 전용.
  route_lat: number | null;
  route_lng: number | null;
  addr: string | null;
  opening_hours: string | null;
  image_url: string | null;
  is_outdoor: boolean | null;
  region: string;
};

/** 상세 페이지 전용 — 목록 조회는 페이로드 절약을 위해 overview·tel을 select하지 않는다 */
export type SpotDetail = Spot & {
  overview: string | null;
  tel: string | null;
};

export type Congestion = {
  spot_id: number;
  pressure: number;
  level: number; // 1 여유 ~ 4 혼잡
  is_imputed: boolean; // true = cat2 평균 대체 추정치
};

export type WeatherMonth = {
  ym: string; // YYYY-MM-01
  avg_temp: number | null;
  precip_mm: number | null;
};

export type ScheduleSlot = {
  hour: number;
  spotId: number;
};

export type Schedule = {
  date: string; // YYYY-MM-DD
  slots: ScheduleSlot[];
};
