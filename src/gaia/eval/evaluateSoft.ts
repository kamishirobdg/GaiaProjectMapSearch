// src/gaia/eval/evaluateSoft.ts
//
// SSOT (soft):
// - 惑星ごとに outer/touch/scout/scoutCore の値（状況の値）を持ち（perPlanet）、
//   種族ごとの値は「全惑星を同一の式で」足す（reachCost.ts、2026-10-07、eval_v7。docs/design-notes.md 2.10）:
//     種族の値 ＝ Σ_{全惑星} 係数(種別) × (固有値 ＋ 状況の値) × 到達係数(開始地点 → 惑星)
//   開始地点は母星色（LF は母星種別）から k 個を総当たり。係数と固有値は reachCost.ts の UNIFIED_VALUE。
// - outer/touch は端の罰点「欠けマス × wRimGap」（2026-10-04、eval_v4）
// - ガイア近接・星系の軸は eval_v7 で廃止（ガイア近接 5 / 8 / 3 の「距離 2 最大」は 2026-07-30 の
//   割合合わせの副産物で価値判断ではなかった。星系は到達コスト 0 の隣接で既に報われる）
// - planetTypeTotals = 色の代表種族の値（種別ごとの列 母星色 + 他色 + ガイア + 次元横断 + 原始・小惑星）
// - map score は planetTypeTotals の乖離（imbalance）のみ
//
// ScoutCore (確定仕様):
// - Scout惑星 = Scout評価で value>=1 を持った惑星（=Scout半径内でヒット）
// - ScoutCore惑星 = Scout惑星から距離1 or 2 に存在する惑星（自己除外）
// - d=1 => wScoutCore, d=2 => wScoutCore-1
// - 同一ScoutCore惑星に複数Scout惑星がある場合は合算
// - ScoutセルはScoutCoreに関与しない（Scout惑星集合のみが起点）
//
import type { AxialKey, ExtractedForEval, PlanetKind } from "./extractForEval";
import { axialDistance } from "../hex";
import {
  BASIC_FACTION_ORDER,
  BASIC_REACH_PROFILES,
  DESTINATION_KINDS,
  GAIA_FACTIONS,
  HOP_COST_BY_DISTANCE,
  LF_FACTION_ORDER,
  LF_REACH_PROFILES,
  REACH_DECAY,
  REACH_FREE_COST,
  RIM_GAP_RANGE,
  RIM_GAP_RING_CELLS,
  START_COUNT_LF,
  TERRAFORM_FACTIONS,
  UNIFIED_VALUE,
  destinationCoef,
  destinationKind,
  hopCostForBasicFaction,
  hopCostForLfFaction,
  missingCellsWithin,
  planStarts,
  stoneCostForBasicFaction,
  stoneCostForLfFaction,
  type DestinationKind,
  type PlanetNode,
} from "./reachCost";

export type PlanetType =
  | "BLACK"
  | "BLUE"
  | "BROWN"
  | "ORANGE"
  | "RED"
  | "WHITE"
  | "YELLOW";

export type AxisByType = Record<PlanetType, number>;
export type CountByType = Record<PlanetType, number>;

export type SoftParams = {
  /**
   * 端の罰点「欠けマス × w」（2026-10-04 ユーザー確定、eval_v4。docs/design-notes.md 2.8）。
   * 惑星から距離2以内の18マスのうち盤面に無いマス1つにつき w 点を引く。最外周セルの惑星は
   * 「最外周」の列、外周（最外周の1つ内側）セルの惑星は「外周」の列に入る。内側は欠け0。
   * 加算で下限は無く、原始・小惑星にも掛ける。0 / 省略 ＝ 罰点なし。
   */
  wRimGap?: number;
  /**
   * eval_v3 までの端の罰点（最外周の惑星1つにつき wOuter、外周は wTouch を引く）。
   * 入力欄は wRimGap に置き換えたので新しい検索キーには入らないが、指定があれば
   * 従来どおり wRimGap に加えて効く（古い調査スクリプトのため）。
   */
  wOuter?: number;
  wTouch?: number;

  wScout: number;
  scoutRadius: number;

  // Per-scout override (by scout cell key; e.g. twilight/eclipse/rebellion/tfmars (or legacy S1..S4)). If provided, the value REPLACES wScout for that scout.
  wScoutByScoutKey?: Record<string, number>;

  // ScoutCore weight (default=0 if omitted)
  wScoutCore?: number;

  // Per-scout override for ScoutCore (by scout cell key; e.g. twilight/eclipse/rebellion/tfmars (or legacy S1..S4)). If provided, the value REPLACES wScoutCore for that scout.
  wScoutCoreByScoutKey?: Record<string, number>;

  // How to attribute Scout planets to each Scout for ScoutCore input:
  // - "all"  : a planet can belong to multiple scouts (default; mode A)
  // - "best" : a planet belongs to the single scout with the largest scout contribution (mode B)
  scoutCoreAttributionMode?: "all" | "best";

  wImbalance: number;
  imbalanceMetric?: "std" | "range";

  // Color preference (optional): maximize/minimize planetTypeTotals by type
  // score += wColorPref * Σ(prefByType[type] * planetTypeTotals[type])
  wColorPref?: number;
  colorPrefByType?: Partial<Record<PlanetType, number>>;

  // eval_v6 までの基本版の軸「ガイア近接（wGaiaDist1〜3）」「星系（wClusterSize）」は eval_v7 で廃止した。
  // 検索キーにも入らない（新バケツなので互換の問題なし）。古い保存結果の表示は page.tsx が再評価する。
};


/** 種族の集計での、惑星1つぶんの記録（マーカーと説明用）。eval_v7 からは盤面の全惑星が載る。 */
export type StartAccessPlanet = {
  cellKey: string;
  /** 惑星の種別（基本7色 / GAIA / TRANSDIM / PROTO / ASTEROID）。eval_v6 から（それ以前の記録には無い） */
  kind?: string;
  /** その種族から見た入植先の種別（母星色 / 他色 / ガイア / 次元横断 / 原始・小惑星）。eval_v7 から */
  dest?: DestinationKind;
  /** 開始地点からの到達コスト（開始地点は 0、到達不能は Infinity） */
  cost: number;
  /** 値に掛けた重み（開始地点は 1、残りは到達係数。到達不能は 0） */
  weight: number;
  /** 重みを掛ける前の惑星の値 ＝ 係数 × (固有値 ＋ 状況の値)。eval_v6 までは状況の値（× 入植先の係数） */
  value: number;
  /** 掛けた係数（destinationCoef。1 のときは省略）。eval_v7 から */
  coef?: number;
  /** eval_v6 だけ: ガイア・次元横断の入植先の係数（DESTINATION_VALUE_SCALE）。古い保存結果の読み出し用 */
  scale?: number;
};

/** 種別ごとの値（内訳表の列。eval_v7） */
export type ValueByKind = Record<DestinationKind, number>;

