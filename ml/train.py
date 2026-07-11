"""LightGBM 학습 — 타겟 = 인기 점유율(%) (절대 검색량 아님, R1).

- 3-way time split: 학습 ~2025-06 / 검증 2025-07~2025-12(early stopping 전용) /
  테스트 2026-01~2026-05(보고 지표). 검증이 조기종료에 관여하므로 보고는 테스트로만 —
  낙관 편향 제거. 미래 누수 금지, 범주 레벨도 학습 구간에서만 산출.
- 평가: MAE/MAPE + 상위·하위 30% 랭킹 일치율. 실측 혼잡도 부재 — 수요 프록시 기준임을 명시.
- 산출: ml/artifacts/{model.txt, metrics.json, feature_meta.json} (+provenance)

실행: .venv\\Scripts\\python.exe -m ml.train
"""

from __future__ import annotations

import json
import logging
import math
import subprocess
from dataclasses import asdict, dataclass
from datetime import date, datetime, timezone
from pathlib import Path

import lightgbm as lgb
import numpy as np
import pandas as pd

from ml.data import (
    PopRow,
    SpotMeta,
    load_datalab_categories,
    load_popularity,
    load_spots,
    load_weather,
    make_db,
)
from ml.features import (
    CATEGORICAL_COLUMNS,
    FEATURE_COLUMNS,
    FeatureRow,
    build_series,
    make_feature_row,
    spot_category,
)

logger = logging.getLogger(__name__)

ARTIFACTS = Path("ml/artifacts")
TRAIN_END = date(2025, 6, 1)  # 이 달까지 학습
VALID_END = date(2025, 12, 1)  # 이 달까지 검증(early stopping) — 이후는 테스트(보고)
LGB_PARAMS: dict[str, object] = {
    "objective": "regression_l1",
    "metric": "mae",
    "learning_rate": 0.05,
    "num_leaves": 63,
    "min_data_in_leaf": 30,
    "feature_fraction": 0.9,
    "bagging_fraction": 0.9,
    "bagging_freq": 1,
    "seed": 42,
    "verbosity": -1,
}
NUM_BOOST_ROUND = 800
EARLY_STOPPING = 50


@dataclass(frozen=True)
class Metrics:
    test_mae: float
    test_mape_pct: float
    test_top30_precision: float
    test_bottom30_precision: float
    valid_mae: float
    n_train: int
    n_valid: int
    n_test: int
    best_iteration: int
    trained_at: str
    git_commit: str
    data_max_ym: str
    note: str


def git_short_head() -> str:
    try:
        out = subprocess.run(
            ["git", "rev-parse", "--short", "HEAD"], capture_output=True, text=True, timeout=10
        )
    except (OSError, subprocess.TimeoutExpired):
        return "unknown"
    return out.stdout.strip() if out.returncode == 0 else "unknown"


def to_frame(rows: list[FeatureRow], cat_levels: dict[str, list[str]]) -> pd.DataFrame:
    df = pd.DataFrame([asdict(r) for r in rows], columns=list(FEATURE_COLUMNS))
    for col in CATEGORICAL_COLUMNS:
        df[col] = pd.Categorical(df[col], categories=cat_levels[col])
    return df


def cat_levels_of(rows: list[FeatureRow]) -> dict[str, list[str]]:
    levels: dict[str, list[str]] = {}
    for col in CATEGORICAL_COLUMNS:
        levels[col] = sorted({str(getattr(r, col)) for r in rows})
    return levels


def ranking_precision(
    pairs: list[tuple[str, date, str, float, float]], *, top: bool
) -> float:
    """(region, ym, age, y_true, y_pred) → 그룹별 상위(또는 하위) 30% 집합 일치 precision."""
    groups: dict[tuple[str, date, str], list[tuple[float, float]]] = {}
    for region, ym, age, y_true, y_pred in pairs:
        groups.setdefault((region, ym, age), []).append((y_true, y_pred))
    scores: list[float] = []
    for members in groups.values():
        n = len(members)
        k = max(1, round(n * 0.3))
        if n < 10:
            continue
        order_true = sorted(range(n), key=lambda i: members[i][0], reverse=top)
        order_pred = sorted(range(n), key=lambda i: members[i][1], reverse=top)
        set_true, set_pred = set(order_true[:k]), set(order_pred[:k])
        scores.append(len(set_true & set_pred) / k)
    if not scores:
        raise RuntimeError("랭킹 평가 가능한 그룹이 없음 (그룹당 10개 미만)")
    return sum(scores) / len(scores)


