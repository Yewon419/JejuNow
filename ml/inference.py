"""라이브 추론 — 월 예측 × 일중 프로파일 합성 (precompute·/simulate 공용).

정직성(BUILD_PLAN §11): "시간대별" 값은 모델 직접 출력이 아니라
  (스팟×월 인기점유율 예측) × (lcls2×요일×시간 휴리스틱 프로파일)
의 합성. 데이터랩 미매핑 스팟은 동일 cat2(같은 지역) 평균 대체 → is_imputed=True.
미래 월 lag 피처는 관측치만 사용(재귀 예측 금지) — 없으면 NaN.
"""

from __future__ import annotations

import json
import logging
from dataclasses import asdict, dataclass
from datetime import date
from pathlib import Path

import lightgbm as lgb
import numpy as np
import pandas as pd

from api.core.supabase import SupabaseRest
from ml.data import (
    SpotMeta,
    load_datalab_categories,
    load_popularity,
    load_spots,
    load_weather,
)
from ml.features import (
    CATEGORICAL_COLUMNS,
    FEATURE_COLUMNS,
    FeatureRow,
    build_series,
    make_feature_row,
)
from ml.profile import DEFAULT_CAT

logger = logging.getLogger(__name__)

ARTIFACTS = Path("ml/artifacts")
ACTIVE_SINCE = date(2024, 6, 1)  # 최근 24개월 내 TOP30 등장 스팟만 직접 예측
AGE_ALL = "전체"
LEVEL_THRESHOLDS = ((70.0, 4), (45.0, 3), (25.0, 2))


def level_of(pressure: float) -> int:
    for threshold, level in LEVEL_THRESHOLDS:
        if pressure >= threshold:
            return level
    return 1


@dataclass(frozen=True)
class SlotPrediction:
    pressure: float  # 0~100
    level: int  # 1 여유 ~ 4 혼잡
    is_imputed: bool


def load_model() -> tuple[lgb.Booster, dict[str, list[str]]]:
    model_path = ARTIFACTS / "model.txt"
    meta_path = ARTIFACTS / "feature_meta.json"
    if not model_path.exists() or not meta_path.exists():
        raise RuntimeError("모델 아티팩트 없음 — ml.train 선행 필요")
    meta_obj: object = json.loads(meta_path.read_text(encoding="utf-8"))
    if not isinstance(meta_obj, dict):
        raise RuntimeError("feature_meta.json 형식 불량")
    levels_obj = meta_obj.get("categorical_levels")
    if not isinstance(levels_obj, dict):
        raise RuntimeError("categorical_levels 누락")
    levels: dict[str, list[str]] = {
        str(k): [str(x) for x in v] for k, v in levels_obj.items() if isinstance(v, list)
    }
    return lgb.Booster(model_file=str(model_path)), levels


def load_day_profile(db: SupabaseRest) -> dict[tuple[str, int, int], float]:
    out: dict[tuple[str, int, int], float] = {}
    for r in db.select_all("day_profile", {"select": "cat2,weekday,hour,weight"}):
        cat, wd, hr, w = r["cat2"], r["weekday"], r["hour"], r["weight"]
        if (
            not isinstance(cat, str)
            or not isinstance(wd, int)
            or not isinstance(hr, int)
            or not isinstance(w, (int, float))
        ):
            raise RuntimeError(f"day_profile 행 형식 불량: {r!r}")
        out[(cat, wd, hr)] = float(w)
    if not out:
        raise RuntimeError("day_profile이 비어 있음 — ml.profile 선행 필요")
    return out


