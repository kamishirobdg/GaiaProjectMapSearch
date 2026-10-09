// src/gaia/eval/shipInteraction.ts
//
// LF 船の中身とスカウトの位置の相互作用・段階 1（2026-10-08 ユーザー確定 案 (ii) 加重和 α 0.5 → 同日
// 「加重和ではなく掛け算に」＝ 案 (i)。式は同じで α ＝ 1）。
// docs/design-notes.md 2.10「船の相互作用（段階 1）」、TODO.md「LF船の中身と、スカウトの位置の相互作用」。
//
// 背景: 船に乗る基本技術・金枠同盟・アーティファクト（Setup 側の lfShip カテゴリ）はルール上その船へ
// 到達しないと取れないが、Setup の採点は船の位置に関係なく足していた。Map 側には船ごとの船接触
// （船 s から距離 R 以内の惑星の値の合計 C_s）があるので、List / Total でマップとセットアップを組に
// したときだけ、船 s に乗るタイルの種族別の値 T_{s,f} を船接触の相対値で増減する。
//
//   加点_f ＝ Σ_s α × (C_s − C̄) / C̄ × T_{s,f}      C̄ ＝ 使う船の平均の船接触
//
//   α ＝ 1 のとき 補正後の値 ＝ Σ_s (C_s / C̄) × T_{s,f}、つまり船 s のタイルの値を船接触の比 C_s / C̄ で
//   掛け算したものになる（案 (i)）。船接触 0 の船のタイルは 0 になる。
//
//   - Σ_s (C_s − C̄) ＝ 0 なので、T が全船で同じなら加点は 0。合計の桁は現状のまま、近い船のタイルが
//     重く、遠い船のタイルが軽くなるだけ。
//   - α 0 で現状どおり、α 1 で「船接触の比で再配分」（掛け算。ユーザーの懸念どおり極端）。
//     α ≦ 1 なら係数 (1 ＋ α × rel) ≧ 1 − α ≧ 0 で、届かない船のタイルも (1 − α) は残る。
//   - 検索（Map の評価）には入れない。船ごとの内訳（scoutHits の scoutId）を持たない古い候補や
//     基本版（船なし）は加点 0 ＝ 現状どおり。
//   - α は調整必須のマジックナンバー（実測は scripts/_probe_ship_interaction.ts）。
//
// 2026-10-09 案 (ii-f)（ユーザー採用）: 船接触を**種族ごと**に。C_{s,f} ＝ Σ_{船 s の近くの惑星 p} w_f(p) × 船接触(p)。
//   w_f は eval_v7 の種族ごとの到達係数（byFaction[f].planets の weight、開始地点は 1）。段階 1 の全種族共通の C_s では
//   船どうしの差が ±10〜20% しか無く、α 1（掛け算）でも加点が Setup の値の 0.4% に留まったため。
//   byFaction を持たない古い候補は共通の C_s（段階 1）に後退する。docs/tuning-guide.md。

import { FACTION_IDS, type FactionId } from "./factionWeights";
import type { FactionScores } from "./factionEval";
import { shipTileCell, tileValueCell } from "./tileWeights";
import { DEFAULT_SETUP_WEIGHTS, SETUP_SCORE_DIVISOR, type SetupWeights } from "./setupWeights";
import { SHIP_IDS, type SetupResult, type ShipId } from "@/gaia/setup/types";

/**
 * 船接触の相対値に掛ける係数（0 ＝ 無効、1 ＝ 船接触の比 C_s / C̄ で掛け算＝案 (i)、0 < α < 1 ＝ 加重和＝案 (ii)）。
 * 2026-10-08: 0.5（案 (ii)）で実測したところ効きがごく小さく、ユーザー指示で 1（掛け算）に。調整必須のマジックナンバー。
 */
export const SHIP_INTERACTION_ALPHA = 1;

export type ShipContact = Partial<Record<ShipId, number>>;

function zeroScores(): FactionScores {
  const out = {} as FactionScores;
  for (const f of FACTION_IDS) out[f] = 0;
  return out;
}

const isShipId = (s: string): s is ShipId => (SHIP_IDS as readonly string[]).includes(s);

