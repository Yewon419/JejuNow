"""일중 분해 prior — day_profile(cat2=lclsSystm2 × 요일 × 시간) 휴리스틱.

⚠️ 휴리스틱 근거 (BUILD_PLAN §R2 — 실측 일중 데이터 없어 명시적 가정으로 정의):
- 관광지 방문은 주간 집중(야간 ~0). 카테고리별 피크 시각·폭만 다르게 설정.
  코드 의미는 TourAPI lclsSystmCode2 조회값 기준(NA=자연, HS=역사, LS=레포츠,
  EX=체험, VE=문화/시설, AC05=캠핑).
  · NA*(자연경관·생태·공원): 11~15시 피크 — 주간 야외 활동
  · HS*(역사·종교): 10~16시 완만
  · LS*(레저스포츠): 9~17시
  · EX*(체험): 10~17시
  · VE06/VE08(공연·행사시설): 저녁 치우침(13~21시)
  · VE07/VE09(전시·교육, 실내): 10~17시
  · 기타 VE·AC·미분류: 기본 곡선(9~18시, 13시 피크)
- 요일 가중: 토·일 ×1.35, 금 ×1.10 (주말 관광 집중 일반 패턴)
- 정규화: 주말 피크시간 = 1.0 → 그 시점 압력 = 월 압력지수 그대로.

실행: .venv\\Scripts\\python.exe -m ml.profile
"""

from __future__ import annotations

import logging
import math
from dataclasses import dataclass

from api.core.config import load_settings
from api.core.supabase import SupabaseRest

logger = logging.getLogger(__name__)

HOURS = range(0, 24)
WEEKDAY_FACTOR = {0: 1.0, 1: 1.0, 2: 1.0, 3: 1.0, 4: 1.10, 5: 1.35, 6: 1.35}
DEFAULT_CAT = "default"


@dataclass(frozen=True)
class Curve:
    peak_hour: float
    sigma: float
    open_hour: int
    close_hour: int


EXACT_CURVES: dict[str, Curve] = {
    "VE06": Curve(16.5, 3.0, 13, 21),
    "VE08": Curve(16.5, 3.0, 13, 21),
    "VE07": Curve(13.5, 3.0, 10, 17),
    "VE09": Curve(13.5, 3.0, 10, 17),
    "AC05": Curve(15.0, 3.5, 10, 20),
}
PREFIX_CURVES: dict[str, Curve] = {
    "NA": Curve(13.0, 2.8, 8, 19),
    "HS": Curve(13.0, 3.2, 9, 18),
    "LS": Curve(13.0, 2.8, 9, 17),
    "EX": Curve(13.5, 3.0, 9, 18),
}
DEFAULT_CURVE = Curve(13.0, 3.0, 9, 18)


def curve_for(cat: str) -> Curve:
    exact = EXACT_CURVES.get(cat)
    if exact is not None:
        return exact
    return PREFIX_CURVES.get(cat[:2], DEFAULT_CURVE)


def hour_weight(curve: Curve, hour: int) -> float:
    if hour < curve.open_hour or hour > curve.close_hour:
        return 0.0
    return math.exp(-((hour - curve.peak_hour) ** 2) / (2 * curve.sigma**2))


def build_profile_rows(cats: set[str]) -> list[dict[str, object]]:
    rows: list[dict[str, object]] = []
    for cat in sorted(cats | {DEFAULT_CAT}):
        curve = curve_for(cat) if cat != DEFAULT_CAT else DEFAULT_CURVE
        base = [hour_weight(curve, h) for h in HOURS]
        peak = max(base)
        if peak <= 0:
            raise RuntimeError(f"day_profile: {cat} 곡선이 전부 0")
        for weekday, factor in WEEKDAY_FACTOR.items():
            for hour, w in zip(HOURS, base, strict=True):
                rows.append(
                    {
                        "cat2": cat,
                        "weekday": weekday,
                        "hour": hour,
                        "weight": round(w / peak * factor / WEEKDAY_FACTOR[5], 6),
                    }
                )
    return rows


def main() -> None:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
    settings = load_settings()
    db = SupabaseRest(settings.supabase_url, settings.supabase_service_role_key)
    spot_rows = db.select_all("spots", {"select": "cat2"})
    cats = {c for r in spot_rows if isinstance(c := r.get("cat2"), str)}
    rows = build_profile_rows(cats)
    db.delete_all("day_profile", "cat2")
    inserted = db.insert("day_profile", rows)
    logger.info("day_profile 적재: %d행 (cat %d종)", inserted, len(cats) + 1)


if __name__ == "__main__":
    main()
