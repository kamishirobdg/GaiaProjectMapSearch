// src/gaia/eval/evaluateSoft.ts
//
// SSOT (soft):
// - まず outer/touch/scout/scoutCore を「惑星種別別」に集計
// - planetTypeTotals = outer + touch + scout + scoutCore
// - map score は planetTypeTotals の乖離（imbalance）のみ
//
// ScoutCore (確定仕様):
// - Scout惑星 = Scout評価で value>=1 を持った惑星（=Scout半径内でヒット）
// - ScoutCore惑星 = Scout惑星から距離1 or 2 に存在する惑星（自己除外）
// - d=1 => wScoutCore, d=2 => wScoutCore-1
// - 同一ScoutCore惑星に複数Scout惑星がある場合は合算
// - ScoutセルはScoutCoreに関与しない（Scout惑星集合のみが起点）
//
import type { ExtractedForEval, PlanetKind } from "./extractForEval";
import { axialDistance } from "../hex";
import { connectedComponents } from "../logicalMap/buildLogicalMap";

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
  wOuter: number;
  wTouch: number;

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
  };

  audit: {
    outerCountByType: CountByType;
    touchCountByType: CountByType;

    /** PROTO/ASTEROID 分（軸には入らない表示用。値は重み適用後／Count は素の枚数） */
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

    // planetType は基本7色に加え PROTO/ASTEROID も入る（マーカー用）
    outerHits: Array<{
      cellKey: string;
      planetType: PlanetType | string;
      kind: any;
      slotId: string;
      sectorId: string;
      tags: string[];
    }>;
    touchHits: Array<{
      cellKey: string;
      planetType: PlanetType | string;
      kind: any;
      slotId: string;
      sectorId: string;
      tags: string[];
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

/** 星系の大きさを数えるときの次元横断惑星の価値（他の惑星の半分。2026-07-30 ユーザー確定） */
export const CLUSTER_TRANSDIM_WEIGHT = 0.5;

/**
 * 原始・小惑星の「最良の1つ」に掛ける補正値（2026-07-31）。
 *
 * 内訳表の追加行を基本7色の行と同じ物差しで読めるようにするための係数。
 * スコア（planetTypeTotals）には入らない。
 *
 * 実測（`npx tsx scripts/measure_extra_best.ts`、LF 3p/4p 各24盤面・既定の評価指数）:
 *   最良値の平均   PROTO 34.98 / ASTEROID 44.07
 *   基本7色の平均  107.73
 *   → 種別ごとに合わせるなら PROTO 3.08 / ASTEROID 2.44 だが、
 *     それだと「小惑星のほうが条件の良い惑星が多い」という盤面の実態を
 *     打ち消してしまう。両種別まとめた平均 39.53 に対する比 2.73 を
 *     0.25 刻みに丸めて 2.75 を全体で使う。
 *     結果、平均は PROTO 96.2 / ASTEROID 121.2（基本7色平均の -11% / +12%）。
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

function scoutValue(d: number, wScout: number, R: number): number {
  if (d < 1 || d > R) return 0;
  const v = wScout - (d - 1);
  return v > 0 ? v : 0;
}

function scoutCoreValue(d: number, wScoutCore: number): number {
  if (d !== 1 && d !== 2) return 0;
  const v = wScoutCore - (d - 1);
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

  // ===== outer / touch (normal planets only) =====
  const outerCountByType: CountByType = zeroAxis();
  const touchCountByType: CountByType = zeroAxis();

  const outerHits: any[] = [];
  const touchHits: any[] = [];

  for (const p of extracted.normalPlanetCells) {
    const t = toPlanetType((p as any).planetKind as any, (p as any).colorKey);
    if (!t) continue;

    if (extracted.outerCells.has(p.key)) {
      outerCountByType[t] += 1;
      outerHits.push({
        cellKey: p.key,
        planetType: t,
        kind: (p as any).kind,
        slotId: (p as any).slotId,
        sectorId: (p as any).sectorId,
        tags: (p as any).tags ?? [],
      });
    }

    if (extracted.touchCells.has(p.key)) {
      touchCountByType[t] += 1;
      touchHits.push({
        cellKey: p.key,
        planetType: t,
        kind: (p as any).kind,
        slotId: (p as any).slotId,
        sectorId: (p as any).sectorId,
        tags: (p as any).tags ?? [],
      });
    }
  }

  const outerAxis = zeroAxis();
  const touchAxis = zeroAxis();
  for (const t of PLANET_TYPES) {
    outerAxis[t] = -wOuter * outerCountByType[t];
    touchAxis[t] = -wTouch * touchCountByType[t];
  }

  // PROTO/ASTEROID（基本7色に入らない惑星）の最外周/外周。
  // scout/scoutCore の extraByKind と同じ扱いで、監査・表示・マーカー用にだけ集計する。
  // 軸（outerAxis/touchAxis）と planetTypeTotals には入れないのでスコアは不変
  // ＝既存の保存結果・回帰スナップショットに影響しない（2026-07-30）。
  const outerExtraByKind: Record<string, number> = {};
  const touchExtraByKind: Record<string, number> = {};
  const outerCountExtraByKind: Record<string, number> = {};
  const touchCountExtraByKind: Record<string, number> = {};

  /**
   * PROTO/ASTEROID の惑星ごとの寄与（2026-07-31）。
   *
   * 「複数がそこそこ優位であるより、船に近く星系にも近い最良の惑星が1つ」が
   * 望ましい、というユーザー判断（2026-07-30）。種別ごとの単純合算（extraByKind）
   * だと弱い惑星が数だけ多い盤面が高く出るので、惑星ごとに持ち直して
   * 最良の1つを選べるようにする。中身は 船接触＋船星系＋ガイア＋星系 の合計で、
   * 最外周/外周は原始・小惑星の評価に効かないので入れない（2026-07-30 確定）。
   *
   * extraByKind 自体は従来どおり素の合算のまま残す（既存の表示・監査が読むため）。
   * ここから作る extraBest が「最良の1つ×補正値」の表示用。
   */
  const extraByPlanet = new Map<
    string,
    { kind: string; scout: number; core: number; gaia: number; cluster: number }
  >();
  const addExtraPlanet = (
    cellKey: string,
    kind: string,
    axis: "scout" | "core" | "gaia" | "cluster",
    v: number
  ) => {
    if (kind !== "PROTO" && kind !== "ASTEROID") return;
    let e = extraByPlanet.get(cellKey);
    if (!e) {
      e = { kind, scout: 0, core: 0, gaia: 0, cluster: 0 };
      extraByPlanet.set(cellKey, e);
    }
    e[axis] += v;
  };
  for (const p of extracted.planetCells) {
    if (toPlanetType((p as any).planetKind as any, (p as any).colorKey)) continue;
    const kindU = String((p as any).planetKind ?? "").toUpperCase() || "UNKNOWN";
    const hit = {
      cellKey: p.key,
      planetType: kindU,
      kind: (p as any).kind,
      slotId: (p as any).slotId,
      sectorId: (p as any).sectorId,
      tags: (p as any).tags ?? [],
    };
    if (extracted.outerCells.has(p.key)) {
      outerCountExtraByKind[kindU] = (outerCountExtraByKind[kindU] ?? 0) + 1;
      outerExtraByKind[kindU] = (outerExtraByKind[kindU] ?? 0) + -wOuter;
      outerHits.push(hit);
    }
    if (extracted.touchCells.has(p.key)) {
      touchCountExtraByKind[kindU] = (touchCountExtraByKind[kindU] ?? 0) + 1;
      touchExtraByKind[kindU] = (touchExtraByKind[kindU] ?? 0) + -wTouch;
      touchHits.push({ ...hit });
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
      addExtraPlanet(p.key, k, "scout", contrib);
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
  const scoutPlanetsNearPlanet = new Map<string, Set<string>>();
  for (const spKey of scoutPlanetKeySet) {
    const sp = scoutPlanetByKey.get(spKey);
    if (!sp) continue;
    for (const p of extracted.planetCells) {
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

      for (const p of extracted.planetCells) {
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

        if (t) {
          byType[t] += contrib;
          scoutCoreAxis[t] += contrib;
        } else {
          const k = kindU || "UNKNOWN";
          extraByKind[k] = (extraByKind[k] ?? 0) + contrib;
          scoutCoreExtraByKind[k] = (scoutCoreExtraByKind[k] ?? 0) + contrib;
          addExtraPlanet(p.key, k, "core", contrib);
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
        if (t) {
          gaiaAxis[t] += w;
          gaiaHitCount += 1;
        } else {
          gaiaExtraByKind[kindU] = (gaiaExtraByKind[kindU] ?? 0) + w;
          addExtraPlanet(p.key, kindU, "gaia", w);
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
      // このクラスタに含まれる PROTO/ASTEROID のセル。weightedSize が確定してから
      // 惑星ごとの寄与へ配るので、いったん覚えておく（2026-07-31）。
      const extraCellsInComp: Array<{ cellKey: string; kind: string }> = [];
      for (const pos of comp) {
        const c = cellByKey.get(`${pos.q},${pos.r}`);
        if (!c) continue;
        const t = toPlanetType((c as any).planetKind as any, (c as any).colorKey);
        const kindU = String((c as any).planetKind ?? "").toUpperCase() || "UNKNOWN";
        weightedSize += kindU === "TRANSDIM" ? CLUSTER_TRANSDIM_WEIGHT : 1;
        if (t) colorSet.add(t);
        else {
          extraSet.add(kindU);
          extraCellsInComp.push({ cellKey: (c as any).key, kind: kindU });
        }
        clusterHits.push({ cellKey: (c as any).key, planetType: t ?? kindU, size: comp.length });
      }
      for (const t of colorSet) clusterAxis[t] += wCluster * weightedSize;
      // 色ごとに1回、と同じ規則で追加種別にも入れる（表示・マーカー用。スコアには入らない）
      for (const k of extraSet) clusterExtraByKind[k] = (clusterExtraByKind[k] ?? 0) + wCluster * weightedSize;
      // 惑星ごとの方は「その惑星が属するクラスタの大きさ」なので、同じクラスタに
      // 同種別が2つあればどちらも同じ値を持つ（種別ごとの合算とは意図的に違う）。
      for (const e of extraCellsInComp) {
        addExtraPlanet(e.cellKey, e.kind, "cluster", wCluster * weightedSize);
      }
      clusterList.push({ size: comp.length, weightedSize, colors: [...colorSet].sort() });
    }
    clusterHits.sort((a, b) => String(a.cellKey).localeCompare(String(b.cellKey)));
    // deterministic ordering for audit
    clusterList.sort((a, b) => b.size - a.size || a.colors.join(",").localeCompare(b.colors.join(",")));
  }

  // ===== 原始・小惑星の「最良の1つ×補正値」（2026-07-31）=====
  //
  // 種別ごとに、4軸の合計がいちばん大きい惑星を1つ選ぶ。同点はセルキーで安定化。
  // 表示は「その惑星の値 × EXTRA_BEST_FACTOR」で、軸ごとの値も同じ補正を掛けるので
  // 列の合計と評価列が一致する。スコア（planetTypeTotals）には入れないので、
  // 保存済みの結果・回帰スナップショットには影響しない。
  const extraBest: Record<
    string,
    {
      cellKey: string;
      scout: number;
      core: number;
      gaia: number;
      cluster: number;
      /** 補正前の4軸合計（補正値を決め直すときの実測に使う） */
      raw: number;
      factor: number;
      total: number;
    }
  > = {};
  {
    const bestRaw = new Map<string, { cellKey: string; e: { scout: number; core: number; gaia: number; cluster: number }; raw: number }>();
    for (const [cellKey, e] of extraByPlanet) {
      const raw = e.scout + e.core + e.gaia + e.cluster;
      const cur = bestRaw.get(e.kind);
      if (!cur || raw > cur.raw || (raw === cur.raw && cellKey.localeCompare(cur.cellKey) < 0)) {
        bestRaw.set(e.kind, { cellKey, e, raw });
      }
    }
    for (const [kind, b] of bestRaw) {
      const f = EXTRA_BEST_FACTOR;
      extraBest[kind] = {
        cellKey: b.cellKey,
        scout: b.e.scout * f,
        core: b.e.core * f,
        gaia: b.e.gaia * f,
        cluster: b.e.cluster * f,
        raw: b.raw,
        factor: f,
        total: b.raw * f,
      };
    }
  }

  // totals & imbalance
  const planetTypeTotals = addAxis(
    addAxis(addAxis(outerAxis, touchAxis), addAxis(scoutAxis, scoutCoreAxis)),
    addAxis(gaiaAxis, clusterAxis)
  );

  const values = axisValues(planetTypeTotals);
  const imbalanceValue = metric === "range" ? range(values) : std(values);
    const imbalanceScore = -wImbalance * imbalanceValue;

  // ===== color preference (optional) =====
  const prefByType: AxisByType = zeroAxis();
  for (const t of PLANET_TYPES) {
    prefByType[t] = num(colorPrefByTypeRaw?.[t], 0);
  }
  const colorPrefScoreByType: AxisByType = zeroAxis();
  let colorPrefScore = 0;
  if (wColorPref !== 0) {
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
      axesByType: {
        outer: outerAxis,
        touch: touchAxis,
        scout: scoutAxis,
        scoutCore: scoutCoreAxis,
        ...(gaiaEnabled ? { gaia: gaiaAxis } : {}),
        ...(clusterEnabled ? { cluster: clusterAxis } : {}),
      },
      planetTypeTotals,
      imbalance: { metric, value: imbalanceValue, score: imbalanceScore },
      colorPreference:
        wColorPref !== 0 || PLANET_TYPES.some((t) => prefByType[t] !== 0)
          ? { wColorPref, prefByType, valueByType: planetTypeTotals, scoreByType: colorPrefScoreByType, score: colorPrefScore }
          : undefined,
      audit: {
        outerCountByType,
        touchCountByType,
        // PROTO/ASTEROID 分（軸には入らない表示・マーカー用。2026-07-30）
        outerExtraByKind,
        touchExtraByKind,
        outerCountExtraByKind,
        touchCountExtraByKind,
        // 原始・小惑星の「最良の1惑星 × 補正値」（内訳表の追加行はこれを出す。2026-07-31）
        ...(Object.keys(extraBest).length > 0 ? { extraBest } : {}),
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