/**
 * Map の評価内訳から、船ごとの船接触の合計 C_s（その船から距離 R 以内の惑星の船接触の値の和）。
 * `audit.scout.scoutHits` の scoutId で集計する。ヒットが無い（基本版、または scoutId を持たない
 * 古い候補）なら null ＝ 相互作用なし。
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function shipContactOf(mapBreakdown: any): ShipContact | null {
  const hits = mapBreakdown?.audit?.scout?.scoutHits;
  if (!Array.isArray(hits) || hits.length === 0) return null;
  const out: ShipContact = {};
  let any = false;
  for (const h of hits) {
    const id = String(h?.scoutId ?? "");
    if (!isShipId(id)) continue;
    const v = Number(h?.value) || 0;
    out[id] = (out[id] ?? 0) + v;
    any = true;
  }
  return any ? out : null;
}

/**
 * 船 s に乗るタイルの種族別の値 T_{s,f}。船の基本技術・金枠同盟はその船、アーティファクトは
 * トワイライト（アーティファクト枠を持つ船）。lfShip の係数と SETUP_SCORE_DIVISOR を掛けて
 * `setupFactionBreakdown` の lfShip と同じ桁にする（全船の和 ＝ lfShip の列）。
 */
export function shipTileValuesByShip(result: SetupResult, weights?: SetupWeights): Partial<Record<ShipId, FactionScores>> {
  const out: Partial<Record<ShipId, FactionScores>> = {};
  if (result.mode !== "lostFleet") return out;
  const w = weights ?? DEFAULT_SETUP_WEIGHTS;
  const scale = w.lfShip / SETUP_SCORE_DIVISOR;
  const add = (ship: ShipId, cell: Partial<Record<FactionId, number>> | undefined) => {
    if (!cell) return;
    const row = (out[ship] ??= zeroScores());
    for (const [f, v] of Object.entries(cell)) row[f as FactionId] += (v ?? 0) * scale;
  };
  for (const [ship, id] of Object.entries(result.shipTech ?? {})) if (id && isShipId(ship)) add(ship, shipTileCell(id, ship, true));
  for (const [ship, id] of Object.entries(result.goldFederations ?? {})) if (id && isShipId(ship)) add(ship, shipTileCell(id, ship, true));
  for (const id of result.artifacts ?? []) add("twilight", tileValueCell(id, true));
  return out;
}

/**
 * 種族ごとの到達係数 w_f(惑星)（eval_v7 の `audit.startAccess.byFaction[f].planets`。cellKey → min(1, weight)）。
 * 開始地点の重みは 1（ダー・シュワーム人は値の倍率 1.5 が入っているので 1 に丸める）。
 * byFaction を持たない古い候補・基本版は null。
 */
export type FactionReach = Partial<Record<FactionId, Map<string, number>>>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function factionReachOf(mapBreakdown: any): FactionReach | null {
  const bf = mapBreakdown?.audit?.startAccess?.byFaction;
  if (!bf || typeof bf !== "object") return null;
  const out: FactionReach = {};
  let any = false;
  for (const f of FACTION_IDS) {
    const planets = bf[f]?.planets;
    if (!Array.isArray(planets)) continue;
    const m = new Map<string, number>();
    for (const p of planets) {
      const k = String(p?.cellKey ?? "");
      const w = Number(p?.weight) || 0;
      if (k && w > 0) m.set(k, Math.min(1, w));
    }
    out[f] = m;
    any = true;
  }
  return any ? out : null;
}

/**
 * 種族ごとの船接触 C_{s,f} ＝ Σ_{船 s のヒット h} w_f(h.planetKey) × h.value（案 (ii-f)、2026-10-09 ユーザー採用）。
 * 「その船の近くの惑星に、この種族がどれだけ届くか」。船接触の値（船からの距離の減衰と船ごとの評価指数）は
 * Map 側のまま、種族の到達係数で重み付けするだけ。種別の係数（他色 0.25 など）は掛けない
 * （届くかどうかを測るので、入植したいかどうかの係数は入れない。調整候補）。
 */
export function shipContactByFaction(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  mapBreakdown: any,
  reach: FactionReach
): Partial<Record<FactionId, ShipContact>> | null {
  const hits = mapBreakdown?.audit?.scout?.scoutHits;
  if (!Array.isArray(hits) || hits.length === 0) return null;
  const out: Partial<Record<FactionId, ShipContact>> = {};
  let any = false;
  for (const f of FACTION_IDS) {
    const m = reach[f];
    if (!m) continue;
    const c: ShipContact = {};
    for (const h of hits) {
      const id = String(h?.scoutId ?? "");
      if (!isShipId(id)) continue;
      const w = m.get(String(h?.planetKey ?? "")) ?? 0;
      if (w <= 0) continue;
      c[id] = (c[id] ?? 0) + w * (Number(h?.value) || 0);
    }
    out[f] = c;
    any = true;
  }
  return any ? out : null;
}

export type ShipInteractionByFaction = {
  /** 船ごとの船接触 C_{s,f}（使う船だけ。届かない船は 0） */
  contact: Partial<Record<ShipId, number>>;
  /** 平均 C̄_f */
  mean: number;
  /** 相対値 (C_{s,f} − C̄_f) / C̄_f */
  rel: Partial<Record<ShipId, number>>;
};

