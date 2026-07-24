"use client";

import Image from "next/image";
import { useCallback, useRef, useState } from "react";
import {
  buildOffer,
  chooseCandidate,
  finishPlan,
  initAutoPlan,
  planTargets,
  randomOrigin,
  scarceWindow,
  skipOffer,
  toScheduleSlots,
  type AutoPlanState,
  type Candidate,
  type Crowd,
  type EndAnchor,
  type Pace,
  type PairOffer,
  type PlanPrefs,
  type Transport,
} from "@/lib/autoplan";
import { haversineKm } from "@/lib/alternatives";
import {
  HORIZON_END,
  HORIZON_START,
  HOUR_MAX,
  addDaysStr,
  catLabel,
  formatKstDate,
  kstTodayStr,
  nowKstHourClamped,
  spotDisplayName,
} from "@/lib/constants";
import { tapLight, tapMedium } from "@/lib/haptics";
import { fetchCongestionClient } from "@/lib/supabaseClient";
import type { Congestion, Journey, ScheduleSlot, Spot } from "@/lib/types";
import { LevelBadge } from "./LevelBadge";

// 현위치가 제주 안일 때만 시작점으로 채택 (autoplan·QuietNearby와 동일 기준)
const JEJU_BBOX = { minLat: 33.0, maxLat: 33.7, minLng: 126.0, maxLng: 127.1 };

type EndKind = "return" | "airport" | "spot" | "free";
type Step = "questions" | "locating" | "region" | "rounds" | "done";

const PACE_OPTIONS: { id: Pace; label: string; desc: string }[] = [
  { id: "relaxed", label: "여유롭게", desc: "한 곳에 오래, 2~4곳" },
  { id: "normal", label: "보통", desc: "적당한 템포, 4~6곳" },
  { id: "packed", label: "빡빡하게", desc: "많이 돌기, 6~8곳" },
];
const TRANSPORT_OPTIONS: { id: Transport; label: string }[] = [
  { id: "car", label: "자동차" },
  { id: "transit", label: "대중교통" },
  { id: "walk", label: "도보 위주" },
];
const CROWD_OPTIONS: { id: Crowd; label: string }[] = [
  { id: "calm", label: "한적해야 해요" },
  { id: "moderate", label: "보통까진 괜찮아요" },
  { id: "any", label: "상관없어요" },
];
const END_OPTIONS: { id: EndKind; label: string }[] = [
  { id: "return", label: "시작한 곳으로" },
  { id: "airport", label: "공항" },
  { id: "spot", label: "다른 장소" },
  { id: "free", label: "정하지 않음" },
];

function OptionChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={() => {
        tapLight();
        onClick();
      }}
      className={`cursor-pointer rounded-full px-3.5 py-2 text-sm font-semibold transition-colors ${
        active ? "bg-cta text-on-cta" : "bg-card text-ink shadow-card"
      }`}
    >
      {children}
    </button>
  );
}

