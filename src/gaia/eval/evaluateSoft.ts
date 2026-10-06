// src/gaia/eval/evaluateSoft.ts
//
// SSOT (soft):
// - 惑星ごとに outer/touch/scout/scoutCore/gaia/cluster の値を持ち（perPlanet）、
//   色ごとの値は「開始地点＋到達加重」で足す（reachCost.ts、2026-10-03）
// - outer/touch は端の罰点「欠けマス × wRimGap」（2026-10-04、eval_v4）
// - planetTypeTotals = outer + touch + scout + scoutCore (+ gaia + cluster)
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
import { connectedComponents } from "../logicalMap/buildLogicalMap";
import {
  BASIC_FACTION_ORDER,
  BASIC_REACH_PROFILES,
  HOP_COST_BY_DISTANCE,
  LF_FACTION_ORDER,
  LF_REACH_PROFILES,
  REACH_DECAY,
  REACH_FREE_COST,
  RIM_GAP_RANGE,
  RIM_GAP_RING_CELLS,
  START_COUNT_LF,
  hopCostForBasicFaction,
  hopCostForLfFaction,
  missingCellsWithin,
  planStarts,
  stoneCostForBasicFaction,
  stoneCostForLfFaction,
  type PlanetNode,
  type StartPlan,
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

  // ===== 基本版専用の新評価軸（2026-07-23、フィールド省略でLF挙動・キー不変） =====
  // ガイア近接: 各通常惑星(基本7色)から距離1/2/3にある「全ガイア惑星」を合算加点
  // （TRANSDIMは対象外、最近傍のみではなく合算＝ユーザー確定）。
  // 例: 距離1にガイア2個 => その惑星の色に wGaiaDist1×2。
  wGaiaDist1?: number;
  wGaiaDist2?: number;
  wGaiaDist3?: number;

  // 星系(密集クラスタ): kind==="planet" の全セル（ガイア/次元横断含む=H5と同じ連結定義）を
  // 6方向隣接で連結し、サイズn>=2の各クラスタについて「含まれる各基本色」に
  // +n×wClusterSize を加点（同色が複数あっても色ごとに1回＝ユーザー確定）。
  wClusterSize?: number;
};


/** 開始地点＋到達加重の集計での、惑星1つぶんの記録（マーカーと説明用） */
export type StartAccessPlanet = {
  cellKey: string;
  /** 惑星の種別（基本7色 / GAIA / TRANSDIM / PROTO / ASTEROID）。eval_v6 から（それ以前の記録には無い） */
  kind?: string;
  /** 開始地点からの到達コスト（開始地点は 0、到達不能は Infinity） */
  cost: number;
  /** 値に掛けた重み（開始地点は 1、残りは到達係数） */
  weight: number;
  /** 重みを掛ける前の惑星の値（基本色は最外周/外周込み） */
  value: number;
};

/** 種族1つぶんの「開始地点＋到達加重」の集計（eval_v5） */
export type FactionStart = {
  /** 母星色（基本7色）か PROTO / ASTEROID */
  color: string;
  /** 開始地点のセル座標（ゼノ族 3・ダー・シュワーム人 1・LF4種族 1・他 2） */
  starts: string[];
  scout: number;
  core: number;
  gaia: number;
  cluster: number;
  outer: number;
  touch: number;
  total: number;
  /** 入植先の全惑星（同色（同種別）＋ eval_v6 からはガイア・次元横断）の到達コスト・重み・値 */
  planets: StartAccessPlanet[];
};

