"""피처 엔지니어링 — 시점·lag·rolling·날씨·스팟 피처 (미래 누수 금지).

- 시계열 키: (datalab_spot_id, region_code, age_group), 월 인덱스 = year*12+month.
- lag/rolling은 해당 시점 **이전** 관측만 사용. TOP30 밖 결측 월은 NaN(LightGBM 네이티브 처리).
- visitors 거시피처는 미확보로 제외(로그 명시).
"""

from __future__ import annotations

import math
from dataclasses import dataclass
from datetime import date

import holidays

from ml.data import PopRow, SpotMeta

FEATURE_COLUMNS: tuple[str, ...] = (
    "month",
    "quarter",
    "is_peak",
    "holiday_count",
    "lag_1m",
    "lag_3m",
    "lag_12m",
    "rolling_mean_3m",
    "rolling_mean_6m",
    "avg_temp",
    "precip_mm",
    "is_outdoor",
    "cat",
    "region_code",
    "age_group",
)
CATEGORICAL_COLUMNS: tuple[str, ...] = ("cat", "region_code", "age_group")
PEAK_MONTHS = (7, 8)  # 제주 성수기(여름). 휴리스틱 — 발표자료에 근거 명시
_KR_HOLIDAYS = holidays.country_holidays("KR", years=range(2017, 2028))


def ym_index(d: date) -> int:
    return d.year * 12 + (d.month - 1)


def index_to_date(idx: int) -> date:
    return date(idx // 12, idx % 12 + 1, 1)


def holiday_count(d: date) -> int:
    """해당 월의 휴일 수 (주말 + 공휴일)."""
    next_month = date(d.year + (d.month == 12), d.month % 12 + 1, 1)
    days_in_month = (next_month - date(d.year, d.month, 1)).days
    count = 0
    for day in range(1, days_in_month + 1):
        cur = date(d.year, d.month, day)
        if cur in _KR_HOLIDAYS or cur.weekday() >= 5:
            count += 1
    return count


@dataclass(frozen=True)
class FeatureRow:
    """LightGBM 입력 1행. 수치 결측은 NaN."""

    month: int
    quarter: int
    is_peak: int
    holiday_count: int
    lag_1m: float
    lag_3m: float
    lag_12m: float
    rolling_mean_3m: float
    rolling_mean_6m: float
    avg_temp: float
    precip_mm: float
    is_outdoor: float
    cat: str
    region_code: str
    age_group: str


SeriesKey = tuple[str, str, str]  # (datalab_spot_id, region_code, age_group)


def build_series(rows: list[PopRow]) -> dict[SeriesKey, dict[int, float]]:
    series: dict[SeriesKey, dict[int, float]] = {}
    for r in rows:
        key = (r.datalab_spot_id, r.region_code, r.age_group)
        series.setdefault(key, {})[ym_index(r.ym)] = r.ratio
    return series


def _past_mean(values: dict[int, float], idx: int, window: int) -> float:
    past = [values[i] for i in range(idx - window, idx) if i in values]
    return sum(past) / len(past) if past else math.nan


def spot_category(row: PopRow, spots: dict[int, SpotMeta], dl_category: dict[str, str]) -> str:
    """TourAPI cat2 우선, 미매핑이면 데이터랩 분류를 별도 네임스페이스로."""
    if row.spot_id is not None:
        meta = spots.get(row.spot_id)
        if meta is not None and meta.cat2 is not None:
            return meta.cat2
    return "DL_" + dl_category.get(row.datalab_spot_id, "기타")


def make_feature_row(
    *,
    target_ym: date,
    key: SeriesKey,
    series: dict[SeriesKey, dict[int, float]],
    weather: dict[date, tuple[float | None, float | None]],
    cat: str,
    is_outdoor: bool | None,
) -> FeatureRow:
    values = series.get(key, {})
    idx = ym_index(target_ym)
    temp, rain = weather.get(target_ym, (None, None))
    return FeatureRow(
        month=target_ym.month,
        quarter=(target_ym.month - 1) // 3 + 1,
        is_peak=1 if target_ym.month in PEAK_MONTHS else 0,
        holiday_count=holiday_count(target_ym),
        lag_1m=values.get(idx - 1, math.nan),
        lag_3m=values.get(idx - 3, math.nan),
        lag_12m=values.get(idx - 12, math.nan),
        rolling_mean_3m=_past_mean(values, idx, 3),
        rolling_mean_6m=_past_mean(values, idx, 6),
        avg_temp=temp if temp is not None else math.nan,
        precip_mm=rain if rain is not None else math.nan,
        is_outdoor=float(is_outdoor) if is_outdoor is not None else math.nan,
        cat=cat,
        region_code=key[1],
        age_group=key[2],
    )
