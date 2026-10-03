// src/gaia/eval/reachCost.ts
//
// Map 評価の集計「開始地点＋到達しやすさ」（2026-09-29 提案 → 2026-10-03 ユーザー確定）。
//
// 色（種族）の評価値は、惑星ごとの値の単純合計ではなく
//   開始地点の惑星の値 ＋ Σ 残りの同色惑星の値 × 到達係数
// にする。標準種族は初期鉱山2つ、LF4種族は建物1つ（LF ルール p7）なので開始地点は 2 / 1 ヶ所。
// 開始地点は「残りの到達加重まで含めた合計が最大になる組」を総当たりで選ぶ。
//
// 到達コスト ＝ 開始地点から目的の惑星まで、惑星を踏み台にして進む経路の最小コスト。
//   跳躍: 距離1=0 / 2=1（航法1で届く通常の範囲）/ 3=1.5（初期状態から QIC 1つ）/
//         4=2（航法1＋QIC か QIC 2つ）/ 5=3（+3射程のブースター・船アクション）/ それ以上は不可
//   入植: 到着した惑星ごとに、その惑星を入植するのに要る改造の歩数を払う。
//         同色0、改造の輪で隣1・2つ先2・反対3、ガイア1、次元横断1、原始3、小惑星2。
//         LF4種族に母星種別は無く、他の原始惑星は3歩・小惑星はガイアフォーマー消費（2歩相当）。
//         標準惑星は種族で違う（ダルカニア人1 / スペースジャイアント2 / ティンカーロイドと
//         モウェイド人は相手次第で1か3 → Map 探索では相手が不明なので既定1）。
//   複数の踏み台は単純な和（補正なし。踏み台2つ以上の経路は 3〜6% しか無い）。
// 到達係数 ＝ 0.5 の（コスト − 1）乗。コスト1 ＝ 通常の到達範囲 ＝ 割引なし、以降1段ごとに半減。
//
// 実測と経緯は docs/design-notes.md 2.6 節、調査は scripts/_probe_map_aggregation.ts。

import { axialDistance } from "../hex";

export type PlanetNode = {
  key: string;
  q: number;
  r: number;
  /** 基本7色（BLUE…）か GAIA / TRANSDIM / PROTO / ASTEROID */
  kind: string;
};

/** 改造の輪（隣が1歩）。テラ→酸化→火山→砂漠→沼沢→チタン→氷→テラ（2026-10-02 ユーザー確定） */
export const TERRAFORM_WHEEL: readonly string[] = ["BLUE", "RED", "ORANGE", "YELLOW", "BROWN", "BLACK", "WHITE"];

/** 2色の改造の歩数（0〜3）。輪に無い種別は 3。 */
export function terraformSteps(a: string, b: string): number {
  const i = TERRAFORM_WHEEL.indexOf(a);
  const j = TERRAFORM_WHEEL.indexOf(b);
  if (i < 0 || j < 0) return 3;
  const d = Math.abs(i - j);
  return Math.min(d, TERRAFORM_WHEEL.length - d);
}

/** 跳躍コスト（添字＝距離）。距離6以上は不可。 */
export const HOP_COST_BY_DISTANCE: readonly number[] = [0, 0, 1, 1.5, 2, 3];

export function hopCost(distance: number): number {
  if (distance <= 0) return 0;
  return distance < HOP_COST_BY_DISTANCE.length ? HOP_COST_BY_DISTANCE[distance] : Infinity;
}

/** 到達係数の減衰（1段ごとに半減）と、割引の始まるコスト（1＝通常の到達範囲）。 */
export const REACH_DECAY = 0.5;
export const REACH_FREE_COST = 1;

export function reachFactor(cost: number): number {
  if (!Number.isFinite(cost)) return 0;
  return Math.pow(REACH_DECAY, Math.max(0, cost - REACH_FREE_COST));
}

export const STONE_COST_GAIA = 1;
export const STONE_COST_TRANSDIM = 1;
export const STONE_COST_PROTO = 3;
export const STONE_COST_ASTEROID = 2;

const BASIC_COLORS: ReadonlySet<string> = new Set(TERRAFORM_WHEEL);

/** 惑星種別 → その惑星に入植するのに要る改造の歩数 */
export type StoneCostFn = (kind: string) => number;

/** 基本色 color の種族の視点 */
export function stoneCostForColor(color: string): StoneCostFn {
  return (kind) => {
    if (kind === color) return 0;
    if (BASIC_COLORS.has(kind)) return terraformSteps(kind, color);
    if (kind === "GAIA") return STONE_COST_GAIA;
    if (kind === "TRANSDIM") return STONE_COST_TRANSDIM;
    if (kind === "PROTO") return STONE_COST_PROTO;
    if (kind === "ASTEROID") return STONE_COST_ASTEROID;
    return 3;
  };
}

export type LfFactionId = "moweyds" | "spaceGiants" | "tinkerroids" | "darkanians";
export const LF_FACTION_ORDER: readonly LfFactionId[] = ["moweyds", "spaceGiants", "tinkerroids", "darkanians"];

export type LfReachProfile = {
  /** 開始惑星の種別 */
  home: "PROTO" | "ASTEROID";
  /** 標準惑星（基本7色）の改造の歩数 */
  standard: number;
  /** ガイア惑星・次元横断惑星の歩数相当（QIC 2 の種族は 2） */
  gaia: number;
};