export type SoftBreakdown = {
  axesByType: {
    outer: AxisByType;
    touch: AxisByType;
    scout: AxisByType;
    scoutCore: AxisByType;
    /** 基本版のみ（wGaiaDist1..3 のいずれかが非0のときだけ存在） */
    gaia?: AxisByType;
    /** 基本版のみ（wClusterSize が非0のときだけ存在） */
    cluster?: AxisByType;
  };

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
    };
    /**
     * 原始・小惑星の行の値（extraBest の後継、2026-10-03）。その種別を母星にする2種族のうち
     * 値の大きい方（案A）。係数は掛けない（LF4種族は開始建物が1つなので、その実態のまま）。
     * outer/touch は eval_v4 から（端の罰点を原始・小惑星にも掛ける）。
     */
    extraStart?: Record<
      string,
      {
        factionId: string;
        cellKey: string;
        scout: number;
        core: number;
        gaia: number;
        cluster: number;
        outer?: number;
        touch?: number;
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

    /** 基本版のみ（ガイア近接軸が有効なときだけ存在） */
    gaiaProximity?: {
      byType: AxisByType;
      hitCount: number;
      gaiaCellCount: number;
      weights: { d1: number; d2: number; d3: number };
      /** PROTO/ASTEROID 分（軸には入らない表示用） */
      extraByKind?: Record<string, number>;
      /** マーカー用の座標付きヒット（得点した惑星側） */
      gaiaHits?: Array<{ cellKey: string; planetType: string; distance: number; value: number }>;
    };

    /** 基本版のみ（星系クラスタ軸が有効なときだけ存在） */
    cluster?: {
      byType: AxisByType;
      weight: number;
      /** size=素の個数、weightedSize=次元横断を0.5で数えた重み付きの大きさ（得点はこちら） */
      clusters: Array<{ size: number; weightedSize?: number; colors: string[] }>;
      /** PROTO/ASTEROID 分（軸には入らない表示用） */
      extraByKind?: Record<string, number>;
      /** マーカー用の座標付きヒット（クラスタ構成セルすべて） */
      clusterHits?: Array<{ cellKey: string; planetType: string; size: number }>;
    };
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

/** 星系の大きさを数えるときの次元横断惑星の価値（他の惑星の半分。2026-07-30 ユーザー確定） */
export const CLUSTER_TRANSDIM_WEIGHT = 0.5;

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
   * 惑星ごとの軸の値（2026-10-03）。基本7色と原始・小惑星の全惑星について、
   * 船接触・船星系・ガイア・星系・最外周・外周を惑星単位で持つ。
   * 色ごとの値は、この惑星ごとの値を「開始地点＋到達加重」で足して作る（下の集計を参照）。
   * 星系は「その惑星が属する星系の大きさ」なので、同じ星系の同色2つはどちらも同じ値を持つ。
   * eval_v6（2026-10-06）からはガイア・次元横断の惑星も持つ（船接触・船星系・星系・端の罰点。
   * ガイア近接は自分には付けない）。各種族の入植先として到達加重で足される（開始地点にはならない）。
   */
  type PlanetAcc = {
    key: string;
    kind: string;
    type: PlanetType | null;
    scout: number;
    core: number;
    gaia: number;
    cluster: number;
    outer: number;
    touch: number;
  };
  const perPlanet = new Map<string, PlanetAcc>();
  for (const p of extracted.planetCells) {
    const type = toPlanetType((p as any).planetKind as any, (p as any).colorKey);
    const kind = type ?? (String((p as any).planetKind ?? "").toUpperCase() || "UNKNOWN");
    if (!type && kind !== "PROTO" && kind !== "ASTEROID") continue;
    perPlanet.set(p.key, { key: p.key, kind, type, scout: 0, core: 0, gaia: 0, cluster: 0, outer: 0, touch: 0 });
  }
  // ガイア・次元横断（planetCells からは除外されている）。eval_v6 から入植先として惑星ごとの値を持つ。
  // 船接触惑星（船星系の起点）・ガイア近接の対象・軸の色ごとの合算（byType / extraByKind）には入れない。
  const excludedPlanetCells = (extracted.cells ?? []).filter((c) => (c as any).isPlanet && (c as any).isExcludedPlanet);
  for (const p of excludedPlanetCells) {
    const kind = String((p as any).planetKind ?? "").toUpperCase();
    if (kind !== "GAIA" && kind !== "TRANSDIM") continue;
    perPlanet.set(p.key, { key: p.key, kind, type: null, scout: 0, core: 0, gaia: 0, cluster: 0, outer: 0, touch: 0 });
  }
  const addPlanetAxis = (cellKey: string, axis: "scout" | "core" | "gaia" | "cluster" | "outer" | "touch", v: number) => {
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

  // ===== gaia proximity (基本版専用; フィールド省略時は完全スキップ=LF不変) =====
  const wGaia1 = num((params as any).wGaiaDist1, 0);
  const wGaia2 = num((params as any).wGaiaDist2, 0);
  const wGaia3 = num((params as any).wGaiaDist3, 0);
  const gaiaEnabled = wGaia1 !== 0 || wGaia2 !== 0 || wGaia3 !== 0;

  const gaiaAxis = zeroAxis();
  const gaiaExtraByKind: Record<string, number> = {};
  // マーカー用の座標付きヒット。得点した惑星側にマークする（outer/touch/scout と同じ作法）。
  const gaiaHits: Array<{ cellKey: string; planetType: string; distance: number; value: number }> = [];
  let gaiaHitCount = 0;
  let gaiaCellCount = 0;
  if (gaiaEnabled) {
    const gaiaCells = (extracted.cells ?? []).filter(
      (c) => (c as any).isPlanet && String((c as any).planetKind ?? "").toUpperCase() === "GAIA"
    );
    gaiaCellCount = gaiaCells.length;
    // PROTO/ASTEROID も拾うため planetCells を回す。軸へ足すのは基本7色だけなので
    // gaiaAxis / gaiaHitCount は従来と同値（スコア不変）。
    for (const p of extracted.planetCells) {
      const t = toPlanetType((p as any).planetKind as any, (p as any).colorKey);
      const kindU = String((p as any).planetKind ?? "").toUpperCase() || "UNKNOWN";
      for (const g of gaiaCells) {
        const d = axialDistance(p.q, p.r, (g as any).q, (g as any).r);
        const w = d === 1 ? wGaia1 : d === 2 ? wGaia2 : d === 3 ? wGaia3 : 0;
        if (w === 0) continue;
        addPlanetAxis(p.key, "gaia", w);
        if (t) {
          gaiaAxis[t] += w;
          gaiaHitCount += 1;
        } else {
          gaiaExtraByKind[kindU] = (gaiaExtraByKind[kindU] ?? 0) + w;
        }
        gaiaHits.push({ cellKey: p.key, planetType: t ?? kindU, distance: d, value: w });
      }
    }
    gaiaHits.sort((a, b) => String(a.cellKey).localeCompare(String(b.cellKey)) || a.distance - b.distance);
  }

  // ===== cluster / 星系 (基本版専用; フィールド省略時は完全スキップ=LF不変) =====
  // 連結対象は kind==="planet" の全セル（ガイア/次元横断含む＝H5と同じ定義）。
  // サイズn>=2の各クラスタについて「含まれる各基本色」に +n×wClusterSize（色ごとに1回）。
  const wCluster = num((params as any).wClusterSize, 0);
  const clusterEnabled = wCluster !== 0;

  const clusterAxis = zeroAxis();
  const clusterExtraByKind: Record<string, number> = {};
  // マーカー用の座標付きヒット。クラスタを構成するセルすべてを対象にする
  // （軸へ効くのは基本7色だけだが、◎で軸全体を出したときに星系の形が見えるように）。
  const clusterHits: Array<{ cellKey: string; planetType: string; size: number }> = [];
  const clusterList: Array<{ size: number; weightedSize: number; colors: string[] }> = [];
  if (clusterEnabled) {
    const planetPts = (extracted.cells ?? []).filter((c) => (c as any).isPlanet);
    const cellByKey = new Map(planetPts.map((c) => [`${c.q},${c.r}`, c]));
    const comps = connectedComponents(planetPts.map((c) => ({ q: c.q, r: c.r })));
    for (const comp of comps) {
      if (comp.length < 2) continue;
      const colorSet = new Set<PlanetType>();
      const extraSet = new Set<string>();
      // クラスタの「大きさ」は素の個数ではなく重み付き（2026-07-30 ユーザー確定）。
      // 次元横断惑星は1ラウンド目に入植できないので他の惑星の半分で数える。
      let weightedSize = 0;
      // weightedSize が確定してから惑星ごとの寄与へ配るので、セルをいったん覚えておく。
      const cellKeysInComp: string[] = [];
      for (const pos of comp) {
        const c = cellByKey.get(`${pos.q},${pos.r}`);
        if (!c) continue;
        const t = toPlanetType((c as any).planetKind as any, (c as any).colorKey);
        const kindU = String((c as any).planetKind ?? "").toUpperCase() || "UNKNOWN";
        weightedSize += kindU === "TRANSDIM" ? CLUSTER_TRANSDIM_WEIGHT : 1;
        if (t) colorSet.add(t);
        else extraSet.add(kindU);
        cellKeysInComp.push(String((c as any).key));
        clusterHits.push({ cellKey: (c as any).key, planetType: t ?? kindU, size: comp.length });
      }
      // 監査用の「色ごとに1回」の合算（旧 axesByType の定義。cluster.byType に残す）
      for (const t of colorSet) clusterAxis[t] += wCluster * weightedSize;
      for (const k of extraSet) clusterExtraByKind[k] = (clusterExtraByKind[k] ?? 0) + wCluster * weightedSize;
      // 惑星ごとの方は「その惑星が属するクラスタの大きさ」なので、同じクラスタに
      // 同色が2つあればどちらも同じ値を持つ（色ごとの合算とは意図的に違う。2026-10-03 から
      // 評価の軸はこちらを使う）。
      for (const cellKey of cellKeysInComp) addPlanetAxis(cellKey, "cluster", wCluster * weightedSize);
      clusterList.push({ size: comp.length, weightedSize, colors: [...colorSet].sort() });
    }
    clusterHits.sort((a, b) => String(a.cellKey).localeCompare(String(b.cellKey)));
    // deterministic ordering for audit
    clusterList.sort((a, b) => b.size - a.size || a.colors.join(",").localeCompare(b.colors.join(",")));

    // 星系の大きさは次元横断を 0.5 で数えるので、色ごとの合計に 0.5 が残ることがある。
    // 評価値に小数を出さないため、ここで丸める（2026-07-31）。クラスタ1つずつ丸めるより
    // 誤差が小さい —— 0.5 が2つあれば合計の時点で打ち消し合う。
    for (const t of PLANET_TYPES) clusterAxis[t] = Math.round(clusterAxis[t]);
    for (const k of Object.keys(clusterExtraByKind)) {
      clusterExtraByKind[k] = Math.round(clusterExtraByKind[k]);
    }
  }

  // ===== 開始地点＋到達加重の集計（2026-10-03 確定。docs/design-notes.md 2.6）=====
  //
  // 色ごとの値 ＝ 開始地点2ヶ所の値 ＋ Σ 残りの同色惑星の値 × 到達係数。開始地点は残りの
  // 到達加重まで含めて総当たりで選ぶ（reachCost.ts）。軸の列も同じ重みで足し、軸ごとに丸めて
  // 評価はその合計にする（列の合計と評価が一致したまま小数が消える。2026-07-31 の方針を踏襲）。
  // 原始・小惑星は LF4種族ごとに開始1ヶ所・種族ごとの入植コストで計算し、行の値は2種族のうち
  // 大きい方（案A）。係数は掛けない。最外周/外周は原始・小惑星の評価に入れない（2026-07-30 確定）。
  const nodes: PlanetNode[] = (extracted.cells ?? extracted.planetCells)
    .filter((c: any) => c.isPlanet)
    .map((c: any) => ({
      key: String(c.key),
      q: Number(c.q),
      r: Number(c.r),
      kind: toPlanetType(c.planetKind as any, c.colorKey) ?? (String(c.planetKind ?? "").toUpperCase() || "UNKNOWN"),
    }));
  const AXES = ["outer", "touch", "scout", "core", "gaia", "cluster"] as const;
  type AxisKey = (typeof AXES)[number];
  // 惑星の値は6軸の和。端の罰点（outer/touch）は基本7色も原始・小惑星も入れる（eval_v4）。
  const planetValue = (e: PlanetAcc) => e.scout + e.core + e.gaia + e.cluster + e.outer + e.touch;
  const weightedAxes = (plan: StartPlan, members: PlanetAcc[]): Record<AxisKey, number> => {
    const sums: Record<AxisKey, number> = { outer: 0, touch: 0, scout: 0, core: 0, gaia: 0, cluster: 0 };
    for (const e of members) {
      const w = plan.weights.get(e.key) ?? 0;
      for (const ax of AXES) sums[ax] += w * e[ax];
    }
    const rounded = {} as Record<AxisKey, number>;
    for (const ax of AXES) rounded[ax] = Math.round(sums[ax]);
    return rounded;
  };
  const planetRows = (plan: StartPlan, members: PlanetAcc[]): StartAccessPlanet[] =>
    members
      .map((e) => ({
        cellKey: e.key,
        kind: e.kind,
        cost: plan.costs.get(e.key) ?? Infinity,
        weight: plan.weights.get(e.key) ?? 0,
        value: planetValue(e),
      }))
      .sort((a, b) => b.weight - a.weight || a.cellKey.localeCompare(b.cellKey));

  const aggOuter = zeroAxis();
  const aggTouch = zeroAxis();
  const aggScout = zeroAxis();
  const aggCore = zeroAxis();
  const aggGaia = zeroAxis();
  const aggCluster = zeroAxis();
  const startByColor: Record<string, { starts: string[]; planets: StartAccessPlanet[] }> = {};
  const allPlanets = [...perPlanet.values()];

  // ===== 種族ごとの集計（2026-10-05 確定、eval_v5。docs/design-notes.md 2.7）=====
  //
  // 基本14種族は母星色の惑星を候補に、種族ごとの開始建物の数・跳躍表・入植コスト
  // （reachCost.ts の BASIC_REACH_PROFILES）で開始地点を選ぶ。LF4種族は原始・小惑星から開始1ヶ所。
  // 色の値（planetTypeTotals）は、その色の2種族のうち total の大きい方＝代表種族の値（案A）。
  // 検索の偏り項と色優遇はこの代表値で従来どおり7色で測り、内訳表は種族の行を出す。
  const byFaction: Record<string, FactionStart> = {};
  const representative: Record<string, string> = {};
  // ガイア・次元横断は全種族の入植先（eval_v6、2026-10-06 ユーザー確定 案B）。開始地点は母星色（母星種別）
  // の惑星からだけ選び、ガイア・次元横断は到着時の入植コスト（ガイア 1、次元横断 2 / ガイア Lv1 開始 1 /
  // イタル人 1.5、LF は種族の表）込みの到達係数で足す。docs/design-notes.md 2.7。
  const destinationExtras = allPlanets.filter((e) => e.kind === "GAIA" || e.kind === "TRANSDIM");
  const planFor = (
    id: string,
    color: string,
    members: PlanetAcc[],
    stoneCost: Parameters<typeof planStarts>[0]["stoneCost"],
    startCount: number,
    hop?: Parameters<typeof planStarts>[0]["hopCost"]
  ): FactionStart | null => {
    if (members.length === 0) return null;
    const destinations = [...members, ...destinationExtras];
    const plan = planStarts({
      nodes,
      candidates: destinations.map((e) => ({ key: e.key, value: planetValue(e) })),
      stoneCost,
      startCount,
      startKeys: new Set(members.map((e) => e.key)),
      ...(hop ? { hopCost: hop } : {}),
    });
    if (!plan) return null;
    const ax = weightedAxes(plan, destinations);
    const entry: FactionStart = {
      color,
      starts: plan.starts,
      scout: ax.scout,
      core: ax.core,
      gaia: ax.gaia,
      cluster: ax.cluster,
      outer: ax.outer,
      touch: ax.touch,
      total: ax.scout + ax.core + ax.gaia + ax.cluster + ax.outer + ax.touch,
      planets: planetRows(plan, destinations),
    };
    byFaction[id] = entry;
    return entry;
  };
  for (const f of BASIC_FACTION_ORDER) {
    const p = BASIC_REACH_PROFILES[f];
    const entry = planFor(
      f,
      p.color,
      allPlanets.filter((e) => e.type === p.color),
      stoneCostForBasicFaction(f),
      p.startCount,
      hopCostForBasicFaction(f)
    );
    if (!entry) continue;
    // 同点は FACTIONS の順で先の種族（決定的にする）
    const cur = representative[p.color];
    if (!cur || entry.total > byFaction[cur].total) representative[p.color] = f;
  }
  for (const t of PLANET_TYPES) {
    const rep = representative[t];
    if (!rep) continue;
    const e = byFaction[rep];
    aggOuter[t] = e.outer;
    aggTouch[t] = e.touch;
    aggScout[t] = e.scout;
    aggCore[t] = e.core;
    aggGaia[t] = e.gaia;
    aggCluster[t] = e.cluster;
    startByColor[t] = { starts: e.starts, planets: e.planets };
  }
  // LF4種族（開始1ヶ所、種族ごとの入植コスト。端の罰点も入る＝eval_v4）。
  // 原始・小惑星の行の値（extraStart）はその種別を母星にする2種族のうち大きい方（案A）。
  type ExtraStart = NonNullable<SoftBreakdown["audit"]["extraStart"]>[string];
  const extraStart: Record<string, ExtraStart> = {};
  for (const f of LF_FACTION_ORDER) {
    const home = LF_REACH_PROFILES[f].home;
    const entry = planFor(f, home, allPlanets.filter((e) => e.kind === home), stoneCostForLfFaction(f), START_COUNT_LF, hopCostForLfFaction(f));
    if (!entry) continue;
    const cur = extraStart[home];
    if (!cur || entry.total > cur.total) {
      extraStart[home] = {
        factionId: f,
        cellKey: entry.starts[0],
        scout: entry.scout,
        core: entry.core,
        gaia: entry.gaia,
        cluster: entry.cluster,
        outer: entry.outer,
        touch: entry.touch,
        total: entry.total,
      };
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
  };

  // totals & imbalance（軸ごとに丸めた値の和なので、内訳表の列の合計と評価が一致する）
  const planetTypeTotals = addAxis(
    addAxis(addAxis(aggOuter, aggTouch), addAxis(aggScout, aggCore)),
    addAxis(aggGaia, aggCluster)
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
      // 軸の列は「開始地点＋到達加重」の重み付き和（2026-10-03）。素の合算は audit の
      // scout.byType / scoutCore.byType / gaiaProximity.byType / cluster.byType に残る。
      axesByType: {
        outer: aggOuter,
        touch: aggTouch,
        scout: aggScout,
        scoutCore: aggCore,
        ...(gaiaEnabled ? { gaia: aggGaia } : {}),
        ...(clusterEnabled ? { cluster: aggCluster } : {}),
      },
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
        ...(gaiaEnabled
          ? {
              gaiaProximity: {
                byType: gaiaAxis,
                hitCount: gaiaHitCount,
                gaiaCellCount,
                weights: { d1: wGaia1, d2: wGaia2, d3: wGaia3 },
                extraByKind: gaiaExtraByKind,
                gaiaHits,
              },
            }
          : {}),
        ...(clusterEnabled
          ? {
              cluster: {
                byType: clusterAxis,
                weight: wCluster,
                clusters: clusterList,
                extraByKind: clusterExtraByKind,
                clusterHits,
              },
            }
          : {}),
      },
      debug: (extracted as any).audit,
    },
  };
}