/** 2지선다 후보 카드 — 홈 캐러셀과 같은 사진 오버레이 문법 */
function CandidateCard({ cand, onPick }: { cand: Candidate; onPick: () => void }) {
  return (
    <button
      type="button"
      onClick={onPick}
      className="relative block h-52 w-full cursor-pointer overflow-hidden rounded-card text-left shadow-card transition-transform active:scale-[0.97]"
    >
      {cand.spot.image_url ? (
        <Image
          src={cand.spot.image_url}
          alt=""
          fill
          sizes="(max-width: 640px) 50vw, 288px"
          className="object-cover photo-warm"
          unoptimized={cand.spot.image_url.endsWith(".bmp")}
        />
      ) : (
        <div className="h-full w-full bg-gradient-to-br from-primary to-cta" aria-hidden />
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/25 to-black/5" aria-hidden />
      <div className="absolute left-2.5 top-2.5">
        <LevelBadge level={cand.congestion.level} imputed={cand.congestion.is_imputed} onPhoto />
      </div>
      <div className="absolute inset-x-0 bottom-0 p-3">
        <p className="text-sm font-bold leading-snug text-white [text-shadow:0_1px_8px_rgba(0,0,0,0.5)]">
          {spotDisplayName(cand.spot.name)}
        </p>
        <p className="mt-0.5 text-[11px] text-white/85">
          {catLabel(cand.spot.cat2)} · {cand.travelKm}km · 약 {cand.travelMin}분
        </p>
      </div>
    </button>
  );
}

type Airport = { name: string; addr: string; lat: number; lng: number };

export function AutoPlanFlow({
  spots,
  date,
  existingCount,
  onApply,
  onClose,
}: {
  spots: Spot[];
  date: string;
  existingCount: number;
  onApply: (planDate: string, slots: ScheduleSlot[], journey: Journey) => void;
  onClose: () => void;
}) {
  const [step, setStep] = useState<Step>("questions");
  // 오토플랜 자체 날짜 — 일정 탭 날짜로 시작하되 안에서 바꿀 수 있다(내일로 짜기)
  const [planDate, setPlanDate] = useState(date);
  const [pace, setPace] = useState<Pace | null>(null);
  const [transport, setTransport] = useState<Transport | null>(null);
  const [crowd, setCrowd] = useState<Crowd | null>(null);
  const [endKind, setEndKind] = useState<EndKind | null>(null);
  const [endSpotId, setEndSpotId] = useState<number | null>(null);
  const [endQuery, setEndQuery] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  // 공항: 카카오 로컬 검색(전국 확대 대비 — 제주 고정 아님)으로 선택
  const [airport, setAirport] = useState<Airport | null>(null);
  const [airportQuery, setAirportQuery] = useState("");
  const [airportResults, setAirportResults] = useState<Airport[]>([]);
  const airportTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [plan, setPlan] = useState<AutoPlanState | null>(null);
  const [offer, setOffer] = useState<PairOffer | null>(null);
  const seedRef = useRef(0);
  const originLabelRef = useRef("내 위치");
  const congCache = useRef(new Map<number, Map<number, Congestion>>());

  const spotById = new Map(spots.map((s) => [s.spot_id, s]));
  const endSpot = endSpotId !== null ? spotById.get(endSpotId) : undefined;
  const endResults = endQuery.trim()
    ? spots.filter((s) => s.name.includes(endQuery.trim())).slice(0, 6)
    : [];
  const ready =
    pace !== null &&
    transport !== null &&
    crowd !== null &&
    endKind !== null &&
    (endKind !== "spot" || endSpotId !== null) &&
    (endKind !== "airport" || airport !== null);

  function searchAirports(q: string) {
    setAirportQuery(q);
    if (airportTimer.current) clearTimeout(airportTimer.current);
    const trimmed = q.trim();
    if (trimmed.length === 0) {
      setAirportResults([]);
      return;
    }
    airportTimer.current = setTimeout(() => {
      fetch(`/api/kakao-places?q=${encodeURIComponent(trimmed)}`)
        .then(async (res) => (res.ok ? ((await res.json()) as { places: Airport[] }) : null))
        .then((data) => {
          if (data) setAirportResults(data.places);
        })
        .catch(() => setAirportResults([]));
    }, 350);
  }

  const startHour =
    planDate === kstTodayStr() ? Math.min(HOUR_MAX, nowKstHourClamped() + 1) : 9;
  // 선택 취향으로 남은 시간이 부족한지 — 목표가 3곳 미만이면 내일을 권한다
  const prefsForWindow: PlanPrefs | null =
    pace && transport && crowd ? { pace, transport, crowd, end: { kind: "free" } } : null;
  const scarce = prefsForWindow ? scarceWindow(prefsForWindow, startHour) : false;
  const windowTargetStops = prefsForWindow ? planTargets(prefsForWindow, startHour).stops : null;
  const canGoTomorrow = addDaysStr(kstTodayStr(), 1) <= HORIZON_END;

  const loadOffer = useCallback(
    async (st: AutoPlanState) => {
      if (st.done) {
        setStep("done");
        return;
      }
      setOffer(null);
      let cmap = congCache.current.get(st.hourCursor);
      if (!cmap) {
        try {
          const rows = await fetchCongestionClient(st.date, st.hourCursor);
          cmap = new Map(rows.map((c) => [c.spot_id, c]));
        } catch {
          cmap = new Map();
        }
        congCache.current.set(st.hourCursor, cmap);
      }
      const o = buildOffer(st, spots, cmap);
      if (!o) {
        setPlan(finishPlan(st));
        setStep("done");
        return;
      }
      setOffer(o);
    },
    [spots],
  );

  function initWith(origin: { lat: number; lng: number }, originLabel: string) {
    if (!pace || !transport || !crowd || !endKind) return;
    originLabelRef.current = originLabel;
    const end: EndAnchor =
      endKind === "return"
        ? { kind: "return" }
        : endKind === "airport" && airport
          ? { kind: "point", lat: airport.lat, lng: airport.lng, label: airport.name }
          : endKind === "spot" && endSpot
            ? { kind: "point", lat: endSpot.lat, lng: endSpot.lng, label: spotDisplayName(endSpot.name) }
            : { kind: "free" };
    const st = initAutoPlan({
      date: planDate,
      startHour,
      origin,
      prefs: { pace, transport, crowd, end },
      seed: seedRef.current,
    });
    if (!st.endFeasible) {
      setNotice("이 이동수단으로는 도착지까지 닿기 어려워요. 이동수단이나 도착지를 바꿔 주세요.");
      setStep("questions");
      return;
    }
    setNotice(null);
    setPlan(st);
    setStep("rounds");
    void loadOffer(st);
  }

  function begin() {
    tapMedium();
    // 이벤트 핸들러의 1회성 시드 생성 — 렌더가 아니므로 purity 룰의 false positive
    // eslint-disable-next-line react-hooks/purity
    seedRef.current = Date.now() % 2147483647;
    setStep("locating");
    if (!navigator.geolocation) {
      setStep("region");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude: lat, longitude: lng } = pos.coords;
        const inJeju =
          lat >= JEJU_BBOX.minLat &&
          lat <= JEJU_BBOX.maxLat &&
          lng >= JEJU_BBOX.minLng &&
          lng <= JEJU_BBOX.maxLng;
        if (inJeju) initWith({ lat, lng }, "내 위치");
        else setStep("region");
      },
      () => setStep("region"),
      { timeout: 5000, maximumAge: 300_000 },
    );
  }

  function pick(which: "a" | "b") {
    if (!plan || !offer) return;
    tapMedium();
    const next = chooseCandidate(plan, offer, which);
    setPlan(next);
    if (next.done) setStep("done");
    else void loadOffer(next);
  }

  function skip() {
    if (!plan || !offer) return;
    tapLight();
    const next = skipOffer(plan, offer);
    setPlan(next);
    void loadOffer(next);
  }

  function stopHere() {
    if (!plan) return;
    tapLight();
    setPlan(finishPlan(plan));
    setStep("done");
  }

  function apply() {
    if (!plan) return;
    tapMedium();
    const endLabel =
      endKind === "return"
        ? "출발지로 복귀"
        : endKind === "airport" && airport
          ? airport.name
          : endKind === "spot" && endSpot
            ? spotDisplayName(endSpot.name)
            : null;
    const journey: Journey = {
      origin: { lat: plan.origin.lat, lng: plan.origin.lng, label: originLabelRef.current },
      end:
        plan.end && endLabel !== null
          ? { lat: plan.end.lat, lng: plan.end.lng, label: endLabel }
          : null,
    };
    onApply(plan.date, toScheduleSlots(plan), journey);
    onClose();
  }

  const lastStopSpot =
    plan && plan.stops.length > 0 ? spotById.get(plan.stops[plan.stops.length - 1].spotId) : undefined;
  const finalLegKm =
    plan?.end && lastStopSpot
      ? Math.round(haversineKm(lastStopSpot.lat, lastStopSpot.lng, plan.end.lat, plan.end.lng) * 10) / 10
      : null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-bg" role="dialog" aria-modal="true" aria-label="자동 일정 짜기">
      <div
        className="mx-auto min-h-dvh max-w-md px-5 pt-[calc(env(safe-area-inset-top,0px)+1rem)] md:max-w-xl"
        style={{ paddingBottom: "calc(2rem + env(safe-area-inset-bottom, 0px))" }}
      >
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-xl font-bold text-ink">자동으로 짜기</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="닫기"
            className="cursor-pointer rounded-full bg-card p-2 text-dim shadow-card hover:text-ink"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-5 w-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {step === "questions" ? (
          <div className="space-y-6">
            {notice ? (
              <p className="rounded-card border border-lv3/40 bg-lv3/10 p-3 text-sm leading-relaxed text-ink">
                {notice}
              </p>
            ) : null}
            <section>
              <h3 className="mb-2.5 text-sm font-bold text-ink">일정은 어느 정도가 좋아요?</h3>
              <div className="flex flex-wrap gap-2">
                {PACE_OPTIONS.map((o) => (
                  <OptionChip key={o.id} active={pace === o.id} onClick={() => setPace(o.id)}>
                    {o.label} <span className="font-normal opacity-75">· {o.desc}</span>
                  </OptionChip>
                ))}
              </div>
            </section>
            <section>
              <h3 className="mb-2.5 text-sm font-bold text-ink">이동은 어떻게 해요?</h3>
              <div className="flex flex-wrap gap-2">
                {TRANSPORT_OPTIONS.map((o) => (
                  <OptionChip key={o.id} active={transport === o.id} onClick={() => setTransport(o.id)}>
                    {o.label}
                  </OptionChip>
                ))}
              </div>
            </section>
            <section>
              <h3 className="mb-2.5 text-sm font-bold text-ink">붐비는 건 어느 정도까지 괜찮아요?</h3>
              <div className="flex flex-wrap gap-2">
                {CROWD_OPTIONS.map((o) => (
                  <OptionChip key={o.id} active={crowd === o.id} onClick={() => setCrowd(o.id)}>
                    {o.label}
                  </OptionChip>
                ))}
              </div>
            </section>
            <section>
              <h3 className="mb-2.5 text-sm font-bold text-ink">여정의 끝은 어디로 할까요?</h3>
              <div className="flex flex-wrap gap-2">
                {END_OPTIONS.map((o) => (
                  <OptionChip key={o.id} active={endKind === o.id} onClick={() => setEndKind(o.id)}>
                    {o.label}
                  </OptionChip>
                ))}
              </div>
              {endKind === "airport" ? (
                <div className="mt-3">
                  {airport ? (
                    <div className="flex items-center justify-between rounded-xl border border-line bg-card p-3">
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-semibold text-ink">
                          {airport.name}
                        </span>
                        {airport.addr ? (
                          <span className="block truncate text-xs text-dim">{airport.addr}</span>
                        ) : null}
                      </span>
                      <button
                        type="button"
                        onClick={() => setAirport(null)}
                        className="shrink-0 cursor-pointer text-xs font-medium text-dim hover:text-ink"
                      >
                        다시 고르기
                      </button>
                    </div>
                  ) : (
                    <>
                      <input
                        type="search"
                        placeholder="공항 검색 (예: 제주, 김포)"
                        value={airportQuery}
                        onChange={(e) => searchAirports(e.target.value)}
                        className="w-full rounded-lg border border-line bg-card px-3 py-2.5 text-base text-ink placeholder:text-dim"
                      />
                      <ul className="mt-2 space-y-1.5">
                        {airportResults.map((a) => (
                          <li key={`${a.name}-${a.lat}`}>
                            <button
                              type="button"
                              onClick={() => {
                                tapLight();
                                setAirport(a);
                                setAirportQuery("");
                                setAirportResults([]);
                              }}
                              className="w-full cursor-pointer rounded-xl border border-line bg-card p-3 text-left"
                            >
                              <span className="block text-sm font-semibold text-ink">{a.name}</span>
                              {a.addr ? <span className="text-xs text-dim">{a.addr}</span> : null}
                            </button>
                          </li>
                        ))}
                      </ul>
                    </>
                  )}
                </div>
              ) : null}
              {endKind === "spot" ? (
                <div className="mt-3">
                  {endSpot ? (
                    <div className="flex items-center justify-between rounded-xl border border-line bg-card p-3">
                      <span className="min-w-0 truncate text-sm font-semibold text-ink">
                        {spotDisplayName(endSpot.name)}
                      </span>
                      <button
                        type="button"
                        onClick={() => setEndSpotId(null)}
                        className="shrink-0 cursor-pointer text-xs font-medium text-dim hover:text-ink"
                      >
                        다시 고르기
                      </button>
                    </div>
                  ) : (
                    <>
                      <input
                        type="search"
                        placeholder="도착지 검색 (예: 성산일출봉)"
                        value={endQuery}
                        onChange={(e) => setEndQuery(e.target.value)}
                        className="w-full rounded-lg border border-line bg-card px-3 py-2.5 text-base text-ink placeholder:text-dim"
                      />
                      <ul className="mt-2 space-y-1.5">
                        {endResults.map((s) => (
                          <li key={s.spot_id}>
                            <button
                              type="button"
                              onClick={() => {
                                tapLight();
                                setEndSpotId(s.spot_id);
                                setEndQuery("");
                              }}
                              className="w-full cursor-pointer rounded-xl border border-line bg-card p-3 text-left"
                            >
                              <span className="block text-sm font-semibold text-ink">
                                {spotDisplayName(s.name)}
                              </span>
                              <span className="text-xs text-dim">
                                {s.region} · {catLabel(s.cat2)}
                              </span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    </>
                  )}
                </div>
              ) : null}
            </section>
            <section>
              <h3 className="mb-2.5 text-sm font-bold text-ink">언제 여행해요?</h3>
              <input
                type="date"
                aria-label="여행 날짜"
                value={planDate}
                min={HORIZON_START}
                max={HORIZON_END}
                onChange={(e) => setPlanDate(e.target.value)}
                className="rounded-lg border border-line bg-card px-3 py-2.5 text-base text-ink shadow-card"
              />
              {/* 오늘 남은 시간이 짧으면 내일을 권한다 — packed를 골라도 시간이 없으면 1~2곳뿐 */}
              {scarce && planDate === kstTodayStr() && canGoTomorrow ? (
                <div className="mt-2.5 rounded-card border border-lv2/40 bg-lv2/10 p-3">
                  <p className="text-xs leading-relaxed text-ink">
                    오늘은 남은 시간이 짧아 이대로는 {windowTargetStops}곳 정도만 짤 수 있어요.
                    내일로 짜면 더 알차요.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      tapLight();
                      setPlanDate(addDaysStr(kstTodayStr(), 1));
                    }}
                    className="mt-2 cursor-pointer text-sm font-bold text-primary underline underline-offset-4"
                  >
                    내일({formatKstDate(addDaysStr(kstTodayStr(), 1))})로 짜기
                  </button>
                </div>
              ) : null}
            </section>
            <button
              type="button"
              disabled={!ready}
              onClick={begin}
              className="w-full cursor-pointer rounded-card bg-cta py-4 text-center text-base font-bold text-on-cta transition-transform active:scale-[0.98] disabled:cursor-default disabled:opacity-40"
            >
              시작하기
            </button>
          </div>
        ) : null}

        {step === "locating" ? (
          <p className="py-16 text-center text-sm text-dim">
            현위치를 확인하고 있어요…
          </p>
        ) : null}

        {step === "region" ? (
          <div className="space-y-4">
            <p className="text-sm leading-relaxed text-dim">
              위치를 쓸 수 없어 지역 안에서 시작점을 골라 드릴게요. 어느 쪽에서 시작해요?
            </p>
            <div className="grid grid-cols-2 gap-3">
              {(["제주시", "서귀포시"] as const).map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => {
                    tapLight();
                    initWith(randomOrigin(spots, seedRef.current, r), `${r} 근처`);
                  }}
                  className="cursor-pointer rounded-card bg-card py-6 text-center text-base font-bold text-ink shadow-card transition-transform active:scale-[0.98]"
                >
                  {r}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {step === "rounds" && plan ? (
          <div className="space-y-4">
            <p className="text-sm text-dim">
              <span className="font-bold text-ink">{plan.stops.length + 1}번째 장소</span>
              {" · "}약 {plan.targetStops}곳 목표 · {offer?.hour ?? plan.hourCursor}시 도착 기준
            </p>
            {offer ? (
              <>
                <div className={offer.b ? "grid grid-cols-2 gap-3" : ""}>
                  <CandidateCard cand={offer.a} onPick={() => pick("a")} />
                  {offer.b ? <CandidateCard cand={offer.b} onPick={() => pick("b")} /> : null}
                </div>
                {!offer.b ? (
                  <p className="text-xs text-dim">지금 조건에 맞는 곳이 하나뿐이에요.</p>
                ) : null}
                <div className="flex gap-2.5">
                  <button
                    type="button"
                    onClick={skip}
                    className="flex-1 cursor-pointer rounded-xl border border-line bg-card py-3 text-sm font-semibold text-ink"
                  >
                    둘 다 별로예요
                  </button>
                  {plan.stops.length > 0 ? (
                    <button
                      type="button"
                      onClick={stopHere}
                      className="flex-1 cursor-pointer rounded-xl border border-line bg-card py-3 text-sm font-semibold text-ink"
                    >
                      여기까지만 할래요
                    </button>
                  ) : null}
                </div>
              </>
            ) : (
              <p className="py-12 text-center text-sm text-dim">다음 장소를 고르고 있어요…</p>
            )}
            <p className="text-[11px] leading-relaxed text-dim">
              거리·이동시간은 직선거리 기반 추정이에요. 혼잡도는 도착 시각 예측값 기준.
            </p>
          </div>
        ) : null}

        {step === "done" && plan ? (
          <div className="space-y-5">
            {plan.stops.length === 0 ? (
              <>
                <p className="rounded-card bg-card p-4 text-sm leading-relaxed text-ink shadow-card">
                  조건에 맞는 곳을 찾지 못했어요. 혼잡 허용을 넓히거나 이동수단을 바꿔 보세요.
                </p>
                <button
                  type="button"
                  onClick={() => setStep("questions")}
                  className="w-full cursor-pointer rounded-card bg-cta py-4 text-center text-base font-bold text-on-cta"
                >
                  조건 바꾸기
                </button>
              </>
            ) : (
              <>
                <ul className="space-y-2.5">
                  {plan.stops.map((s) => {
                    const spot = spotById.get(s.spotId);
                    if (!spot) return null;
                    return (
                      <li key={s.hour} className="flex items-center gap-3 rounded-card bg-card p-3 shadow-card">
                        <span className="w-9 shrink-0 text-xs font-semibold text-dim">{s.hour}시</span>
                        <span className="relative h-10 w-10 shrink-0 overflow-hidden rounded-xl bg-line">
                          {spot.image_url ? (
                            <Image
                              src={spot.image_url}
                              alt=""
                              fill
                              sizes="40px"
                              className="object-cover photo-warm"
                              unoptimized={spot.image_url.endsWith(".bmp")}
                            />
                          ) : null}
                        </span>
                        <span className="min-w-0 flex-1 truncate text-sm font-medium text-ink">
                          {spotDisplayName(spot.name)}
                        </span>
                      </li>
                    );
                  })}
                </ul>
                {plan.doneReason === "exhausted" ? (
                  <p className="text-xs leading-relaxed text-dim">
                    조건에 맞는 곳이 더 없어서 여기까지 짰어요.
                  </p>
                ) : null}
                {/* 시간 만료(오늘 늦게 시작)로 적게 짜였으면 내일 다시 짜기를 권한다 */}
                {plan.doneReason === "time" && plan.date === kstTodayStr() && canGoTomorrow ? (
                  <div className="rounded-card border border-lv2/40 bg-lv2/10 p-3">
                    <p className="text-xs leading-relaxed text-ink">
                      오늘은 남은 시간이 짧아 {plan.stops.length}곳까지 짰어요. 더 알찬 일정은
                      내일로 다시 짜보세요.
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        tapLight();
                        setPlanDate(addDaysStr(kstTodayStr(), 1));
                        setPlan(null);
                        setStep("questions");
                      }}
                      className="mt-2 cursor-pointer text-sm font-bold text-primary underline underline-offset-4"
                    >
                      내일로 다시 짜기
                    </button>
                  </div>
                ) : null}
                {finalLegKm !== null && finalLegKm > 1 ? (
                  <p className="text-xs leading-relaxed text-dim">
                    마지막 장소에서 도착지까지 직선거리 약 {finalLegKm}km예요.
                  </p>
                ) : null}
                <button
                  type="button"
                  onClick={apply}
                  className="w-full cursor-pointer rounded-card bg-cta py-4 text-center text-base font-bold text-on-cta transition-transform active:scale-[0.98]"
                >
                  {existingCount > 0 ? `기존 일정 ${existingCount}곳 대체하기` : "일정에 넣기"}
                </button>
              </>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}
