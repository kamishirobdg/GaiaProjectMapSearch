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
//   跳躍: 距離1=0 / 2=1（航行 Lv2 ＝ 研究2歩で届く通常の範囲）/ 3=1.5（初期状態から QIC 1つ）/
//         4=2（航行 Lv2＋QIC か QIC 2つ）/ 5=3（+3射程のブースター・船アクション）/ それ以上は不可
//   入植: 到着した惑星ごとに、その惑星を入植するのに要る改造の歩数を払う。
//         同色0、改造の輪で隣1・2つ先2・反対3、ガイア1、次元横断2（ガイア Lv1 開始は 1、イタル人 1.5）、
//         原始3、小惑星2。次元横断は 2026-10-06（eval_v6）に 1 → 2: それまでの 1 はガイア種族の
//         視点の値で、通常種族はガイアフォーマーを得る研究1歩が要る（ユーザー指摘、2-1 案A）。
//         LF4種族に母星種別は無く、他の原始惑星は3歩・小惑星はガイアフォーマー消費（2歩相当）。
//         標準惑星は種族で違う（ダルカニア人1 / スペースジャイアント2 / ティンカーロイドと
//         モウェイド人は相手次第で1か3 → Map 探索では相手が不明なので既定1）。
//   複数の踏み台は単純な和（補正なし。踏み台2つ以上の経路は 3〜6% しか無い）。
// 到達係数 ＝ 0.5 の（コスト − 1）乗。コスト1 ＝ 通常の到達範囲 ＝ 割引なし、以降1段ごとに半減。
//
// 盤面の端の罰点「欠けマス × w」（2026-10-04 ユーザー確定、eval_v4）:
//   惑星から距離2以内の18マス（通常の到達範囲）のうち盤面に無いマスの数 × w を、その惑星の値から引く。
//   端の開始地点は、将来の広がり先（鉱山を置く惑星・同盟の衛星・パワーの授受）をそのぶん失う、という意図。
//   内側の惑星は欠け0、外周（最外周の1つ内側）は平均 2.7 マス、最外周は辺で約7・角で約10。
//   加算で下限は無い。基本版と LF で同じ式、原始・小惑星にも掛ける。
//
// 種族ごとの計算（2026-10-05 ユーザー確定、eval_v5。docs/design-notes.md 2.7）:
//   色ではなく種族ごとに開始地点と到達加重を計算する。基本14種族は上の色の定数を基準に、
//   種族の性質で違うところだけを変える（BASIC_REACH_PROFILES）:
//     開始建物の数: ゼノ族 3 / ダー・シュワーム人 1（惑星首府）/ 他 2
//     航行 Lv1 開始（グリーン人・アンバス人）: 距離2の跳躍 1 → 0.5（距離2には航行 Lv2 が要る。
//       残り1歩で届く。他の種族は2歩。2026-10-06 に前提を確認）
//     航行を伸ばせない（バルタック人、首府まで Lv0）: 距離2の跳躍 1 → 1.5（QIC 1つの距離3と同じ）
//     改造 Lv1 開始（ジオデン人）: 改造の歩数 × 2/3（鉱石 3 → 2 の比）
//     ガイア Lv1 開始（地球人・バルタック人・モウェイド人）: 次元横断 2 → 1（ガイアフォーマーを
//       最初から持つ。他は研究1歩が要るので 2。ガイア惑星は誰でも QIC 1つなので 1 のまま）
//     イタル人（初期研究なし。ガイア域に捨てたパワートークンが技術タイルになり次元横断と相性が良い）:
//       次元横断 1.5（通常 2 とガイア Lv1 の 1 の中間。2026-10-06 ユーザー確定、案 B-2）
//     ガイア惑星に鉱石で入植（グリーン人）: ガイア惑星 1 → 0.5（次元横断は 2 のまま）
//     ランティダ人の「他家の惑星に鉱山」、経済・科学・AI の初期研究は到達に無関係なので扱わない。
//     初期研究の一覧（2026-10-06 ユーザー確認）: 地球人 ガイア1 / ゼノ族 AI1 / グリーン人 航行1 /
//       アンバス人 航行1 / ハッシュ・ホラ人 経済1 / ジオデン人 改造1 / バルタック人 ガイア1 /
//       ネヴラ人 科学1 / ランティダ人・タクロン族・ダー・シュワーム人・フィラク族・マッドアンドロイド・
//       イタル人 なし / モウェイド人 ガイア1 / スペースジャイアント 航行1 / ティンカーロイド 科学1 /
//       ダルカニア人 経済1＋航行1。スペースジャイアント・ダルカニア人の航行 Lv1 も基本種族と同じく
//       距離2の跳躍 0.5（LF_REACH_PROFILES.hop2。2026-10-06 ユーザー確定）。
//   検索の偏り項と色優遇は、色の代表値（その色の2種族のうち大きい方）で従来どおり7色で測る（案A）。
//
// 実測と経緯は docs/design-notes.md 2.6 / 2.7 / 2.8 節、調査は scripts/_probe_map_aggregation.ts と
// scripts/_probe_rim.ts。

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
/** 次元横断（通常種族の視点。ガイアフォーマーを得る研究1歩 ＋ ガイア計画）。2026-10-06 に 1 → 2（eval_v6） */
export const STONE_COST_TRANSDIM = 2;
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
  /** ガイア惑星の歩数相当（QIC 2 の種族は 2） */
  gaia: number;
  /** 次元横断惑星の歩数相当。ガイア Lv1 開始のモウェイド人は 1（2026-10-06。それまで 0.5）、他は 2 */
  transdim: number;
  /** 距離2の跳躍コスト（既定 1。航行 Lv1 開始のスペースジャイアント・ダルカニア人は 0.5。2026-10-06 ユーザー確定） */
  hop2?: number;
};