def main() -> None:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
    db = make_db()
    pop = load_popularity(db)
    spots: dict[int, SpotMeta] = load_spots(db)
    weather = load_weather(db)
    dl_cat = load_datalab_categories()
    series = build_series(pop)

    def outdoor_of(row: PopRow) -> bool | None:
        if row.spot_id is not None and row.spot_id in spots:
            return spots[row.spot_id].is_outdoor
        return None

    feats: list[FeatureRow] = []
    targets: list[float] = []
    splits: list[str] = []  # "train" | "valid" | "test"
    meta_keys: list[tuple[str, date, str]] = []
    for r in pop:
        feats.append(
            make_feature_row(
                target_ym=r.ym,
                key=(r.datalab_spot_id, r.region_code, r.age_group),
                series=series,
                weather=weather,
                cat=spot_category(r, spots, dl_cat),
                is_outdoor=outdoor_of(r),
            )
        )
        targets.append(r.ratio)
        if r.ym <= TRAIN_END:
            splits.append("train")
        elif r.ym <= VALID_END:
            splits.append("valid")
        else:
            splits.append("test")
        meta_keys.append((r.region_code, r.ym, r.age_group))

    # 범주 레벨은 학습 구간에서만 — 검증·테스트 정보 누수 방지
    levels = cat_levels_of([f for f, s in zip(feats, splits, strict=True) if s == "train"])
    df = to_frame(feats, levels)
    y = np.asarray(targets, dtype=np.float64)
    split_arr = np.asarray(splits)
    train_mask = split_arr == "train"
    valid_mask = split_arr == "valid"
    test_mask = split_arr == "test"
    x_train, y_train = df[train_mask], y[train_mask]
    x_valid, y_valid = df[valid_mask], y[valid_mask]
    x_test, y_test = df[test_mask], y[test_mask]
    logger.info("train %d행 / valid %d행 / test %d행", len(x_train), len(x_valid), len(x_test))

    train_set = lgb.Dataset(x_train, label=y_train)
    valid_set = lgb.Dataset(x_valid, label=y_valid, reference=train_set)
    booster = lgb.train(
        LGB_PARAMS,
        train_set,
        num_boost_round=NUM_BOOST_ROUND,
        valid_sets=[valid_set],
        callbacks=[lgb.early_stopping(EARLY_STOPPING), lgb.log_evaluation(100)],
    )

    valid_pred = np.asarray(booster.predict(x_valid), dtype=np.float64)
    valid_mae = float(np.mean(np.abs(valid_pred - y_valid)))

    pred = np.asarray(booster.predict(x_test), dtype=np.float64)
    mae = float(np.mean(np.abs(pred - y_test)))
    eps = 0.1  # ratio가 0 근처인 행의 MAPE 폭주 방지
    mape = float(np.mean(np.abs(pred - y_test) / np.maximum(np.abs(y_test), eps))) * 100
    pairs = [
        (meta_keys[i][0], meta_keys[i][1], meta_keys[i][2], float(y[i]), float(p))
        for i, p in zip(np.flatnonzero(test_mask), pred, strict=True)
    ]
    top30 = ranking_precision(pairs, top=True)
    bottom30 = ranking_precision(pairs, top=False)

    metrics = Metrics(
        test_mae=round(mae, 4),
        test_mape_pct=round(mape, 2),
        test_top30_precision=round(top30, 4),
        test_bottom30_precision=round(bottom30, 4),
        valid_mae=round(valid_mae, 4),
        n_train=len(x_train),
        n_valid=len(x_valid),
        n_test=len(x_test),
        best_iteration=booster.best_iteration,
        trained_at=datetime.now(timezone.utc).isoformat(timespec="seconds"),
        git_commit=git_short_head(),
        data_max_ym=max(r.ym for r in pop).isoformat(),
        note=(
            "타겟=데이터랩 인기 점유율%(수요 프록시). 절대 검색량·실측 혼잡도 아님. "
            "3-way split: valid(2025-07~12)=early stopping 전용, 보고 지표=test(2026-01~05) "
            "hold-out. visitors 거시피처는 공개 API 부재로 제외(README 참조)."
        ),
    )
    ARTIFACTS.mkdir(parents=True, exist_ok=True)
    booster.save_model(str(ARTIFACTS / "model.txt"))
    (ARTIFACTS / "metrics.json").write_text(
        json.dumps(asdict(metrics), ensure_ascii=False, indent=2), encoding="utf-8"
    )
    (ARTIFACTS / "feature_meta.json").write_text(
        json.dumps(
            {"feature_columns": list(FEATURE_COLUMNS), "categorical_levels": levels},
            ensure_ascii=False,
            indent=2,
        ),
        encoding="utf-8",
    )
    logger.info(
        "valid MAE=%.4f | test MAE=%.4f MAPE=%.2f%% top30=%.3f bottom30=%.3f",
        valid_mae, mae, mape, top30, bottom30,
    )
    if not math.isfinite(mae):
        raise RuntimeError("MAE가 유한하지 않음 — 학습 실패")


if __name__ == "__main__":
    main()
