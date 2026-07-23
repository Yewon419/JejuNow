-- 상세 페이지 「홈페이지·예매」 링크 — TourAPI detailCommon2의 homepage(앵커 HTML에서
-- href 추출한 순수 URL). 백필: api/collectors/backfill_homepage.py
alter table spots add column if not exists homepage text;