/** LF4種族の入植コスト（LF ルール p13。ティンカーロイド・モウェイド人の標準惑星は相手次第なので既定1） */
export const LF_REACH_PROFILES: Record<LfFactionId, LfReachProfile> = {
  moweyds: { home: "PROTO", standard: 1, gaia: 1, transdim: 1 },
  spaceGiants: { home: "PROTO", standard: 2, gaia: 2, transdim: 2, hop2: 0.5 },
  tinkerroids: { home: "ASTEROID", standard: 1, gaia: 2, transdim: 2 },
  darkanians: { home: "ASTEROID", standard: 1, gaia: 2, transdim: 2, hop2: 0.5 },
};

/** LF4種族の跳躍コスト関数（距離2だけ種族で変わる。基本種族の hopCostForBasicFaction と同じ形） */
export function hopCostForLfFaction(id: LfFactionId): HopCostFn {
  const h2 = LF_REACH_PROFILES[id].hop2;
  if (h2 == null) return hopCost;
  return (d) => (d === 2 ? h2 : hopCost(d));
}

// eval_v6 の「入植先の係数」DESTINATION_VALUE_SCALE（ガイア 0.5 / 次元横断 0.25。意味は「盤面全体への影響度」、
// 経緯と取り違えの記録は docs/design-notes.md 2.7）は、eval_v7 で下の UNIFIED_VALUE.GAIA / TRANSDIM に統合した。

