// src/gaia/constraints.ts
import type { ExtractedForEval, HardParams } from "./eval/extractForEval";
import { axialDistance } from "./hex";
import { connectedComponents } from "./logicalMap/buildLogicalMap";

export type HardFailReason =
  | "H0_SAME_KIND_ADJ"
  | "H1_MIN_DIST"
  | "H2_OUTER_CAP"
  | "H4_CENTER_LARGE14"
  | "H5_CONNECTED_CAP";

export type HardCheckResult =
  | { pass: true }
  | { pass: false; reasons: Array<{ reason: HardFailReason; detail: string }> };

export function checkHardConstraints(
  extracted: ExtractedForEval,
  placement: Array<{ slotId: string; sectorId: string; rot: number; rotSeed?: number }>,
  params: HardParams
): HardCheckResult {
  const reasons: Array<{ reason: HardFailReason; detail: string }> = [];

  const h0 = checkH0SameKindAdjacency(extracted, params.banSameKindAdjacency);
  if (!h0.pass) reasons.push(...h0.reasons);

  const h1 = checkH1MinDist(extracted, params.minSameColorDist);
  if (!h1.pass) reasons.push(...h1.reasons);

  const h2 = checkH2OuterColorCap(extracted, params.outerSameColorMax);
  if (!h2.pass) reasons.push(...h2.reasons);

  const h4 = checkH4CenterLarge14(extracted, placement, params.centerMode);
  if (!h4.pass) reasons.push(...h4.reasons);

  const h5 = checkH5ConnectedCap(extracted, params.maxConnectedPlanets, params.h5IncludeScouts);
  if (!h5.pass) reasons.push(...h5.reasons);

  return reasons.length ? { pass: false, reasons } : { pass: true };
}

/**
 * H0（合法性・基本版ルールブックp19太字注意書き）:
 * 「同じ種類の2つの惑星は、決して直接隣接してはいけません」
 * - 対象は基本7色のみ（normalPlanetCells）。GAIA/TRANSDIM は「種類」に含まない
 *   （ユーザー確定 2026-07-23、docs/map-base-spec.md §6-1）。
 * - enabled が falsy なら無効（LFテンプレは従来どおりチェックなし）。
 * - タイル内部の印刷配置は常に合法なので、実質タイル境界を跨ぐ隣接の検査。
 */
export function checkH0SameKindAdjacency(
  extracted: ExtractedForEval,
  enabled: boolean | undefined
): HardCheckResult {
  if (!enabled) return { pass: true };

  const reasons: Array<{ reason: HardFailReason; detail: string }> = [];

  const byColor: Record<string, Array<{ q: number; r: number; key?: string }>> = {};
  for (const c of extracted.normalPlanetCells ?? []) {
    const ck = String(c.colorKey ?? "");
    if (!ck) continue;
    (byColor[ck] ??= []).push({ q: c.q, r: c.r, key: c.key });
  }

  for (const [color, list] of Object.entries(byColor)) {
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        if (axialDistance(list[i].q, list[i].r, list[j].q, list[j].r) === 1) {
          reasons.push({
            reason: "H0_SAME_KIND_ADJ",
            detail: `color=${color} adjacent pair ${list[i].key ?? "?"} - ${list[j].key ?? "?"}`,
          });
        }
      }
    }
  }

  return reasons.length ? { pass: false, reasons } : { pass: true };
}

export function checkH1MinDist(extracted: ExtractedForEval, minDist: number): HardCheckResult {
  const reasons: Array<{ reason: HardFailReason; detail: string }> = [];

  // SSOT: LogicalMap抽出(normalPlanetCells)から色別に再構成して判定する
  // - extracted.normalPlanetsByColor が欠けていても Hard が無効化されないようにする
  const cells = Array.isArray((extracted as any)?.normalPlanetCells) ? ((extracted as any).normalPlanetCells as any[]) : [];

  const byColor: Record<string, Array<{ q: number; r: number; key?: string }>> = {};
  for (const c of cells) {
    const ck = String((c as any)?.colorKey ?? "");
    if (!ck) continue;
    const q = Number((c as any)?.q);
    const r = Number((c as any)?.r);
    if (!Number.isFinite(q) || !Number.isFinite(r)) continue;
    (byColor[ck] ??= []).push({ q, r, key: (c as any)?.key });
  }

  for (const [color, list] of Object.entries(byColor)) {
    let best = Infinity;
    let bestPair: { a?: string; b?: string; d?: number } | null = null;

    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const d = axialDistance(list[i].q, list[i].r, list[j].q, list[j].r);
        if (d < best) {
          best = d;
          bestPair = { a: list[i].key, b: list[j].key, d };
        }
        if (best < minDist) break;
      }
      if (best < minDist) break;
    }

    if (best < minDist) {
      const a = bestPair?.a ?? "?";
      const b = bestPair?.b ?? "?";
      const d = bestPair?.d ?? best;
      reasons.push({
        reason: "H1_MIN_DIST",
        detail: `color=${color} minDist=${d} < ${minDist} (pair ${a} - ${b})`,
      });
    }
  }

  return reasons.length ? { pass: false, reasons } : { pass: true };
}

