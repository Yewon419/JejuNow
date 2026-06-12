-- JejuNow 초기 스키마 (BUILD_PLAN §4.2 + R1 반영: search_volume → spot_popularity)
-- 적용: Supabase MCP apply_migration (Phase 1)

create table if not exists spots (
    spot_id bigint generated always as identity primary key,
    content_id text unique not null,          -- TourAPI contentId
    name text not null,
    cat1 text,
    cat2 text,
    cat3 text,
    lat double precision not null,
    lng double precision not null,
    addr text,
    opening_hours text,
    image_url text,
    is_outdoor boolean,
    region text not null                      -- '제주시' | '서귀포시'
);

-- 데이터랩 인기 점유율 (R1: 절대 검색량 아님 — 지역·월·연령대 내 점유율 %)
create table if not exists spot_popularity (
    id bigint generated always as identity primary key,
    spot_id bigint references spots (spot_id) on delete set null,  -- 이름매핑 성공 시
    datalab_spot_id text,                     -- 데이터랩 해시 ID (관측행은 not null)
    datalab_spot_name text,
    region_code text not null,                -- 50110 제주시 | 50130 서귀포시
    ym date not null,                         -- 월 (1일로 정규화)
    age_group text not null,                  -- 전체/20/30/40/50/60
    rank smallint,
    ratio double precision not null,          -- 인기 점유율 %
    is_imputed boolean not null default false -- cat2 평균 대체 여부
);

create unique index if not exists spot_popularity_observed_uq
    on spot_popularity (datalab_spot_id, region_code, ym, age_group)
    where datalab_spot_id is not null;

create index if not exists spot_popularity_spot_ym_idx
    on spot_popularity (spot_id, ym);

create table if not exists visitors (
    ym date primary key,
    total_visitors integer not null,
    yoy_growth double precision
);

create table if not exists weather (
    ym date primary key,
    avg_temp double precision,
    precip_mm double precision
);

create table if not exists day_profile (
    cat2 text not null,
    weekday smallint not null,                -- 0=월 ~ 6=일
    hour smallint not null,                   -- 0~23
    weight double precision not null,
    primary key (cat2, weekday, hour)
);

create table if not exists congestion_pred (
    spot_id bigint not null references spots (spot_id) on delete cascade,
    date date not null,
    hour smallint not null,
    pressure double precision not null,       -- 수요 압력 지수 (정규화)
    level smallint not null,                  -- 1 여유 ~ 4 혼잡
    primary key (spot_id, date, hour)
);

create table if not exists user_trips (
    trip_id uuid primary key default gen_random_uuid(),
    user_id text,
    date date not null,
    spots jsonb not null,
    created_at timestamptz not null default now()
);

-- RLS: 읽기 공개(데모 프론트가 anon 키로 조회), 쓰기는 service_role만(정책 없음 = 차단)
alter table spots enable row level security;
alter table spot_popularity enable row level security;
alter table visitors enable row level security;
alter table weather enable row level security;
alter table day_profile enable row level security;
alter table congestion_pred enable row level security;
alter table user_trips enable row level security;

create policy anon_read_spots on spots for select using (true);
create policy anon_read_spot_popularity on spot_popularity for select using (true);
create policy anon_read_visitors on visitors for select using (true);
create policy anon_read_weather on weather for select using (true);
create policy anon_read_day_profile on day_profile for select using (true);
create policy anon_read_congestion_pred on congestion_pred for select using (true);
-- user_trips: 데모는 클라이언트 로컬 저장 사용, 서버 정책은 추후 Auth 도입 시