// ===== 全惑星を同一の式で評価する一本化（2026-10-07 ユーザー確定、eval_v7。docs/design-notes.md 2.10）=====
//
// 種族 f の値 ＝ Σ_{盤面の全惑星 p} 係数_f(種別(p)) × (固有値 ＋ 状況の値(p)) × 到達係数_f(開始地点 → p)
//   固有値    惑星が 1 つあること自体の値（種別によらず一定）。基本版（船なし）ではこれが本体
//   状況の値  船接触 ＋ 船星系 ＋ 端の罰点（惑星ごと。ガイア近接と星系の軸は廃止）
//   係数      母星色 1 / 他色 / ガイア / 次元横断 / 原始・小惑星。種族の型（ガイア種族・改造種族）で変える
//   到達係数  上の reachFactor（コスト ＝ 跳躍 ＋ 到着した惑星の入植コスト）
//   開始地点  母星色（LF は母星種別）の惑星から、合計が最大になる k 個（planStarts の startKeys）
//
// 値は **すべて実測で合わせた暫定値（調整必須のマジックナンバー）**。変えるときはユーザー判断で、
// `scripts/_probe_map_values.ts`（環境変数で差し替え可）で寄与の割合と同色2種族の差を測り直し、
// `EVAL_VERSION` を上げて設計ノート 2.10 に実測を追記する。`reachCost.test.ts` が値を固定している。

/** 入植先の種別（係数の引き当て用）。own は母星色（LF は母星種別）、extra は原始・小惑星（LF どうしの他方の種別も） */
export type DestinationKind = "own" | "other" | "gaia" | "transdim" | "extra";
export const DESTINATION_KINDS: readonly DestinationKind[] = ["own", "other", "gaia", "transdim", "extra"];

/**
 * 一本化の定数（2026-10-07 ユーザー確定）。意味と調整の観点は設計ノート 2.10 の表。
 *   BASE 固有値 10（船接触 10 と同じ桁。端の罰点（角 −5）との比で基本版の中心性が決まる）
 *   OWN 母星色 1（基準。変えない）
 *   OTHER 他色 0.25（改造して入植する惑星の取り分。改造の歩数は到達コストで別に効く。0.5 だと他色の寄与が母星色を超える）
 *   GAIA 0.5 / TRANSDIM 0.25（eval_v6 の入植先の係数「盤面全体への影響度」から引き継ぎ）
 *   GAIA_FACTION_TRANSDIM 0.5（ガイア種族は次元横断を上げる）
 *   EXTRA 0.1（基本種族にとっての原始・小惑星。LF どうしの他方の種別も同じ）
 *   TERRA_BOOST 1.2（改造種族の他色の倍率。1.5 だとジオデン人が突出する）
 * 調査スクリプトが環境変数で差し替えるので const にはしていない（実行時に書き換えてよいのは調査だけ）。
 */
export const UNIFIED_VALUE: Record<"BASE" | "OWN" | "OTHER" | "GAIA" | "TRANSDIM" | "GAIA_FACTION_TRANSDIM" | "EXTRA" | "TERRA_BOOST", number> = {
  BASE: 10,
  OWN: 1,
  OTHER: 0.25,
  GAIA: 0.5,
  TRANSDIM: 0.25,
  GAIA_FACTION_TRANSDIM: 0.5,
  EXTRA: 0.1,
  TERRA_BOOST: 1.2,
};

/** ガイア種族（次元横断の係数を GAIA_FACTION_TRANSDIM に）。ガイア Lv1 開始の3種族 ＋ イタル人（B-2。2026-10-06 ユーザー確認） */
export const GAIA_FACTIONS: ReadonlySet<string> = new Set(["terrans", "balTaks", "itars", "moweyds"]);
/**
 * 改造種族（他色の係数 × TERRA_BOOST）。**暫定の分類**（2026-10-07、私の案）: 改造・パワーが主の種族として
 * ジオデン人（改造 Lv1 開始）・タクロン族（パワーの輪）・ネヴラ人（パワー変換）。本実装後の実測でユーザーが決め直す。
 */
export const TERRAFORM_FACTIONS: ReadonlySet<string> = new Set(["geodens", "taklons", "nevlas"]);

/** 惑星の種別 → 入植先の種別。home は母星色（基本7色）か PROTO / ASTEROID。 */
export function destinationKind(kind: string, home: string): DestinationKind {
  if (kind === home) return "own";
  if (BASIC_COLORS.has(kind)) return "other";
  if (kind === "GAIA") return "gaia";
  if (kind === "TRANSDIM") return "transdim";
  return "extra";
}

