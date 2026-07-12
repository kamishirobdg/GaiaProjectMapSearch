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
};


export type SoftBreakdown = {
  axesByType: {
    outer: AxisByType;
    touch: AxisByType;
    scout: AxisByType;
    scoutCore: AxisByType;
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

    outerHits: Array<{
      cellKey: string;
      planetType: PlanetType;
      kind: any;
      slotId: string;
      sectorId: string;
      tags: string[];
    }>;
    touchHits: Array<{
      cellKey: string;
      planetType: PlanetType;
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
    scoutKey: string;
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
    scoutPlanetKey: string;
    corePlanetKey: string;
    corePlanetType: string;
    distance: 1 | 2;
    value: number;
  }>;
};
  };

  debug?: any;
};

export type SoftEvalResult = {
  score: number;
  breakdown: SoftBreakdown;
};

const PLANET_TYPES: PlanetType[] = ["BLACK", "BLUE", "BROWN", "ORANGE", "RED", "WHITE", "YELLOW"];

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

  const wScoutEff = num(wScoutByScoutKey?.[s.key], wScout);

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
    }

    total += contrib;
    incNumRecord(scoutDistanceHistogram, d, 1);

    scoutHits.push({
      scoutKey: s.key,
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
  const scoutCoreHits: Array<{ scoutPlanetKey: string; corePlanetKey: string; corePlanetType: string; distance: 1 | 2; value: number }> = [];

  const scoutCoreExtraByKind: Record<string, number> = {};
  const scoutCoreDistanceHistogram: Record<number, number> = {};

  // ScoutCore uses per-scout assigned Scout planets (mode A/B)
if (scoutPlanetKeySetByScoutKey.size > 0) {
  for (const [scoutKey, scoutPlanetKeys] of scoutPlanetKeySetByScoutKey.entries()) {
    const wScoutCoreEff = num(wScoutCoreByScoutKey?.[scoutKey], wScoutCore);
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
        }

        total += contrib;
        incNumRecord(scoutCoreDistanceHistogram, d0, 1);

        scoutCoreHits.push({
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
    const k0 = String(a.scoutKey ?? "").localeCompare(String(b.scoutKey ?? ""));
    if (k0 !== 0) return k0;
    const k = String(a.scoutPlanetKey).localeCompare(String(b.scoutPlanetKey));
    if (k !== 0) return k;
    return String(a.corePlanetKey).localeCompare(String(b.corePlanetKey));
  });

  // totals & imbalance
  const planetTypeTotals = addAxis(addAxis(outerAxis, touchAxis), addAxis(scoutAxis, scoutCoreAxis));

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
      axesByType: { outer: outerAxis, touch: touchAxis, scout: scoutAxis, scoutCore: scoutCoreAxis },
      planetTypeTotals,
      imbalance: { metric, value: imbalanceValue, score: imbalanceScore },
      colorPreference:
        wColorPref !== 0 || PLANET_TYPES.some((t) => prefByType[t] !== 0)
          ? { wColorPref, prefByType, valueByType: planetTypeTotals, scoreByType: colorPrefScoreByType, score: colorPrefScore }
          : undefined,
      audit: {
        outerCountByType,
        touchCountByType,
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
