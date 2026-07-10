-- 지배 쿼리(date=eq & hour=eq 전 스팟 조회)가 PK(spot_id, date, hour) 프리픽스를 못 타서
-- 768,960행 시퀀셜 스캔 — (date, hour) 보조 인덱스로 해소
create index if not exists congestion_pred_date_hour_idx
  on congestion_pred (date, hour);