/** 種族 factionId から見た、種別 kind の惑星に掛ける係数（一本化の式の「係数」）。 */
export function destinationCoef(factionId: string, kind: string, home: string): number {
  const d = destinationKind(kind, home);
  if (d === "own") return UNIFIED_VALUE.OWN;
  if (d === "other") return UNIFIED_VALUE.OTHER * (TERRAFORM_FACTIONS.has(factionId) ? UNIFIED_VALUE.TERRA_BOOST : 1);
  if (d === "gaia") return UNIFIED_VALUE.GAIA;
  if (d === "transdim") return GAIA_FACTIONS.has(factionId) ? UNIFIED_VALUE.GAIA_FACTION_TRANSDIM : UNIFIED_VALUE.TRANSDIM;
  return UNIFIED_VALUE.EXTRA;
}

/** LF4種族の視点。母星種別は無いので、同じ種別の惑星にも原始3・小惑星2を払う。 */
export function stoneCostForLfFaction(id: LfFactionId): StoneCostFn {
  const p = LF_REACH_PROFILES[id];
  return (kind) => {
    if (BASIC_COLORS.has(kind)) return p.standard;
    if (kind === "GAIA") return p.gaia;
    if (kind === "TRANSDIM") return p.transdim;
    if (kind === "PROTO") return STONE_COST_PROTO;
    if (kind === "ASTEROID") return STONE_COST_ASTEROID;
    return 3;
  };
}

// ===== 基本14種族（2026-10-05 ユーザー確定）=====

export type BasicFactionId =
  | "terrans"
  | "lantids"
  | "xenos"
  | "gleens"
  | "taklons"
  | "ambas"
  | "hadschHallas"
  | "ivits"
  | "geodens"
  | "balTaks"
  | "firaks"
  | "bescods"
  | "nevlas"
  | "itars";

export type BasicReachProfile = {
  /** 母星色（基本7色） */
  color: string;
  /** 開始建物の数（鉱山2。ゼノ族は鉱山3、ダー・シュワーム人は惑星首府1） */
  startCount: number;
  /** 距離2の跳躍コスト（既定 1。航行 Lv1 開始は 0.5、航行を伸ばせないバルタック人は 1.5） */
  hop2?: number;
  /** 改造の歩数に掛ける係数（既定 1。改造 Lv1 開始のジオデン人は 2/3） */
  terraformScale?: number;
  /** ガイア惑星の入植コスト（既定 1。鉱石で入植するグリーン人は 0.5） */
  gaia?: number;
  /** 次元横断惑星の入植コスト（既定 2。ガイア Lv1 開始の地球人・バルタック人は 1、イタル人は 1.5） */
  transdim?: number;
  /**
   * 開始地点の値に掛ける倍率（既定 1）。ダー・シュワーム人 1.5: 開始建物が惑星首府で、全体の最後に
   * 入植地を選べることを「首府 1 つ ＝ 鉱山 1.5 個ぶん」と見る（2026-10-08 ユーザー確定 案 (A)。
   * 調整必須のマジックナンバー）。開始地点の選び方にも効く（値の高い 1 ヶ所をより強く選ぶ）。
   */
  startValueScale?: number;
};

export const BASIC_FACTION_ORDER: readonly BasicFactionId[] = [
  "terrans", "lantids", "xenos", "gleens", "taklons", "ambas", "hadschHallas",
  "ivits", "geodens", "balTaks", "firaks", "bescods", "nevlas", "itars",
];