/** 種族1つぶんの集計（eval_v5 から種族ごと、eval_v7 から全惑星を同一の式で） */
export type FactionStart = {
  /** 母星色（基本7色）か PROTO / ASTEROID */
  color: string;
  /** 開始地点のセル座標（ゼノ族 3・ダー・シュワーム人 1・LF4種族 1・他 2） */
  starts: string[];
  /**
   * 種別ごとの重み付き和（Σ 係数 × (固有値 ＋ 状況の値) × 到達係数）を種別ごとに丸めたもの。
   * total はその合計（内訳表の列の合計と評価が一致する）。eval_v7 から
   */
  byKind: ValueByKind;
  total: number;
  /**
   * 固有値と状況の値の内訳（丸める前。係数と到達係数込み）。base ＋ scout ＋ core ＋ outer ＋ touch が
   * 丸める前の total。eval_v6 までは scout/core/outer/touch が軸の列（丸めた値）で、gaia/cluster もあった。
   */
  base?: number;
  scout: number;
  core: number;
  outer: number;
  touch: number;
  /** 盤面の全惑星（eval_v7。eval_v6 までは同色（同種別）とガイア・次元横断）の到達コスト・重み・値 */
  planets: StartAccessPlanet[];
};

export type SoftBreakdown = {
  /**
   * 色ごとの種別別の値（代表種族の byKind。eval_v7）。planetTypeTotals はこの5つの和。
   * eval_v6 までは軸ごと（outer / touch / scout / scoutCore / gaia / cluster）だった。
   */
  axesByType: Record<DestinationKind, AxisByType>;

  planetTypeTotals: AxisByType;

  imbalance: {
    metric: "std" | "range";
    value: number;
    score: number;
  };

  colorPreference?: {
    wColorPref: number;
    prefByType: AxisByType;
    valueByType: AxisByType;
    scoreByType: AxisByType;
    score: number;
    /**
     * 原始・小惑星ぶんの優遇/冷遇（2026-07-31）。基本7色は planetTypeTotals を
     * 掛けるが、この2つは軸を持たないので extraBest（最良の1惑星×補正値）を掛ける。
     * 指定が無ければフィールドごと出さない（既存の監査データと同じ形を保つ）。
     */
    prefExtraByKind?: Record<string, number>;
    valueExtraByKind?: Record<string, number>;
    scoreExtraByKind?: Record<string, number>;
  };

  audit: {
    outerCountByType: CountByType;
    touchCountByType: CountByType;

    /**
     * 端の罰点「欠けマス × w」の記録（wRimGap が非0のときだけ。2026-10-04、eval_v4）。
     * missingByCell は欠けのある惑星だけ（内側の惑星は載らない＝0）。
     */
    rimGap?: {
      w: number;
      range: number;
      ringCells: number;
      missingByCell: Record<string, number>;
    };

    /** PROTO/ASTEROID 分（種別ごとの単純合算。表示のフォールバック用。値は重み適用後／Count は素の枚数） */
    outerExtraByKind?: Record<string, number>;
    touchExtraByKind?: Record<string, number>;
    outerCountExtraByKind?: Record<string, number>;
    touchCountExtraByKind?: Record<string, number>;

    /**
     * 原始・小惑星の「最良の1惑星 × 補正値」（2026-07-31）。内訳表の追加行はこれを出す。
     * 中身は 船接触＋船星系＋ガイア＋星系 の合計で、最外周/外周は入らない。
     * 種別ごとの単純合算（各軸の extraByKind）は監査用に従来どおり残してある。
     * 軸・スコアには入らないので、保存済み結果や回帰スナップショットには影響しない。
     */
    extraBest?: Record<
      string,
      {
        /** 選ばれた惑星のセル座標（マーカー用） */
        cellKey: string;
        scout: number;
        core: number;
        gaia: number;
        cluster: number;
        /** 補正前の4軸合計 */
        raw: number;
        factor: number;
        total: number;
      }
    >;

    /**
     * 開始地点＋到達加重の集計（2026-10-03 確定。docs/design-notes.md 2.6）。
     * 色ごとの値 ＝ 開始地点2ヶ所の値 ＋ Σ 残りの同色惑星の値 × 到達係数。
     * 軸の列（axesByType）は同じ重みで足して軸ごとに丸めたもので、評価はその合計。
     * eval_v2 までの保存結果には無い（表示側は再評価するか従来の値へフォールバックする）。
     */
    startAccess?: {
      /** 跳躍コストの表（添字＝距離）・減衰・割引の始まるコスト（当時の定数の記録） */
      hopCostByDistance: number[];
      decay: number;
      freeCost: number;
      /**
       * 基本7色: 開始地点のセル座標と、同色の全惑星の到達コスト・重み・値。
       * eval_v5 からは色の代表種族（representative）のもの。
       */
      byColor: Record<string, { starts: string[]; planets: StartAccessPlanet[] }>;
      /**
       * 種族ごとの集計（2026-10-05、eval_v5。docs/design-notes.md 2.7）。基本14種族は色の定数を
       * 基準に種族の性質（開始建物の数・航行・改造・ガイア）で到達コストが変わり、LF4種族は
       * 原始・小惑星から開始1ヶ所（eval_v4 までの `lf` の後継）。各軸は重み付き和を軸ごとに
       * 丸めたもので、total はその合計。
       */
      byFaction?: Record<string, FactionStart>;
      /**
       * 色ごとの代表種族（その色の2種族のうち total の大きい方。同点は FACTIONS の順で先）。
       * 検索の偏り項と色優遇はこの代表値（planetTypeTotals）で測る（案A）。
       */
      representative?: Record<string, string>;
      /**
       * eval_v4 までの LF4種族の記録（byFaction に統合した。古い保存結果の読み出し用に型だけ残す）。
       */
      lf?: Record<string, FactionStart & { kind: string; start: string }>;
      /**
       * 一本化の定数の記録（eval_v7。当時の値を保存結果に残す）。固有値・係数・種族の型。
       */
      unified?: {
        base: number;
        coef: Record<string, number>;
        gaiaFactions: string[];
        terraformFactions: string[];
      };
    };
    /**
     * 原始・小惑星の行の値（extraBest の後継、2026-10-03）。その種別を母星にする2種族のうち
     * 値の大きい方（案A）。色優遇の掛け先と、byFaction を持たない読み手のフォールバック。
     * eval_v7 からは byKind（種別ごとの列）。eval_v6 までは scout / core / gaia / cluster / outer / touch。
     */
    extraStart?: Record<
      string,
      {
        factionId: string;
        cellKey: string;
        byKind?: ValueByKind;
        total: number;
      }
    >;

    // planetType は基本7色に加え PROTO/ASTEROID も入る（マーカー用）。
    // missing / value は eval_v4 から（その惑星の欠けマス数と罰点。マーカーのホバー用）。
    outerHits: Array<{
      cellKey: string;
      planetType: PlanetType | string;
      kind: any;
      slotId: string;
      sectorId: string;
      tags: string[];
      missing?: number;
      value?: number;
    }>;
    touchHits: Array<{
      cellKey: string;
      planetType: PlanetType | string;
      kind: any;
      slotId: string;
      sectorId: string;
      tags: string[];
      missing?: number;
      value?: number;
    }>;

    // SSOT: breakdown.audit.scout は必ず出す
scout: {
  radius: number;

  // ★追加（optionalで安全）
  attributionModeForScoutCore?: "all" | "best";
  scoutWeightByScoutKey?: Record<string, number> | null;
  scoutPlanetsByScoutKey?: Record<string, number>;

  byType: AxisByType;

  perScout: Array<{
    scoutKey: string;
    byType: AxisByType;
    total: number;
  }>;

  distanceHistogram: Record<number, number>;
  scoutPlanetCount: number;

  extraByKind: Record<string, number>;
  excludedPlanetCounts?: Record<string, number>;

  scoutHits: Array<{
    /** 探査船セルの座標キー（重み上書きの引き当てに使われている既存フィールド） */
    scoutKey: string;
    /** 船の識別子（twilight/eclipse/rebellion/tfmars）。船で絞るときはこちら */
    scoutId?: string;
    planetKey: string;
    planetType: string;
    distance: number;
    value: number;
    planet: { kind: any; planetKind?: any; slotId: string; sectorId: string; tags: string[] };
    scout: { kind: any; slotId: string; sectorId: string; tags: string[] };
  }>;
};

    // SSOT: breakdown.audit.scoutCore は必ず出す
scoutCore: {
  radius: 2;
  /** 船星系の成立に必要な「距離1〜2の船接触惑星の数」 */
  minScoutPlanets?: number;

  // ★追加（optionalで安全）
  attributionMode?: "all" | "best";
  scoutCoreWeightByScoutKey?: Record<string, number> | null;

  byType: AxisByType;

  perScoutPlanet: Array<{
    scoutPlanetKey: string;
    byType: AxisByType;
    total: number;
    extraByKind: Record<string, number>;
  }>;

  distanceHistogram: Record<number, number>;
  extraByKind: Record<string, number>;

  coreHits: Array<{
    /** どの船由来か（評価指数の船別セルからマークするため） */
    scoutKey: string;
    /** 船の識別子（twilight/eclipse/rebellion/tfmars） */
    scoutId?: string;
    scoutPlanetKey: string;
    corePlanetKey: string;
    corePlanetType: string;
    distance: 1 | 2;
    value: number;
  }>;
};

    // eval_v6 までの gaiaProximity / cluster（ガイア近接・星系の監査）は eval_v7 で廃止。
  };

  debug?: any;
};

