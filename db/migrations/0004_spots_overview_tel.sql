-- 상세페이지 소개·전화 (TourAPI detailCommon2 — 수집: api/collectors/backfill_overview.py)
alter table spots add column if not exists overview text;
alter table spots add column if not exists tel text;