export const BASIC_REACH_PROFILES: Record<BasicFactionId, BasicReachProfile> = {
  terrans: { color: "BLUE", startCount: 2, transdim: 1 },
  lantids: { color: "BLUE", startCount: 2 },
  xenos: { color: "YELLOW", startCount: 3 },
  gleens: { color: "YELLOW", startCount: 2, hop2: 0.5, gaia: 0.5 },
  taklons: { color: "BROWN", startCount: 2 },
  ambas: { color: "BROWN", startCount: 2, hop2: 0.5 },
  hadschHallas: { color: "RED", startCount: 2 },
  // 開始建物が惑星首府 1 つ。首府であること・全体の最後に入植地を選べることを、開始地点の値 × 1.5 で評価
  // （2026-10-08 ユーザー確定 案 (A)。倍率は調整必須のマジックナンバー。docs/design-notes.md 2.10）
  ivits: { color: "RED", startCount: 1, startValueScale: 1.5 },
  geodens: { color: "ORANGE", startCount: 2, terraformScale: 2 / 3 },
  balTaks: { color: "ORANGE", startCount: 2, hop2: 1.5, transdim: 1 },
  firaks: { color: "BLACK", startCount: 2 },
  bescods: { color: "BLACK", startCount: 2 },
  nevlas: { color: "WHITE", startCount: 2 },
  // 初期研究なしだが次元横断と相性が良い（ガイア域のパワートークン → 技術タイル）。中間の 1.5（案 B-2）
  itars: { color: "WHITE", startCount: 2, transdim: 1.5 },
};

/** 跳躍コスト関数（距離 → コスト）。種族ごとに距離2だけ変わる。 */
export type HopCostFn = (distance: number) => number;

export function hopCostForBasicFaction(id: BasicFactionId): HopCostFn {
  const h2 = BASIC_REACH_PROFILES[id].hop2;
  if (h2 == null) return hopCost;
  return (d) => (d === 2 ? h2 : hopCost(d));
}

/** 基本14種族の視点。色の定数を基準に、改造の係数・ガイア・次元横断だけが種族で変わる。 */
export function stoneCostForBasicFaction(id: BasicFactionId): StoneCostFn {
  const p = BASIC_REACH_PROFILES[id];
  const scale = p.terraformScale ?? 1;
  const gaia = p.gaia ?? STONE_COST_GAIA;
  const transdim = p.transdim ?? STONE_COST_TRANSDIM;
  return (kind) => {
    if (kind === p.color) return 0;
    if (BASIC_COLORS.has(kind)) return terraformSteps(kind, p.color) * scale;
    if (kind === "GAIA") return gaia;
    if (kind === "TRANSDIM") return transdim;
    if (kind === "PROTO") return STONE_COST_PROTO;
    if (kind === "ASTEROID") return STONE_COST_ASTEROID;
    return 3;
  };
}

/** 端の罰点の範囲（通常の到達範囲＝距離2）と、その範囲にあるマスの数（自分を除く 6 + 12 = 18）。 */
export const RIM_GAP_RANGE = 2;
export const RIM_GAP_RING_CELLS = 18;

/**
 * (q, r) から距離 range 以内（自分を除く）のうち、盤面に無いマスの数。
 * onBoard は盤面の全セル（空セルも含む）の座標キー "q,r" の集合。
 */
export function missingCellsWithin(onBoard: ReadonlySet<string>, q: number, r: number, range = RIM_GAP_RANGE): number {
  let missing = 0;
  for (let dq = -range; dq <= range; dq++) {
    for (let dr = -range; dr <= range; dr++) {
      if (dq === 0 && dr === 0) continue;
      if (axialDistance(0, 0, dq, dr) > range) continue;
      if (!onBoard.has(`${q + dq},${r + dr}`)) missing++;
    }
  }
  return missing;
}

/** 開始地点の数。標準種族は初期鉱山2つ（ゼノ族3・ダー・シュワーム人1は BASIC_REACH_PROFILES）、LF4種族は建物1つ。 */
export const START_COUNT_STANDARD = 2;
export const START_COUNT_LF = 1;

