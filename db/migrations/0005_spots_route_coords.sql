-- 스팟 자동차 경로용 도로 접근점 좌표 (route_lat/lng)
-- 봉우리·해안·동굴 등 원 좌표(lat/lng)가 도로에서 멀면 카카오내비가 경로를 거부(102/103)한다.
-- 최근접 주차장(카카오 PK6) 좌표를 여기에 저장하고 경로 계산에만 사용한다.
-- 마커·거리·상세 표시는 원 좌표(lat/lng) 유지. null이면 원 좌표로 폴백.
-- 백필: api.collectors.backfill_route_coords

alter table spots
    add column if not exists route_lat double precision,
    add column if not exists route_lng double precision;
