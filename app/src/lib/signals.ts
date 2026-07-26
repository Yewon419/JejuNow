// 취향 신호 저장·집계 (client localStorage, 무계정). 상세 진입·일정 담기·즐겨찾기·
// 좋아요/별로예요를 카테고리(cat2 + cat1 그룹) 가산점으로 환산해 추천에 쓴다.
// 토글 가능한 신호(반응·즐겨찾기)는 원자료를 저장하고 집계는 그때그때 계산한다.
import type { Spot } from "./types";

export type Reaction = "like" | "dislike";

const K_REACTIONS = "jejunow:reactions";
const K_FAVORITES = "jejunow:favorites";
const K_VIEWS = "jejunow:views";

// 가중치
const W_VIEW = 1;
const W_SCHEDULE = 3;
const W_FAVORITE = 4;
const W_LIKE = 5;
const W_DISLIKE = -6;
const GROUP_FACTOR = 0.5; // cat1 그룹은 세분(cat2)보다 낮게 반영

function readRecord<T>(key: string): Record<string, T> {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    return typeof parsed === "object" && parsed !== null ? (parsed as Record<string, T>) : {};
  } catch {
    return {};
  }
}

function writeRecord<T>(key: string, value: Record<string, T>): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // 저장 불가 환경 무시
  }
}

// --- 반응(좋아요/별로예요) ---
export function readReactions(): Record<string, Reaction> {
  return readRecord<Reaction>(K_REACTIONS);
}

export function getReaction(spotId: number): Reaction | null {
  return readReactions()[String(spotId)] ?? null;
}

/** 같은 값을 다시 주면 해제(null), 다른 값이면 교체 */
export function toggleReaction(spotId: number, next: Reaction): Reaction | null {
  const map = readReactions();
  const key = String(spotId);
  const resolved = map[key] === next ? null : next;
  if (resolved === null) delete map[key];
  else map[key] = resolved;
  writeRecord(K_REACTIONS, map);
  return resolved;
}

// --- 즐겨찾기 ---
export function readFavorites(): number[] {
  try {
    const raw = localStorage.getItem(K_FAVORITES);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed.filter((v): v is number => typeof v === "number") : [];
  } catch {
    return [];
  }
}

export function isFavorite(spotId: number): boolean {
  return readFavorites().includes(spotId);
}

/** 토글해서 새 상태(true=즐겨찾기됨) 반환 */
export function toggleFavorite(spotId: number): boolean {
  const list = readFavorites();
  const has = list.includes(spotId);
  const next = has ? list.filter((v) => v !== spotId) : [...list, spotId];
  try {
    localStorage.setItem(K_FAVORITES, JSON.stringify(next));
  } catch {
    // 무시
  }
  return !has;
}

// --- 조회수 ---
export function recordView(spotId: number): void {
  const map = readRecord<number>(K_VIEWS);
  const key = String(spotId);
  map[key] = (map[key] ?? 0) + 1;
  writeRecord(K_VIEWS, map);
}

export function readViews(): Record<string, number> {
  return readRecord<number>(K_VIEWS);
}

// --- 집계 ---
export type Affinity = { cat2: Record<string, number>; group: Record<string, number> };

function groupOf(cat2: string | null): string | null {
  // TourAPI cat2 앞 2글자 = 대분류(NA/HS/LS/EX/VE/AC)
  return cat2 ? cat2.slice(0, 2) : null;
}

/** 원자료 신호를 카테고리 가산점으로 환산. scheduledSpotIds = 현재 시안들에 담긴 스팟. */
export function computeAffinity(spots: Spot[], scheduledSpotIds: Set<number>): Affinity {
  const byId = new Map(spots.map((s) => [s.spot_id, s]));
  const cat2: Record<string, number> = {};
  const group: Record<string, number> = {};
  const add = (spotId: number, weight: number) => {
    const spot = byId.get(spotId);
    if (!spot?.cat2) return;
    cat2[spot.cat2] = (cat2[spot.cat2] ?? 0) + weight;
    const g = groupOf(spot.cat2);
    if (g) group[g] = (group[g] ?? 0) + weight;
  };

  for (const [key, count] of Object.entries(readViews())) add(Number(key), count * W_VIEW);
  for (const id of scheduledSpotIds) add(id, W_SCHEDULE);
  for (const id of readFavorites()) add(id, W_FAVORITE);
  for (const [key, r] of Object.entries(readReactions())) {
    add(Number(key), r === "like" ? W_LIKE : W_DISLIKE);
  }
  return { cat2, group };
}

/** 스팟의 취향 점수 (블렌드). 신호가 하나도 없으면 0. */
export function scoreSpot(spot: Spot, affinity: Affinity): number {
  if (!spot.cat2) return 0;
  const g = groupOf(spot.cat2);
  return (affinity.cat2[spot.cat2] ?? 0) + GROUP_FACTOR * (g ? (affinity.group[g] ?? 0) : 0);
}

/** 취향 신호가 하나라도 있는지 (콜드스타트 판정) */
export function hasAnySignal(): boolean {
  return (
    Object.keys(readViews()).length > 0 ||
    readFavorites().length > 0 ||
    Object.keys(readReactions()).length > 0
  );
}
