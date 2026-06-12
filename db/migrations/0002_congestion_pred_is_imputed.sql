-- 정직성 표시: cat2 평균 대체 스팟의 혼잡도 예측 구분 (BUILD_PLAN §11)
alter table congestion_pred add column if not exists is_imputed boolean not null default false;