export type SoftEvalResult = {
  score: number;
  breakdown: SoftBreakdown;
};

const PLANET_TYPES: PlanetType[] = ["BLACK", "BLUE", "BROWN", "ORANGE", "RED", "WHITE", "YELLOW"];

/** 基本7色に入らないが色優遇/冷遇の対象にする惑星種別（2026-07-31）。 */
export const EXTRA_PREF_KINDS = ["PROTO", "ASTEROID"] as const;

/**
 * 【2026-10-03 に廃止】原始・小惑星の「最良の1つ」に掛けていた補正値。評価は
 * 「開始地点＋到達加重」（reachCost.ts）に移り、係数は掛けない。eval_v2 までの保存結果を
 * 読む側のフォールバックと古い調査スクリプトのために定数だけ残してある。
 * 以下は当時の記録（2026-07-31、2026-08-02 に再調査）。
 *
 * 内訳表の追加行を基本7色の行と同じ物差しで読めるようにするための係数。
 * 検索スコア本体（planetTypeTotals）には入らないが、次の2つには効くので
 * 「表示専用」ではない:
 *   - Map の色優遇（`wColorPref × pref × extraBest.total`。pref を付けたときだけ）
 *   - List の種族優遇の掛け先（`mapValueByFaction` が LF4種族の Map 評価値に使う）
 *
 * 実測（`npx tsx scripts/_probe_extra_best_bias.ts`、LF 3p/4p 各60盤面・既定の評価指数）:
 *   最良の1惑星（4軸）の平均  PROTO 34.83 / ASTEROID 43.93 / 基本7色 37.57
 *   基本7色の色ごとの合計     108.02
 *
 * 種別ごとに分ける（PROTO 3.10 / ASTEROID 2.46）ことはしない。理由は2つ:
 *   - PROTO と ASTEROID の差は個数ではなく置かれ方の質。惑星の個数で層別しても
 *     同じ個数どうしで ASTEROID が +9〜10 高い（5個 33.65 vs 43.00 /
 *     6個 35.60 vs 45.20 / 7個 34.00 vs 44.18）。個数が増えても最良値は
 *     ほとんど上がらないので、最大値の上振れでもない。分けるとこの差が消える。
 *   - 決め方を変えても同じ値になる。基本色の「色ごとの合計 ÷ 4軸の最良1惑星」
 *     ＝ 2.875 をそのまま換算率として使っても 2.75 とほぼ変わらない
 *     （PROTO 100.2 / ASTEROID 126.3）。
 * 結果、平均は PROTO 95.8 / ASTEROID 120.8（基本7色平均の -11% / +12%）。
 */
export const EXTRA_BEST_FACTOR = 2.75;

function zeroAxis(): AxisByType {
  return { BLACK: 0, BLUE: 0, BROWN: 0, ORANGE: 0, RED: 0, WHITE: 0, YELLOW: 0 };
}

