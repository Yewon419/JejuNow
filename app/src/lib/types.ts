export type Spot = {
  spot_id: number;
  name: string;
  cat1: string | null;
  cat2: string | null;
  lat: number;
  lng: number;
  addr: string | null;
  opening_hours: string | null;
  image_url: string | null;
  is_outdoor: boolean | null;
  region: string;
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