export type ShipInteraction = {
  alpha: number;
  /**
   * "faction" ＝ 種族ごとの船接触（案 (ii-f)。eval_v7 以降の byFaction を持つ盤面）、
   * "pooled" ＝ 全種族共通の船接触（段階 1 の尺度。byFaction を持たない古い候補の後退先）
   */
  mode: "faction" | "pooled";
  /** 全種族共通の船接触 C_s とその相対値（参考値。mode pooled ではこれで加点を出す） */
  ships: Array<{ ship: ShipId; contact: number; rel: number }>;
  /** 全種族共通の平均の船接触 C̄ */
  mean: number;
  /** mode faction のとき、種族ごとの船接触・平均・相対値。C̄_f が 0 の種族（どの船にも届かない）は共通の相対値に後退 */
  byFaction?: Partial<Record<FactionId, ShipInteractionByFaction>>;
  /** 種族ごとの加点（Setup の値に足す。桁は Setup の評価値と同じ） */
  bonus: FactionScores;
};

/**
 * 加点を計算する。材料（船接触・船のタイル）が無い、または船接触の平均が 0 なら null。
 * 使う船は result.ships（無ければ 4 隻）。船接触の無い船は C_s ＝ 0 として平均に入れる。
 *
 *   加点_f ＝ Σ_s α × rel_{s,f} × T_{s,f}
 *   rel_{s,f} ＝ (C_{s,f} − C̄_f) / C̄_f（mode faction）、(C_s − C̄) / C̄（mode pooled）
 */
export function shipInteractionOf(
  result: SetupResult,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  mapBreakdown: any,
  weights?: SetupWeights,
  alpha: number = SHIP_INTERACTION_ALPHA
): ShipInteraction | null {
  if (!(alpha > 0) || result.mode !== "lostFleet") return null;
  const contact = shipContactOf(mapBreakdown);
  if (!contact) return null;
  const tiles = shipTileValuesByShip(result, weights);
  const ships = (result.ships && result.ships.length > 0 ? result.ships : SHIP_IDS).filter(isShipId);
  if (ships.length === 0) return null;
  const mean = ships.reduce((a, s) => a + (contact[s] ?? 0), 0) / ships.length;
  if (!(mean > 0)) return null;
  const rows = ships.map((s) => ({ ship: s, contact: contact[s] ?? 0, rel: ((contact[s] ?? 0) - mean) / mean }));
  const pooledRel: Partial<Record<ShipId, number>> = {};
  for (const r of rows) pooledRel[r.ship] = r.rel;

  // 種族ごとの船接触（案 (ii-f)）。材料が無ければ共通の船接触で（段階 1）
  const reach = factionReachOf(mapBreakdown);
  const perFaction = reach ? shipContactByFaction(mapBreakdown, reach) : null;
  const byFaction: Partial<Record<FactionId, ShipInteractionByFaction>> = {};
  const relFor = (f: FactionId): Partial<Record<ShipId, number>> => {
    const c = perFaction?.[f];
    if (!c) return pooledRel;
    const cs: Partial<Record<ShipId, number>> = {};
    let sum = 0;
    for (const s of ships) {
      cs[s] = c[s] ?? 0;
      sum += cs[s]!;
    }
    const m = sum / ships.length;
    if (!(m > 0)) {
      byFaction[f] = { contact: cs, mean: 0, rel: pooledRel };
      return pooledRel;
    }
    const rel: Partial<Record<ShipId, number>> = {};
    for (const s of ships) rel[s] = ((cs[s] ?? 0) - m) / m;
    byFaction[f] = { contact: cs, mean: m, rel };
    return rel;
  };

  const bonus = zeroScores();
  for (const f of FACTION_IDS) {
    const rel = relFor(f);
    let b = 0;
    for (const s of ships) {
      const t = tiles[s]?.[f] ?? 0;
      if (t === 0) continue;
      b += alpha * (rel[s] ?? 0) * t;
    }
    bonus[f] = b;
  }
  return { alpha, mode: perFaction ? "faction" : "pooled", ships: rows, mean, ...(perFaction ? { byFaction } : {}), bonus };
}

/** Setup の評価値に加点を足した写し（加点が無ければそのまま返す）。 */
export function applyShipInteraction(setupScores: FactionScores, si: ShipInteraction | null): FactionScores {
  if (!si) return setupScores;
  const out = { ...setupScores };
  for (const f of FACTION_IDS) out[f] = (out[f] ?? 0) + (si.bonus[f] ?? 0);
  return out;
}