function num(v: any, fallback: number): number {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function clampInt(v: any, fallback: number, min: number, max: number): number {
  const n = Math.floor(num(v, fallback));
  return Math.max(min, Math.min(max, n));
}

function addAxis(a: AxisByType, b: AxisByType): AxisByType {
  const out = zeroAxis();
  for (const t of PLANET_TYPES) out[t] = (a[t] ?? 0) + (b[t] ?? 0);
  return out;
}

function axisValues(a: AxisByType): number[] {
  return PLANET_TYPES.map((t) => a[t] ?? 0);
}

function std(values: number[]): number {
  if (values.length === 0) return 0;
  const mean = values.reduce((s, x) => s + x, 0) / values.length;
  const v = values.reduce((s, x) => s + (x - mean) * (x - mean), 0) / values.length;
  return Math.sqrt(v);
}

function range(values: number[]): number {
  if (values.length === 0) return 0;
  let mn = Infinity;
  let mx = -Infinity;
  for (const x of values) {
    if (x < mn) mn = x;
    if (x > mx) mx = x;
  }
  return mx - mn;
}

function toPlanetType(kind?: PlanetKind, colorKey?: string): PlanetType | null {
  const s = (colorKey ?? kind ?? "").toString().toUpperCase();
  if (s === "BLACK") return "BLACK";
  if (s === "BLUE") return "BLUE";
  if (s === "BROWN") return "BROWN";
  if (s === "ORANGE") return "ORANGE";
  if (s === "RED") return "RED";
  if (s === "WHITE") return "WHITE";
  if (s === "YELLOW") return "YELLOW";
  return null;
}

/**
 * 距離が1伸びるごとに引く量（2026-07-31）。
 *
 * 船接触・船星系の寄与は「重み −（距離−1）×これ」で、引く量が**絶対値**なので、
 * **重みのスケールを変えるときは必ずこの値も一緒に変えること。**
 * 重みだけ10倍にすると、旧 wScout=10 の 10→9→8（1割ずつ落ちる）が
 * 100→99→98 になってほとんど落ちなくなり、評価の意味そのものが変わる。
 * いまは重みが1桁〜2桁（wScout=10）なので 1。
 */
export const DISTANCE_FALLOFF = 1;

function scoutValue(d: number, wScout: number, R: number): number {
  if (d < 1 || d > R) return 0;
  const v = wScout - (d - 1) * DISTANCE_FALLOFF;
  return v > 0 ? v : 0;
}

function scoutCoreValue(d: number, wScoutCore: number): number {
  if (d !== 1 && d !== 2) return 0;
  const v = wScoutCore - (d - 1) * DISTANCE_FALLOFF;
  return v > 0 ? v : 0;
}

function incNumRecord(map: Record<number, number>, key: number, delta: number) {
  if (!Number.isFinite(key)) return;
  map[key] = (map[key] ?? 0) + delta;
}

function collectExcludedPlanetCountsBestEffort(extracted: ExtractedForEval): Record<string, number> {
  const out: Record<string, number> = {};
  for (const c of extracted.cells ?? []) {
    if (!c?.isPlanet) continue;
    if (!c?.isExcludedPlanet) continue;
    const k = String((c as any).planetKind ?? "EXCLUDED").toUpperCase();
    out[k] = (out[k] ?? 0) + 1;
  }
  return out;
}

export function evaluateSoft(extracted: ExtractedForEval, params: SoftParams): SoftEvalResult {
  const wRimGap = num(params.wRimGap, 0);
  const wOuter = num(params.wOuter, 0);
  const wTouch = num(params.wTouch, 0);
  const wScout = num(params.wScout, 0);
  const wScoutCore = num(params.wScoutCore, 0);
  const wScoutByScoutKey = (params as any).wScoutByScoutKey as Record<string, number> | undefined;
  const wScoutCoreByScoutKey = (params as any).wScoutCoreByScoutKey as Record<string, number> | undefined;
  const scoutCoreAttributionMode = ((params as any).scoutCoreAttributionMode as ("all" | "best") | undefined) ?? "all";
  const wImbalance = num(params.wImbalance, 0);

  const wColorPref = num((params as any).wColorPref, 0);
  const colorPrefByTypeRaw = ((params as any).colorPrefByType ?? (params as any).colorBiasByType ?? null) as any;

  const metric: "std" | "range" =
    params.imbalanceMetric === "range" || params.imbalanceMetric === "std" ? params.imbalanceMetric : "std";

  const scoutRadius = clampInt(params.scoutRadius, 3, 0, 12);

  /**
   * 惑星ごとの「状況の値」（2026-10-03 に惑星単位へ、2026-10-07 eval_v7 で一本化）。盤面の全惑星
   * （基本7色・原始・小惑星・ガイア・次元横断）について、船接触・船星系・最外周・外周を惑星単位で持つ。
   * 種族ごとの値は、この状況の値に固有値を足し、種別の係数と到達係数を掛けて全惑星で合計する（下の集計）。
   * eval_v6 までのガイア近接・星系の軸は eval_v7 で廃止。
   */
  type PlanetAcc = {
    key: string;
    kind: string;
    type: PlanetType | null;
    scout: number;
    core: number;
    outer: number;
    touch: number;
  };
  const perPlanet = new Map<string, PlanetAcc>();
  for (const p of extracted.planetCells) {
    const type = toPlanetType((p as any).planetKind as any, (p as any).colorKey);
    const kind = type ?? (String((p as any).planetKind ?? "").toUpperCase() || "UNKNOWN");
    if (!type && kind !== "PROTO" && kind !== "ASTEROID") continue;
    perPlanet.set(p.key, { key: p.key, kind, type, scout: 0, core: 0, outer: 0, touch: 0 });
  }
  // ガイア・次元横断（planetCells からは除外されている）。eval_v6 から惑星ごとの値を持つ。
  // 船接触惑星（船星系の起点）・軸の色ごとの合算（byType / extraByKind）には入れない。
  const excludedPlanetCells = (extracted.cells ?? []).filter((c) => (c as any).isPlanet && (c as any).isExcludedPlanet);
  for (const p of excludedPlanetCells) {
    const kind = String((p as any).planetKind ?? "").toUpperCase();
    if (kind !== "GAIA" && kind !== "TRANSDIM") continue;
    perPlanet.set(p.key, { key: p.key, kind, type: null, scout: 0, core: 0, outer: 0, touch: 0 });
  }
  const addPlanetAxis = (cellKey: string, axis: "scout" | "core" | "outer" | "touch", v: number) => {
    const e = perPlanet.get(cellKey);
    if (e) e[axis] += v;
  };

  // ===== 端の罰点: 最外周 / 外周（2026-10-04 から「欠けマス × w」、eval_v4）=====
  //
  // 惑星ごとの罰点 ＝ −wRimGap × 「距離2以内の18マスのうち盤面に無いマスの数」
  //                 （＋ eval_v3 までの −wOuter / −wTouch。指定があるときだけ）。
  // 最外周セルの惑星は「最外周」の列へ、外周（最外周の1つ内側）セルの惑星は「外周」の列へ。
  // 内側の惑星は欠け0なので列に入らない（全テンプレで実測。両方に属するセルも無い）。
  // 基本7色も原始・小惑星も同じ式で、どちらも評価（開始地点＋到達加重）に入る。
  // 盤面のセル集合は extracted.cells（空セルも含む全セル）。
  const onBoard = new Set<string>((extracted.cells ?? extracted.planetCells).map((c) => String(c.key)));
  const rimMissingByCell: Record<string, number> = {};
  const rimPenaltyOf = (p: { key: AxialKey; q: number; r: number }): { outer: number; touch: number; missing: number } => {
    const inOuter = extracted.outerCells.has(p.key);
    const inTouch = extracted.touchCells.has(p.key);
    const missing = wRimGap !== 0 ? missingCellsWithin(onBoard, p.q, p.r) : 0;
    if (missing > 0) rimMissingByCell[p.key] = missing;
    const gap = -wRimGap * missing;
    // 欠けマスの罰点は1回だけ: 最外周セルなら「最外周」、それ以外は「外周」の列。
    // 欠けがあるのに最外周でも外周でもないセル（現行テンプレには無い）も外周の列に入れて、
    // 列の合計と評価が一致したままにする。
    const outer = (inOuter ? gap : 0) - (inOuter ? wOuter : 0);
    const touch = (inOuter ? 0 : gap) - (inTouch ? wTouch : 0);
    return { outer, touch, missing };
  };

  const outerCountByType: CountByType = zeroAxis();
  const touchCountByType: CountByType = zeroAxis();

  const outerHits: any[] = [];
  const touchHits: any[] = [];

  for (const p of extracted.normalPlanetCells) {
    const t = toPlanetType((p as any).planetKind as any, (p as any).colorKey);
    if (!t) continue;
    const pen = rimPenaltyOf(p as any);
    const hit = {
      cellKey: p.key,
      planetType: t,
      kind: (p as any).kind,
      slotId: (p as any).slotId,
      sectorId: (p as any).sectorId,
      tags: (p as any).tags ?? [],
      missing: pen.missing,
    };

    if (extracted.outerCells.has(p.key)) {
      outerCountByType[t] += 1;
      addPlanetAxis(p.key, "outer", pen.outer);
      outerHits.push({ ...hit, value: pen.outer });
    }

    if (extracted.touchCells.has(p.key)) {
      touchCountByType[t] += 1;
      addPlanetAxis(p.key, "touch", pen.touch);
      touchHits.push({ ...hit, value: pen.touch });
    } else if (!extracted.outerCells.has(p.key) && pen.touch !== 0) {
      addPlanetAxis(p.key, "touch", pen.touch);
      touchHits.push({ ...hit, value: pen.touch });
    }
  }

  // PROTO/ASTEROID（基本7色に入らない惑星）の最外周/外周。
  // 惑星ごとの罰点は perPlanet に持ち、評価（LF4種族ごとの開始地点＋到達加重）に入る（eval_v4）。
  // 種別ごとの単純合算（extraByKind）は監査・表示のフォールバック用に従来どおり残す。
  const outerExtraByKind: Record<string, number> = {};
  const touchExtraByKind: Record<string, number> = {};
  const outerCountExtraByKind: Record<string, number> = {};
  const touchCountExtraByKind: Record<string, number> = {};

  for (const p of extracted.planetCells) {
    if (toPlanetType((p as any).planetKind as any, (p as any).colorKey)) continue;
    const kindU = String((p as any).planetKind ?? "").toUpperCase() || "UNKNOWN";
    const pen = rimPenaltyOf(p as any);
    const hit = {
      cellKey: p.key,
      planetType: kindU,
      kind: (p as any).kind,
      slotId: (p as any).slotId,
      sectorId: (p as any).sectorId,
      tags: (p as any).tags ?? [],
      missing: pen.missing,
    };
    if (extracted.outerCells.has(p.key)) {
      outerCountExtraByKind[kindU] = (outerCountExtraByKind[kindU] ?? 0) + 1;
      outerExtraByKind[kindU] = (outerExtraByKind[kindU] ?? 0) + pen.outer;
      addPlanetAxis(p.key, "outer", pen.outer);
      outerHits.push({ ...hit, value: pen.outer });
    }
    if (extracted.touchCells.has(p.key)) {
      touchCountExtraByKind[kindU] = (touchCountExtraByKind[kindU] ?? 0) + 1;
      touchExtraByKind[kindU] = (touchExtraByKind[kindU] ?? 0) + pen.touch;
      addPlanetAxis(p.key, "touch", pen.touch);
      touchHits.push({ ...hit, value: pen.touch });
    } else if (!extracted.outerCells.has(p.key) && pen.touch !== 0) {
      touchExtraByKind[kindU] = (touchExtraByKind[kindU] ?? 0) + pen.touch;
      addPlanetAxis(p.key, "touch", pen.touch);
      touchHits.push({ ...hit, value: pen.touch });
    }
  }

  // ガイア・次元横断の端の罰点（eval_v6）。惑星ごとの値とマーカー用のヒットだけで、種別ごとの合算・枚数には入れない。
  for (const p of excludedPlanetCells) {
    if (!perPlanet.has(p.key)) continue;
    const kindU = String((p as any).planetKind ?? "").toUpperCase();
    const pen = rimPenaltyOf(p as any);
    const hit = {
      cellKey: p.key,
      planetType: kindU,
      kind: (p as any).kind,
      slotId: (p as any).slotId,
      sectorId: (p as any).sectorId,
      tags: (p as any).tags ?? [],
      missing: pen.missing,
    };
    if (extracted.outerCells.has(p.key)) {
      addPlanetAxis(p.key, "outer", pen.outer);
      outerHits.push({ ...hit, value: pen.outer });
    }
    if (extracted.touchCells.has(p.key) || (!extracted.outerCells.has(p.key) && pen.touch !== 0)) {
      addPlanetAxis(p.key, "touch", pen.touch);
      touchHits.push({ ...hit, value: pen.touch });
    }
  }

  // ===== scout (planetCells = GAIA/TRANSDIM除外済; PROTO/ASTEROID含む) =====
  const scoutAxis: AxisByType = zeroAxis();
  const perScout: Array<{ scoutKey: string; byType: AxisByType; total: number }> = [];
  const scoutHits: any[] = [];

  const scoutExtraByKind: Record<string, number> = {};
  const scoutDistanceHistogram: Record<number, number> = {};

  // Scout惑星集合（ScoutCore入力）
// - union: 互換性/監査用の全体集合（従来と同じ意味）
// - byScoutKey: ScoutCore入力用（A=all / B=best）
const scoutPlanetKeySet = new Set<string>();
const scoutPlanetByKey = new Map<string, any>();
// scoutKey（セル座標）から探査船セルを引く。船IDを監査へ載せるのに使う。
const scoutCellByKey = new Map<string, any>(extracted.scoutCells.map((s) => [s.key, s]));

const scoutPlanetKeySetByScoutKeyAll = new Map<string, Set<string>>();
const bestScoutByPlanetKey = new Map<string, { scoutKey: string; value: number; distance: number }>();

const getOrCreatePlanetSet = (m: Map<string, Set<string>>, k: string) => {
  const cur = m.get(k);
  if (cur) return cur;
  const s = new Set<string>();
  m.set(k, s);
  return s;
};

for (const s of extracted.scoutCells) {
  const byType = zeroAxis();
  let total = 0;

  // 船別の重み上書きは船ID（twilight/eclipse/rebellion/tfmars）で引く。
  // 以前はセル座標 s.key で引いていたため常に未ヒットで、全船が既定値へ
  // フォールバックしていた（2026-07-30 修正）。座標キーでの指定も後方互換で残す。
  const wScoutEff = num(
    wScoutByScoutKey?.[String((s as any).scoutId ?? "")] ?? wScoutByScoutKey?.[s.key],
    wScout
  );

  for (const p of extracted.planetCells) {
    const kindU = String((p as any).planetKind ?? "").toUpperCase();
    const t = toPlanetType((p as any).planetKind as any, (p as any).colorKey);

    const d = axialDistance(s.q, s.r, p.q, p.r);
    const contrib = scoutValue(d, wScoutEff, scoutRadius);
    if (contrib <= 0) continue;
    addPlanetAxis(p.key, "scout", contrib);

    // Scout惑星（ScoutCore起点）
    scoutPlanetKeySet.add(p.key);
    if (!scoutPlanetByKey.has(p.key)) scoutPlanetByKey.set(p.key, p);

    // Mode A (all): keep membership by scout
    getOrCreatePlanetSet(scoutPlanetKeySetByScoutKeyAll, s.key).add(p.key);

    // Mode B (best): track best contributing scout for each planet
    {
      const prev = bestScoutByPlanetKey.get(p.key);
      if (
        !prev ||
        contrib > prev.value ||
        (contrib === prev.value && d < prev.distance) ||
        (contrib === prev.value && d === prev.distance && String(s.key).localeCompare(String(prev.scoutKey)) < 0)
      ) {
        bestScoutByPlanetKey.set(p.key, { scoutKey: s.key, value: contrib, distance: d });
      }
    }

    if (t) {
      byType[t] += contrib;
      scoutAxis[t] += contrib;
    } else {
      // PROTO/ASTEROID等は別枠
      const k = kindU || "UNKNOWN";
      scoutExtraByKind[k] = (scoutExtraByKind[k] ?? 0) + contrib;
    }

    total += contrib;
    incNumRecord(scoutDistanceHistogram, d, 1);

    scoutHits.push({
      scoutKey: s.key,
      // 船の識別子（twilight/eclipse/rebellion/tfmars）。scoutKey はセル座標なので
      // 「どの船か」で絞るにはこちらを使う（評価指数の船別セル用。2026-07-30）。
      scoutId: (s as any).scoutId ?? "",
      scoutWeight: wScoutEff,
      planetKey: p.key,
      planetType: t ?? kindU ?? "UNKNOWN",
      distance: d,
      value: contrib,
      planet: {
        kind: (p as any).kind,
        planetKind: (p as any).planetKind,
        slotId: (p as any).slotId,
        sectorId: (p as any).sectorId,
        tags: (p as any).tags ?? [],
      },
      scout: {
        kind: (s as any).kind,
        slotId: (s as any).slotId,
        sectorId: (s as any).sectorId,
        tags: (s as any).tags ?? [],
      },
    });
  }

  // ガイア・次元横断への船接触（eval_v6）。惑星ごとの値とマーカー用のヒットだけ。船接触惑星（船星系の起点）には
  // しない（「ガイア惑星と次元横断惑星は船接触惑星に数えない」はそのまま）し、色ごとの合算にも入れない。
  for (const p of excludedPlanetCells) {
    if (!perPlanet.has(p.key)) continue;
    const d = axialDistance(s.q, s.r, p.q, p.r);
    const contrib = scoutValue(d, wScoutEff, scoutRadius);
    if (contrib <= 0) continue;
    addPlanetAxis(p.key, "scout", contrib);
    scoutHits.push({
      scoutKey: s.key,
      scoutId: (s as any).scoutId ?? "",
      scoutWeight: wScoutEff,
      planetKey: p.key,
      planetType: String((p as any).planetKind ?? "").toUpperCase(),
      distance: d,
      value: contrib,
      planet: {
        kind: (p as any).kind,
        planetKind: (p as any).planetKind,
        slotId: (p as any).slotId,
        sectorId: (p as any).sectorId,
        tags: (p as any).tags ?? [],
      },
      scout: {
        kind: (s as any).kind,
        slotId: (s as any).slotId,
        sectorId: (s as any).sectorId,
        tags: (s as any).tags ?? [],
      },
    });
  }

  perScout.push({ scoutKey: s.key, byType, total });
}

// Decide ScoutCore input membership by mode
const scoutPlanetKeySetByScoutKey = new Map<string, Set<string>>();
if (scoutCoreAttributionMode === "best") {
  for (const [planetKey, best] of bestScoutByPlanetKey.entries()) {
    if (best.value <= 0) continue;
    getOrCreatePlanetSet(scoutPlanetKeySetByScoutKey, best.scoutKey).add(planetKey);
  }
} else {
  for (const [k, set] of scoutPlanetKeySetByScoutKeyAll.entries()) {
    scoutPlanetKeySetByScoutKey.set(k, new Set(set));
  }
}

  // ===== scoutCore (Scout惑星集合 -> 距離1/2) =====
  const scoutCoreAxis: AxisByType = zeroAxis();
  const perScoutPlanet: Array<{ scoutPlanetKey: string; byType: AxisByType; total: number; extraByKind: Record<string, number> }> = [];
  const scoutCoreHits: Array<{ scoutKey: string; scoutId: string; scoutPlanetKey: string; corePlanetKey: string; corePlanetType: string; distance: 1 | 2; value: number }> = [];

  const scoutCoreExtraByKind: Record<string, number> = {};
  const scoutCoreDistanceHistogram: Record<number, number> = {};

  /**
   * 船星系の成立条件（2026-07-30 ユーザー確定で変更）。
   *
   * 旧: 船接触惑星が1つでも距離1〜2にあれば船星系として加点していた。
   * 新: **距離1〜2に船接触惑星が2つ以上ある惑星だけ**を船星系とする。
   *     1つだけ隣接している惑星まで拾うのは広すぎる、という判断。
   *
   * 数え方の対象は船接触惑星の集合（extracted.planetCells 由来）なので、
   * ガイア惑星と次元横断惑星はそもそも含まれない（1ラウンド目に入植できず
   * 価値が低いため除外する、というユーザーの意図と一致する）。
   */
  const MIN_SCOUT_PLANETS_FOR_CORE = 2;
  // 船星系の加点を受ける側（eval_v6 からガイア・次元横断も。起点の集合は planetCells のまま）
  const coreRecipients = [...extracted.planetCells, ...excludedPlanetCells.filter((p) => perPlanet.has(p.key))];
  const scoutPlanetsNearPlanet = new Map<string, Set<string>>();
  for (const spKey of scoutPlanetKeySet) {
    const sp = scoutPlanetByKey.get(spKey);
    if (!sp) continue;
    for (const p of coreRecipients) {
      if (p.key === sp.key) continue;
      const d0 = axialDistance(sp.q, sp.r, p.q, p.r);
      if (d0 !== 1 && d0 !== 2) continue;
      let set = scoutPlanetsNearPlanet.get(p.key);
      if (!set) {
        set = new Set<string>();
        scoutPlanetsNearPlanet.set(p.key, set);
      }
      set.add(spKey);
    }
  }
  const qualifiesAsCore = (planetKey: string) =>
    (scoutPlanetsNearPlanet.get(planetKey)?.size ?? 0) >= MIN_SCOUT_PLANETS_FOR_CORE;

  // ScoutCore uses per-scout assigned Scout planets (mode A/B)
if (scoutPlanetKeySetByScoutKey.size > 0) {
  for (const [scoutKey, scoutPlanetKeys] of scoutPlanetKeySetByScoutKey.entries()) {
    // 船接触と同じく船IDで引く（座標キー指定も後方互換で残す）。
    const scoutIdOf = String((scoutCellByKey.get(scoutKey) as any)?.scoutId ?? "");
    const wScoutCoreEff = num(
      wScoutCoreByScoutKey?.[scoutIdOf] ?? wScoutCoreByScoutKey?.[scoutKey],
      wScoutCore
    );
    if (wScoutCoreEff <= 0) continue;
    if (!scoutPlanetKeys || scoutPlanetKeys.size === 0) continue;

    for (const spKey of scoutPlanetKeys) {
      const sp = scoutPlanetByKey.get(spKey);
      if (!sp) continue;

      const byType = zeroAxis();
      const extraByKind: Record<string, number> = {};
      let total = 0;

      for (const p of coreRecipients) {
        if (p.key === sp.key) continue; // ★自己除外（確定仕様）

        const d0 = axialDistance(sp.q, sp.r, p.q, p.r);
        if (d0 !== 1 && d0 !== 2) continue;

        // 距離1〜2の船接触惑星が1つしかない惑星は船星系にしない（2026-07-30）
        if (!qualifiesAsCore(p.key)) continue;

        const contrib = scoutCoreValue(d0, wScoutCoreEff);
        if (contrib <= 0) continue;

        const kindU = String((p as any).planetKind ?? "").toUpperCase();
        const t = toPlanetType((p as any).planetKind as any, (p as any).colorKey);

        // NOTE: 保留対応（仕様）
        // ScoutCoreでは、Outer/Touchに含まれる PROTO/ASTEROID の寄与を加算しない。
        // - Scout（起点集合）や、Outer/Touch自体の集計は変更しない
        // - ここでのみ除外することで「Scoutは変わらず、ScoutCoreのみ下がる」を保証する
        if ((kindU === "PROTO" || kindU === "ASTEROID") && (extracted.outerCells.has(p.key) || extracted.touchCells.has(p.key))) {
          continue;
        }
        addPlanetAxis(p.key, "core", contrib);

        // ガイア・次元横断（eval_v6）: 惑星ごとの値とマーカー用のヒットだけ。色ごとの合算・集計には入れない
        if (kindU === "GAIA" || kindU === "TRANSDIM") {
          scoutCoreHits.push({
            scoutKey,
            scoutId: String((scoutCellByKey.get(scoutKey) as any)?.scoutId ?? ""),
            scoutPlanetKey: sp.key,
            corePlanetKey: p.key,
            corePlanetType: kindU,
            distance: d0 as 1 | 2,
            value: contrib,
          });
          continue;
        }

        if (t) {
          byType[t] += contrib;
          scoutCoreAxis[t] += contrib;
        } else {
          const k = kindU || "UNKNOWN";
          extraByKind[k] = (extraByKind[k] ?? 0) + contrib;
          scoutCoreExtraByKind[k] = (scoutCoreExtraByKind[k] ?? 0) + contrib;
        }

        total += contrib;
        incNumRecord(scoutCoreDistanceHistogram, d0, 1);

        scoutCoreHits.push({
          // どの船由来かを残す（評価指数の船別セルからマークするため。2026-07-30）
          scoutKey,
          scoutId: String((scoutCellByKey.get(scoutKey) as any)?.scoutId ?? ""),
          scoutPlanetKey: sp.key,
          corePlanetKey: p.key,
          corePlanetType: t ?? kindU ?? "UNKNOWN",
          distance: d0 as 1 | 2,
          value: contrib,
        });
      }

      perScoutPlanet.push({
        scoutPlanetKey: sp.key,
        byType,
        total,
        extraByKind,
      });
    }
  }
}

  // deterministic ordering for debugging
  outerHits.sort((a: any, b: any) => String(a.cellKey).localeCompare(String(b.cellKey)));
  touchHits.sort((a: any, b: any) => String(a.cellKey).localeCompare(String(b.cellKey)));
  scoutHits.sort((a: any, b: any) => {
    const k = String(a.scoutKey).localeCompare(String(b.scoutKey));
    if (k !== 0) return k;
    return String(a.planetKey).localeCompare(String(b.planetKey));
  });
  scoutCoreHits.sort((a: any, b: any) => {
    const k = String(a.scoutPlanetKey).localeCompare(String(b.scoutPlanetKey));
    if (k !== 0) return k;
    return String(a.corePlanetKey).localeCompare(String(b.corePlanetKey));
  });

  // ===== 一本化: 全惑星を同一の式で（2026-10-07 ユーザー確定、eval_v7。docs/design-notes.md 2.10）=====
  //
  // 種族 f の値 ＝ Σ_{盤面の全惑星 p} 係数_f(種別(p)) × (固有値 ＋ 状況の値(p)) × 到達係数_f(開始地点 → p)
  //   状況の値 ＝ 船接触 ＋ 船星系 ＋ 端の罰点（最外周 / 外周）。固有値と係数は reachCost.ts の UNIFIED_VALUE。
  //   開始地点は母星色（LF は母星種別）の惑星から k 個（ゼノ族 3・ダー・シュワーム人 1・LF 1・他 2）を、
  //   残りの到達加重まで含めた合計が最大になる組で総当たり（planStarts の startKeys）。
  //   種別ごと（母星色 / 他色 / ガイア / 次元横断 / 原始・小惑星）に重み付き和を丸め、評価はその合計
  //   （内訳表の列の合計と評価が一致したまま小数が消える。2026-07-31 の方針を踏襲）。
  //   色の値（planetTypeTotals）はその色の2種族のうち total の大きい方＝代表種族の値（案A）。
  //   検索の偏り項と色優遇はこの代表値で従来どおり7色で測り、内訳表は種族の行を出す。
  //   原始・小惑星の行の値（extraStart）はその種別を母星にする LF 2種族のうち大きい方。
  const nodes: PlanetNode[] = (extracted.cells ?? extracted.planetCells)
    .filter((c: any) => c.isPlanet)
    .map((c: any) => ({
      key: String(c.key),
      q: Number(c.q),
      r: Number(c.r),
      kind: toPlanetType(c.planetKind as any, c.colorKey) ?? (String(c.planetKind ?? "").toUpperCase() || "UNKNOWN"),
    }));
  const BASE = UNIFIED_VALUE.BASE;
  const situationOf = (e: PlanetAcc) => e.scout + e.core + e.outer + e.touch;
  const zeroKinds = (): ValueByKind => ({ own: 0, other: 0, gaia: 0, transdim: 0, extra: 0 });
  const allPlanets = [...perPlanet.values()];

  const byFaction: Record<string, FactionStart> = {};
  const representative: Record<string, string> = {};
  const startByColor: Record<string, { starts: string[]; planets: StartAccessPlanet[] }> = {};
  const planFor = (
    id: string,
    home: string,
    stoneCost: Parameters<typeof planStarts>[0]["stoneCost"],
    startCount: number,
    hop: Parameters<typeof planStarts>[0]["hopCost"]
  ): FactionStart | null => {
    const startKeys = new Set(allPlanets.filter((e) => e.kind === home).map((e) => e.key));
    if (startKeys.size === 0) return null;
    const coefOf = (e: PlanetAcc) => destinationCoef(id, e.kind, home);
    const valueOf = (e: PlanetAcc) => coefOf(e) * (BASE + situationOf(e));
    const plan = planStarts({
      nodes,
      candidates: allPlanets.map((e) => ({ key: e.key, value: valueOf(e) })),
      stoneCost,
      startCount,
      startKeys,
      hopCost: hop,
    });
    if (!plan) return null;
    const sums = zeroKinds();
    let base = 0, scout = 0, core = 0, outer = 0, touch = 0;
    const planets: StartAccessPlanet[] = [];
    for (const e of allPlanets) {
      const w = plan.weights.get(e.key) ?? 0;
      const coef = coefOf(e);
      const dest = destinationKind(e.kind, home);
      const value = valueOf(e);
      planets.push({
        cellKey: e.key,
        kind: e.kind,
        dest,
        cost: plan.costs.get(e.key) ?? Infinity,
        weight: w,
        value,
        ...(coef !== 1 ? { coef } : {}),
      });
      if (w <= 0) continue;
      sums[dest] += value * w;
      base += coef * BASE * w;
      scout += coef * e.scout * w;
      core += coef * e.core * w;
      outer += coef * e.outer * w;
      touch += coef * e.touch * w;
    }
    const byKind = zeroKinds();
    let total = 0;
    for (const k of DESTINATION_KINDS) {
      byKind[k] = Math.round(sums[k]);
      total += byKind[k];
    }
    planets.sort((a, b) => b.weight - a.weight || a.cellKey.localeCompare(b.cellKey));
    const entry: FactionStart = { color: home, starts: plan.starts, byKind, total, base, scout, core, outer, touch, planets };
    byFaction[id] = entry;
    return entry;
  };
  for (const f of BASIC_FACTION_ORDER) {
    const p = BASIC_REACH_PROFILES[f];
    const entry = planFor(f, p.color, stoneCostForBasicFaction(f), p.startCount, hopCostForBasicFaction(f));
    if (!entry) continue;
    // 同点は FACTIONS の順で先の種族（決定的にする）
    const cur = representative[p.color];
    if (!cur || entry.total > byFaction[cur].total) representative[p.color] = f;
  }
  const aggByKind: Record<DestinationKind, AxisByType> = { own: zeroAxis(), other: zeroAxis(), gaia: zeroAxis(), transdim: zeroAxis(), extra: zeroAxis() };
  for (const t of PLANET_TYPES) {
    const rep = representative[t];
    if (!rep) continue;
    const e = byFaction[rep];
    for (const k of DESTINATION_KINDS) aggByKind[k][t] = e.byKind[k];
    startByColor[t] = { starts: e.starts, planets: e.planets };
  }
  // LF4種族（開始1ヶ所、種族ごとの入植コスト）。原始・小惑星の行の値（extraStart）は2種族のうち大きい方（案A）
  type ExtraStart = NonNullable<SoftBreakdown["audit"]["extraStart"]>[string];
  const extraStart: Record<string, ExtraStart> = {};
  for (const f of LF_FACTION_ORDER) {
    const home = LF_REACH_PROFILES[f].home;
    const entry = planFor(f, home, stoneCostForLfFaction(f), START_COUNT_LF, hopCostForLfFaction(f));
    if (!entry) continue;
    const cur = extraStart[home];
    if (!cur || entry.total > cur.total) {
      extraStart[home] = { factionId: f, cellKey: entry.starts[0], byKind: entry.byKind, total: entry.total };
      representative[home] = f;
    }
  }
  const startAccess: NonNullable<SoftBreakdown["audit"]["startAccess"]> = {
    hopCostByDistance: [...HOP_COST_BY_DISTANCE],
    decay: REACH_DECAY,
    freeCost: REACH_FREE_COST,
    byColor: startByColor,
    byFaction,
    representative,
    unified: {
      base: BASE,
      coef: {
        OWN: UNIFIED_VALUE.OWN,
        OTHER: UNIFIED_VALUE.OTHER,
        GAIA: UNIFIED_VALUE.GAIA,
        TRANSDIM: UNIFIED_VALUE.TRANSDIM,
        GAIA_FACTION_TRANSDIM: UNIFIED_VALUE.GAIA_FACTION_TRANSDIM,
        EXTRA: UNIFIED_VALUE.EXTRA,
        TERRA_BOOST: UNIFIED_VALUE.TERRA_BOOST,
      },
      gaiaFactions: [...GAIA_FACTIONS],
      terraformFactions: [...TERRAFORM_FACTIONS],
    },
  };

  // totals & imbalance（種別ごとに丸めた値の和なので、内訳表の列の合計と評価が一致する）
  const planetTypeTotals = addAxis(
    addAxis(addAxis(aggByKind.own, aggByKind.other), addAxis(aggByKind.gaia, aggByKind.transdim)),
    aggByKind.extra
  );

  const values = axisValues(planetTypeTotals);
  const imbalanceValue = metric === "range" ? range(values) : std(values);
    const imbalanceScore = -wImbalance * imbalanceValue;

  // ===== color preference (optional) =====
  const prefByType: AxisByType = zeroAxis();
  for (const t of PLANET_TYPES) {
    prefByType[t] = num(colorPrefByTypeRaw?.[t], 0);
  }
  // 原始・小惑星は軸（planetTypeTotals）を持たないので、内訳表に出しているのと同じ
  // extraStart（開始1ヶ所＋到達加重。2026-10-03 まで extraBest）を優遇/冷遇の掛け先にする
  // （2026-07-31 要望）。指定が無ければ完全に素通り＝既存のスコア・キーは不変。
  const prefExtraByKind: Record<string, number> = {};
  const valueExtraByKind: Record<string, number> = {};
  const scoreExtraByKind: Record<string, number> = {};
  for (const k of EXTRA_PREF_KINDS) {
    const p = num(colorPrefByTypeRaw?.[k], 0);
    if (p !== 0) prefExtraByKind[k] = p;
  }

  const colorPrefScoreByType: AxisByType = zeroAxis();
  let colorPrefScore = 0;
  if (wColorPref !== 0) {
    for (const [k, p] of Object.entries(prefExtraByKind)) {
      const value = extraStart[k]?.total ?? 0;
      const v = wColorPref * p * value;
      valueExtraByKind[k] = value;
      scoreExtraByKind[k] = v;
      colorPrefScore += v;
    }
    for (const t of PLANET_TYPES) {
      const v = wColorPref * prefByType[t] * (planetTypeTotals[t] ?? 0);
      colorPrefScoreByType[t] = v;
      colorPrefScore += v;
    }
  }
  const totalScore = imbalanceScore + colorPrefScore;

  const excludedPlanetCounts = collectExcludedPlanetCountsBestEffort(extracted);

  return {
    score: totalScore,
    breakdown: {
      // 色ごとの種別別の値（代表種族の byKind、eval_v7）。船接触・船星系の素の合算は audit の
      // scout.byType / scoutCore.byType に残る。
      axesByType: aggByKind,
      planetTypeTotals,
      imbalance: { metric, value: imbalanceValue, score: imbalanceScore },
      colorPreference:
        wColorPref !== 0 || PLANET_TYPES.some((t) => prefByType[t] !== 0)
          ? {
              wColorPref,
              prefByType,
              valueByType: planetTypeTotals,
              scoreByType: colorPrefScoreByType,
              score: colorPrefScore,
              ...(Object.keys(prefExtraByKind).length > 0
                ? { prefExtraByKind, valueExtraByKind, scoreExtraByKind }
                : {}),
            }
          : undefined,
      audit: {
        outerCountByType,
        touchCountByType,
        // 端の罰点「欠けマス × w」の記録（2026-10-04、eval_v4）
        ...(wRimGap !== 0
          ? { rimGap: { w: wRimGap, range: RIM_GAP_RANGE, ringCells: RIM_GAP_RING_CELLS, missingByCell: rimMissingByCell } }
          : {}),
        // PROTO/ASTEROID 分（種別ごとの単純合算。表示のフォールバック用。2026-07-30）
        outerExtraByKind,
        touchExtraByKind,
        outerCountExtraByKind,
        touchCountExtraByKind,
        // 開始地点＋到達加重の集計の記録と、原始・小惑星の行の値（2026-10-03。extraBest の後継）
        startAccess,
        ...(Object.keys(extraStart).length > 0 ? { extraStart } : {}),
        outerHits,
        touchHits,
        scout: {
          radius: scoutRadius,
          attributionModeForScoutCore: scoutCoreAttributionMode,
          scoutWeightByScoutKey: wScoutByScoutKey ?? null,
          scoutPlanetsByScoutKey: Object.fromEntries(Array.from(scoutPlanetKeySetByScoutKey.entries()).map(([k,v])=>[k, v.size])),
          perScout,
          byType: scoutAxis,
          distanceHistogram: scoutDistanceHistogram,
          scoutPlanetCount: scoutPlanetKeySet.size,
          extraByKind: scoutExtraByKind,
          excludedPlanetCounts,
          scoutHits,
        },
        scoutCore: {
          radius: 2,
          // 船星系の成立に必要な「距離1〜2の船接触惑星の数」（2026-07-30 に 1 -> 2）
          minScoutPlanets: MIN_SCOUT_PLANETS_FOR_CORE,
          attributionMode: scoutCoreAttributionMode,
          scoutCoreWeightByScoutKey: wScoutCoreByScoutKey ?? null,
          byType: scoutCoreAxis,
          perScoutPlanet,
          distanceHistogram: scoutCoreDistanceHistogram,
          extraByKind: scoutCoreExtraByKind,
          coreHits: scoutCoreHits,
        },
      },
      debug: (extracted as any).audit,
    },
  };
}