/**
 * 起点 src から全ノードへの最小到達コスト（Dijkstra。ノード数は数十なので O(n^2)）。
 * 到着した惑星ごとに入植コストを払う（起点は払わない）。到達不能は Infinity。
 * hop は跳躍コスト関数（既定は色の表。種族ごとの表は hopCostForBasicFaction）。
 */
export function reachCostsFrom(
  nodes: readonly PlanetNode[],
  src: number,
  stoneCost: StoneCostFn,
  hop: HopCostFn = hopCost
): number[] {
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
      const h = hop(axialDistance(a.q, a.r, b.q, b.r));
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
  /** 候補ごとの重み。開始地点は 1（startValueScale があればその値）、残りは到達係数（到達不能は 0） */
  weights: Map<string, number>;
  /** 候補ごとの到達コスト。開始地点は 0 */
  costs: Map<string, number>;
  /** Σ 値 × 重み（丸め前） */
  total: number;
};

/**
 * 開始地点を総当たりで選び、残りの重みを決める。
 * candidates は入植先の惑星（同色（同種別）の惑星。eval_v6 からはガイア・次元横断も）。
 * nodes は踏み台に使える全惑星（candidates を含む）。
 * startKeys を渡すと開始地点はその中（母星色の惑星）からだけ選ぶ（eval_v6。省略時は candidates 全部）。
 */
export function planStarts(args: {
  nodes: readonly PlanetNode[];
  candidates: readonly StartCandidate[];
  stoneCost: StoneCostFn;
  startCount: number;
  /** 跳躍コスト関数（省略時は色の表） */
  hopCost?: HopCostFn;
  /** 開始地点に使える候補のキー（省略時は candidates 全部） */
  startKeys?: ReadonlySet<string>;
  /** 開始地点の値に掛ける倍率（省略時 1。ダー・シュワーム人 1.5。開始地点の重みにそのまま入る） */
  startValueScale?: number;
}): StartPlan | null {
  const { nodes, candidates, stoneCost } = args;
  const hop = args.hopCost ?? hopCost;
  const startScale = args.startValueScale != null && args.startValueScale > 0 ? args.startValueScale : 1;
  const startable = args.startKeys ? candidates.filter((c) => args.startKeys!.has(c.key)) : candidates;
  if (candidates.length === 0 || startable.length === 0) return null;
  const index = new Map<string, number>();
  nodes.forEach((n, i) => index.set(n.key, i));
  const costFrom = new Map<string, number[]>();
  for (const c of startable) {
    const i = index.get(c.key);
    costFrom.set(c.key, i == null ? [] : reachCostsFrom(nodes, i, stoneCost, hop));
  }
  const costOf = (from: StartCandidate, to: StartCandidate): number => {
    const i = index.get(to.key);
    const row = costFrom.get(from.key);
    return i == null || !row || row.length === 0 ? Infinity : row[i];
  };

  const k = Math.max(1, Math.min(args.startCount, startable.length));
  const sorted = candidates.slice().sort((a, b) => a.key.localeCompare(b.key));
  const sortedStartable = startable.slice().sort((a, b) => a.key.localeCompare(b.key));
  let best: StartPlan | null = null;
  const consider = (starts: StartCandidate[]) => {
    const weights = new Map<string, number>();
    const costs = new Map<string, number>();
    let total = 0;
    for (const s of starts) {
      weights.set(s.key, startScale);
      costs.set(s.key, 0);
      total += s.value * startScale;
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
  // k 個の組み合わせを座標順で総当たり（k=1 は単体、2 は対、3 はゼノ族の鉱山3つ）。開始地点は startable から
  const pick: StartCandidate[] = [];
  const walk = (from: number) => {
    if (pick.length === k) {
      consider(pick.slice());
      return;
    }
    for (let i = from; i <= sortedStartable.length - (k - pick.length); i++) {
      pick.push(sortedStartable[i]);
      walk(i + 1);
      pick.pop();
    }
  };
  walk(0);
  return best;
}