export function checkH2OuterColorCap(extracted: ExtractedForEval, cap: number): HardCheckResult {
  const reasons: Array<{ reason: HardFailReason; detail: string }> = [];

  const cntByColor: Record<string, number> = {};
  for (const cell of extracted.normalPlanetCells ?? []) {
    if (!extracted.outerCells?.has?.(cell.key)) continue;
    const ck = cell.colorKey!;
    cntByColor[ck] = (cntByColor[ck] ?? 0) + 1;
  }

  for (const [color, cnt] of Object.entries(cntByColor)) {
    if (cnt > cap) {
      reasons.push({
        reason: "H2_OUTER_CAP",
        detail: `color=${color} outerCnt=${cnt} > cap=${cap}`,
      });
    }
  }

  return reasons.length ? { pass: false, reasons } : { pass: true };
}

/**
 * H5: 盤面全体（絶対座標）で kind==="planet" の全セル（基本7色 + GAIA + TRANSDIM + PROTO + ASTEROID、
 * 色が違っても隣接していれば同じ塊）を6方向hex隣接で連結し、最大クラスタサイズが maxCap を超えたら却下。
 * - maxCap が undefined または 0 以下なら無効（常にpass）。
 * - 最大サイズ === maxCap は許容（pass）、maxCap+1 以上は却下。
 * - includeScouts=true のとき、探査船(scout)セル（kind==="space"だが tags に "scout:*" を持つセル。
 *   extracted.scoutCells として既に抽出済み）も連結対象に含める（惑星の1種として扱う）。
 */
export function checkH5ConnectedCap(
  extracted: ExtractedForEval,
  maxCap: number | undefined,
  includeScouts?: boolean
): HardCheckResult {
  if (maxCap === undefined || maxCap <= 0) return { pass: true };

  const points = (extracted.cells ?? [])
    .filter((c) => c.kind === "planet")
    .map((c) => ({ q: c.q, r: c.r }));

  if (includeScouts) {
    for (const s of extracted.scoutCells ?? []) {
      points.push({ q: s.q, r: s.r });
    }
  }

  const comps = connectedComponents(points);

  let maxSize = 0;
  for (const comp of comps) {
    if (comp.length > maxSize) maxSize = comp.length;
  }

  if (maxSize > maxCap) {
    return {
      pass: false,
      reasons: [
        {
          reason: "H5_CONNECTED_CAP",
          detail: `maxClusterSize=${maxSize} > cap=${maxCap} (components=${comps.length}, totalPlanetCells=${points.length})`,
        },
      ],
    };
  }

  return { pass: true };
}

export function checkH4CenterLarge14(
  extracted: ExtractedForEval,
  placement: Array<{ slotId: string; sectorId: string; rot: number }>,
  centerMode: HardParams["centerMode"]
): HardCheckResult {
  if (centerMode === "NONE") return { pass: true };

  const reasons: Array<{ reason: HardFailReason; detail: string }> = [];
  const mustBe = new Set(["01", "02", "03", "04"]);

  for (const p of placement ?? []) {
    if (!extracted.centralSlotIds?.has?.(p.slotId)) continue;
    const sid = String(p.sectorId).padStart(2, "0");
    if (!mustBe.has(sid)) {
      reasons.push({
        reason: "H4_CENTER_LARGE14",
        detail: `slot=${p.slotId} sector=${sid} not in {01..04}`,
      });
    }
  }

  return reasons.length ? { pass: false, reasons } : { pass: true };
}