class LivePredictor:
    """모델·시계열·프로파일을 메모리에 올려 임의 (스팟, 일, 시간) 압력을 계산."""

    def __init__(self, db: SupabaseRest) -> None:
        self._booster, self._levels = load_model()
        pop = load_popularity(db)
        self.spots: dict[int, SpotMeta] = load_spots(db)
        self._weather = load_weather(db)
        self._dl_cat = load_datalab_categories()
        self._series = build_series(pop)
        self._profile = load_day_profile(db)
        self._profile_cats = {c for c, _, _ in self._profile}
        self._dl_to_spot: dict[tuple[str, str], int] = {}
        self._active: set[tuple[str, str]] = set()
        for r in pop:
            if r.age_group != AGE_ALL:
                continue
            key = (r.datalab_spot_id, r.region_code)
            if r.ym >= ACTIVE_SINCE:
                self._active.add(key)
            if r.spot_id is not None:
                self._dl_to_spot.setdefault(key, r.spot_id)
        self._month_cache: dict[date, dict[int, tuple[float, bool]]] = {}

    def _predict_batch(self, rows: list[FeatureRow]) -> list[float]:
        df = pd.DataFrame([asdict(r) for r in rows], columns=list(FEATURE_COLUMNS))
        for col in CATEGORICAL_COLUMNS:
            df[col] = pd.Categorical(df[col], categories=self._levels[col])
        pred = np.asarray(self._booster.predict(df), dtype=np.float64)
        return [float(max(0.0, p)) for p in pred]

    def month_pressures(self, month: date) -> dict[int, tuple[float, bool]]:
        """spot_id → (지역 내 0~100 정규화 압력, is_imputed). 월 단위 캐시."""
        month = date(month.year, month.month, 1)
        cached = self._month_cache.get(month)
        if cached is not None:
            return cached

        feat_rows: list[FeatureRow] = []
        feat_keys: list[tuple[str, str]] = []
        for dl_id, region in sorted(self._active):
            spot_id = self._dl_to_spot.get((dl_id, region))
            meta = self.spots.get(spot_id) if spot_id is not None else None
            if meta is not None and meta.cat2 is not None:
                cat = meta.cat2
            else:
                cat = "DL_" + self._dl_cat.get(dl_id, "기타")
            feat_rows.append(
                make_feature_row(
                    target_ym=month,
                    key=(dl_id, region, AGE_ALL),
                    series=self._series,
                    weather=self._weather,
                    cat=cat,
                    is_outdoor=meta.is_outdoor if meta is not None else None,
                )
            )
            feat_keys.append((dl_id, region))
        preds = self._predict_batch(feat_rows)

        direct: dict[int, float] = {}
        cat_region: dict[tuple[str, str], list[float]] = {}
        region_all: dict[str, list[float]] = {}
        for (dl_id, region), p in zip(feat_keys, preds, strict=True):
            spot_id = self._dl_to_spot.get((dl_id, region))
            if spot_id is None or spot_id not in self.spots:
                continue
            direct[spot_id] = p
            meta = self.spots[spot_id]
            cat_region.setdefault((meta.cat2 or DEFAULT_CAT, meta.region), []).append(p)
            region_all.setdefault(meta.region, []).append(p)

        result: dict[int, tuple[float, bool]] = {}
        max_by_region: dict[str, float] = {}
        for spot_id, p in direct.items():
            region = self.spots[spot_id].region
            max_by_region[region] = max(max_by_region.get(region, 0.0), p)
        for spot_id, meta in self.spots.items():
            if spot_id in direct:
                base, imputed = direct[spot_id], False
            else:
                cat_vals = cat_region.get((meta.cat2 or DEFAULT_CAT, meta.region))
                region_vals = region_all.get(meta.region)
                if cat_vals:
                    base, imputed = sum(cat_vals) / len(cat_vals), True
                elif region_vals:
                    base, imputed = sum(region_vals) / len(region_vals), True
                else:
                    raise RuntimeError(f"대체값 산출 불가: region={meta.region} month={month}")
            denom = max_by_region.get(meta.region, 0.0)
            if denom <= 0:
                raise RuntimeError(f"정규화 분모 0: region={meta.region} month={month}")
            result[spot_id] = (100.0 * base / denom, imputed)
        self._month_cache[month] = result
        return result

    def profile_weight(self, cat2: str | None, weekday: int, hour: int) -> float:
        cat = cat2 if cat2 is not None and cat2 in self._profile_cats else DEFAULT_CAT
        weight = self._profile.get((cat, weekday, hour))
        if weight is None:
            raise RuntimeError(f"day_profile 누락: cat={cat} wd={weekday} h={hour}")
        return weight

    def slot(self, spot_id: int, day: date, hour: int) -> SlotPrediction:
        meta = self.spots.get(spot_id)
        if meta is None:
            raise KeyError(f"미등록 spot_id={spot_id}")
        base, imputed = self.month_pressures(date(day.year, day.month, 1))[spot_id]
        weight = self.profile_weight(meta.cat2, day.weekday(), hour)
        pressure = round(min(100.0, base * weight), 2)
        return SlotPrediction(pressure=pressure, level=level_of(pressure), is_imputed=imputed)