/** LF4種族の入植コスト（LF ルール p13。ティンカーロイド・モウェイド人の標準惑星は相手次第なので既定1） */
export const LF_REACH_PROFILES: Record<LfFactionId, LfReachProfile> = {
  moweyds: { home: "PROTO", standard: 1, gaia: 1 },
  spaceGiants: { home: "PROTO", standard: 2, gaia: 2 },
  tinkerroids: { home: "ASTEROID", standard: 1, gaia: 2 },
  darkanians: { home: "ASTEROID", standard: 1, gaia: 2 },
};

/** LF4種族の視点。母星種別は無いので、同じ種別の惑星にも原始3・小惑星2を払う。 */
export function stoneCostForLfFaction(id: LfFactionId): StoneCostFn {
  const p = LF_REACH_PROFILES[id];
  return (kind) => {
    if (BASIC_COLORS.has(kind)) return p.standard;
    if (kind === "GAIA" || kind === "TRANSDIM") return p.gaia;
    if (kind === "PROTO") return STONE_COST_PROTO;
    if (kind === "ASTEROID") return STONE_COST_ASTEROID;
    return 3;
  };
}

/** 開始地点の数。標準種族は初期鉱山2つ、LF4種族は建物1つ。 */
export const START_COUNT_STANDARD = 2;
export const START_COUNT_LF = 1;

/**
 * 起点 src から全ノードへの最小到達コスト（Dijkstra。ノード数は数十なので O(n^2)）。
 * 到着した惑星ごとに入植コストを払う（起点は払わない）。到達不能は Infinity。
 */
export function reachCostsFrom(nodes: readonly PlanetNode[], src: number, stoneCost: StoneCostFn): number[] {
  const n = nodes.length;
  const dist = new Array<number>(n).fill(Infinity);
  const done = new Array<boolean>(n).fill(false);
  if (src < 0 || src >= n) return dist;
  dist[src] = 0;
  for (let it = 0; it < n; it++) {
    let u = -1;
    for (let i = 0; i < n; i++) if (!done[i] && (u < 0 || dist[i] < dist[u])) u = i;
    if (u < 0 || dist[u] === Infinity) break;
    done[u] = true;
    const a = nodes[u];
    for (let w = 0; w < n; w++) {
      if (done[w]) continue;
      const b = nodes[w];
      const h = hopCost(axialDistance(a.q, a.r, b.q, b.r));
      if (h === Infinity) continue;
      const nd = dist[u] + h + stoneCost(b.kind);
      if (nd < dist[w]) dist[w] = nd;
    }
  }
  return dist;
}

export type StartCandidate = { key: string; value: number };

export type StartPlan = {
  /** 開始地点のセル座標（値の降順ではなく座標順） */
  starts: string[];
  /** 候補ごとの重み。開始地点は 1、残りは到達係数（到達不能は 0） */
  weights: Map<string, number>;
  /** 候補ごとの到達コスト。開始地点は 0 */
  costs: Map<string, number>;
  /** Σ 値 × 重み（丸め前） */
  total: number;
};

/**
 * 開始地点を総当たりで選び、残りの重みを決める。
 * candidates は同色（同種別）の惑星。nodes は踏み台に使える全惑星（candidates を含む）。
 */
export function planStarts(args: {
  nodes: readonly PlanetNode[];
  candidates: readonly StartCandidate[];
  stoneCost: StoneCostFn;
  startCount: number;
}): StartPlan | null {
  const { nodes, candidates, stoneCost } = args;
  if (candidates.length === 0) return null;
  const index = new Map<string, number>();
  nodes.forEach((n, i) => index.set(n.key, i));
  const costFrom = new Map<string, number[]>();
  for (const c of candidates) {
    const i = index.get(c.key);
    costFrom.set(c.key, i == null ? [] : reachCostsFrom(nodes, i, stoneCost));
  }
  const costOf = (from: StartCandidate, to: StartCandidate): number => {
    const i = index.get(to.key);
    const row = costFrom.get(from.key);
    return i == null || !row || row.length === 0 ? Infinity : row[i];
  };

  const k = Math.max(1, Math.min(args.startCount, candidates.length));
  const sorted = candidates.slice().sort((a, b) => a.key.localeCompare(b.key));
  let best: StartPlan | null = null;
  const consider = (starts: StartCandidate[]) => {
    const weights = new Map<string, number>();
    const costs = new Map<string, number>();
    let total = 0;
    for (const s of starts) {
      weights.set(s.key, 1);
      costs.set(s.key, 0);
      total += s.value;
    }
    for (const c of sorted) {
      if (weights.has(c.key)) continue;
      let cost = Infinity;
      for (const s of starts) cost = Math.min(cost, costOf(s, c));
      const w = reachFactor(cost);
      weights.set(c.key, w);
      costs.set(c.key, cost);
      total += c.value * w;
    }
    // 同点は座標順で先に出た組を残す（決定的にする）
    if (!best || total > best.total + 1e-9) {
      best = { starts: starts.map((s) => s.key), weights, costs, total };
    }
  };
  if (k === 1) {
    for (const a of sorted) consider([a]);
  } else {
    for (let i = 0; i < sorted.length; i++) {
      for (let j = i + 1; j < sorted.length; j++) consider([sorted[i], sorted[j]]);
    }
  }
  return best;
}
