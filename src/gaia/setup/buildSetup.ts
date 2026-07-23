// src/gaia/setup/buildSetup.ts
//
// Deterministic seed -> setup roll, mirroring the map side's philosophy:
// the same seed always yields the same setup, so results are snapshot-testable
// and shareable. Evaluation is out of scope here.
//
// Randomization rules (Gaia Project base):
//   - standard tech: shuffle the 9 types; first 6 go one-per-track, next 3 free.
//   - advanced tech: shuffle the 15 tiles; first 6 go one-per-track (rest unseen).
//   - boosters: shuffle the 10; first (players + 3) are available, rest unused.
//   - round scoring: shuffle the physical 10-tile pool (9 entries, the
//     academy/PI tile twice via `copies`); first 6 become rounds 1..6 in
//     order, so the x2 tile can score in up to two rounds.
//   - final scoring: shuffle the 6 tiles; first 2 are used.
//   - federation Lv5: 1 random tile goes to Terraforming research level 5.
//     All 6 types have 3 copies, so drawing a tile uniformly = drawing a type
//     uniformly; the catalog's type list is shuffled directly.
//
// Lost Fleet mode (docs/setup-lostfleet-spec.md):
//   - mixed pools grow (boosters 14, physical scoring 13, final scoring 9,
//     advanced 21). The SAME stream names shuffle the larger id lists, and the
//     7th advanced draw goes to the scoring-board extension.
//   - LF-only elements use NEW streams (shipTech / artifacts / goldFederations
//     / econTileFace / extensionFace), so base-mode output stays byte-identical
//     to the pre-expansion behavior.
//   - at 2 players Rebellion is boxed: 3 ships, 2 ship-tech spaces, 3 gold
//     federations.
//
// Each component draws from an independent RNG stream derived from the seed, so
// adding/removing one component's logic never shifts another's output.

import { mulberry32, hashSeed, shuffleSeeded } from "../board/rng";
import {
  RESEARCH_TRACK_IDS,
  SHIP_IDS,
  TECH_SHIP_IDS,
  type ResearchTrackId,
  type SetupMode,
  type SetupResult,
  type ShipId,
} from "./types";
import { SETUP_CATALOG } from "./data";

export type BuildSetupInput = {
  seed: string;
  /** base: 1..4 / lostFleet: 2..4; controls boosters, artifacts, ships. */
  playerCount?: number;
  /** Omitted = "base". Base-mode output is unchanged by the expansion. */
  mode?: SetupMode;
  /**
   * Lost Fleet only: scoring-board extension face. Omitted = player-count
   * default (2p = "vp25", 3/4p = "shuttle"); "random" rolls it (allowed from
   * the second game on); a face value pins it.
   */
  extensionFaceMode?: "random" | "vp25" | "shuttle";
  /** Lost Fleet only: pin the econ adjustment tile face. Omitted = random. */
  econFaceMode?: "A" | "B";
  /**
   * Ids from AVOID_RULES: forbid specific advanced tech tiles on specific
   * research tracks. Omitted/empty = no constraint (output unchanged).
   */
  avoidRules?: string[];
  /**
   * Ids from AVOID_RULES used in the opposite direction: FORCE one of the
   * rule's tiles onto its track (2026-07-23 三択プルダウン「強制」).
   * Omitted/empty = no constraint. The same rule id must not appear in both
   * avoidRules and forceRules (UI enforces one mode per track).
   */
  forceRules?: string[];
  /**
   * ruleId -> そのルールの tileIds のうち1枚。強制対象をタイル指定する
   * （2026-07-23「強制：タイル名」）。forceRules（強制：ランダム）と同じ
   * ルール id を両方に入れない（UI はトラックごと単一プルダウン）。
   */
  forceTileRules?: Record<string, string>;
  /**
   * ruleId -> そのルールの tileIds のうち1枚。「許容」: 指定タイル以外の
   * セット内タイルを回避する（指定タイル自体は出ても出なくてもよい）。
   */
  allowTileRules?: Record<string, string>;
  /**
   * LF: 距離タイル（TSL2「基本到達距離＋1」）をこの船の基本技術枠に
   * 置かない（2026-07-23）。3隻すべて指定は3人以上では満たせず、
   * 満たせない分は無視される（UI 側で警告）。
   */
  shipDistanceAvoid?: ShipId[];
  /**
   * LF: 距離タイルをこの船の基本技術枠に置く。タイルは1枚しかないため
   * 複数指定時は TECH_SHIP_IDS 順の先頭1隻のみ充足（UI 側で警告）。
   */
  shipDistanceForce?: ShipId[];
  /** LF: リベリオンの金枠同盟に FEDG2「任意の技術タイル1枚」を置く/置かない。 */
  rebellionGoldFed?: "avoid" | "force";
};

/** LF船ルールの対象タイル（データカタログの id）。 */
export const SHIP_DISTANCE_TECH = "TSL2"; // 基本到達距離＋1
export const REBELLION_GOLD_TECH_FED = "FEDG2"; // 金枠同盟：任意の技術タイル1枚

/**
 * Preset placement-avoidance rules for advanced tech tiles (user-curated,
 * 2026-07-24). A violating track gets ONLY ITS OWN tile re-drawn: it is
 * swapped with the first legal spare of the same shuffle, so every other
 * track's draw — and, with no rules active, the entire roll — is unchanged.
 */
export type AvoidRule = {
  id: string;
  track: ResearchTrackId;
  tileIds: string[];
  label: string;
  labelEn: string;
  /** 三択プルダウン用の短い対象名（「〜を置かない」を含まない中立表現） */
  shortLabel: string;
  shortLabelEn: string;
  /** 「許容：タイル名」の選択肢を出すタイル（2026-07-23。省略＝許容なし） */
  allowTiles?: string[];
};

export const AVOID_RULES: AvoidRule[] = [
  {
    id: "gaia-no-gaiaVp",
    track: "gaia",
    tileIds: ["AT08"],
    label: "ガイア計画に「取得時：ガイア惑星×2VP」を置かない",
    labelEn: "Keep \"2 VP per Gaia planet\" off the Gaia Project track",
    shortLabel: "ガイア惑星×2VP",
    shortLabelEn: "2 VP per Gaia planet",
  },
  {
    // 2026-07-23: AT12（取得時：同盟タイル×5VP）をセットに追加（要望）。
    // 既存キー互換のため id は据え置き。回避は両タイルを対象にする。
    id: "terra-no-fedPass",
    track: "terra",
    tileIds: ["AT01", "AT12"],
    label: "惑星改造に「パス時：同盟タイル×3VP」「取得時：同盟タイル×5VP」を置かない",
    labelEn: "Keep the federation VP tiles (pass x3 / immediate x5) off the Terraforming track",
    shortLabel: "同盟VPタイル",
    shortLabelEn: "Federation VP tiles",
    allowTiles: ["AT01", "AT12"],
  },
  {
    id: "eco-no-resourceAction",
    track: "eco",
    tileIds: ["AT03", "AT07", "AT13"],
    label: "経済に資源獲得アクション（QIC1+クレ5／鉱石3／知識3）を置かない",
    labelEn: "Keep resource-action tiles (1 QIC+5c / 3 ore / 3 knowledge) off the Economy track",
    shortLabel: "資源獲得アクション",
    shortLabelEn: "Resource-action tiles",
    allowTiles: ["AT13"],
  },
];

/** Derive an independent RNG stream for a named component of one seed. */
function streamFor(seed: string, stream: string) {
  return mulberry32(hashSeed(`${seed}::${stream}`));
}

function idsOf(tiles: { id: string }[]): string[] {
  return tiles.map((t) => t.id);
}

/** Expand tile types into the physical pool (one entry per copy). */
function physicalPoolOf(tiles: { id: string; copies?: number }[]): string[] {
  const out: string[] = [];
  for (const t of tiles) {
    const n = Math.max(1, Math.floor(t.copies ?? 1));
    for (let i = 0; i < n; i++) out.push(t.id);
  }
  return out;
}

function assignByTrack(ids: string[]): Record<ResearchTrackId, string> {
  const out = {} as Record<ResearchTrackId, string>;
  RESEARCH_TRACK_IDS.forEach((track, i) => {
    out[track] = ids[i];
  });
  return out;
}

export function buildSetupFromSeed(input: BuildSetupInput): SetupResult {
  const seed = String(input.seed ?? "").trim() || "default";
  const lf = input.mode === "lostFleet";
  const playerCount = clampPlayers(input.playerCount, lf);

  // 1) Standard tech: 6 under tracks + 3 free. (LF's new types are NOT mixed.)
  const std = shuffleSeeded(idsOf(SETUP_CATALOG.standardTech), streamFor(seed, "standardTech"));
  const stdByTrack = assignByTrack(std.slice(0, RESEARCH_TRACK_IDS.length));
  const stdFree = std.slice(RESEARCH_TRACK_IDS.length, RESEARCH_TRACK_IDS.length + 3);

  // 2) Advanced tech: draw 6 of 15 (LF: 6 of 21 + a 7th for the extension).
  const advPool = lf
    ? [...idsOf(SETUP_CATALOG.advancedTech), ...idsOf(SETUP_CATALOG.advancedTechLF)]
    : idsOf(SETUP_CATALOG.advancedTech);
  const adv = shuffleSeeded(advPool, streamFor(seed, "advancedTech"));
  // 強制→回避の順に適用（強制のクロススロット入替で押し出されたタイルが
  // 回避対象トラックに来ても、後続の回避スワップで除去されるようにする）
  const directives = resolveAdvDirectives(input);
  applyForceRules(adv, directives.wantedByTrack, lf);
  applyAvoidRules(adv, directives.bannedByTrack, lf);
  const advByTrack = assignByTrack(adv.slice(0, RESEARCH_TRACK_IDS.length));
  const advExtension = adv[RESEARCH_TRACK_IDS.length]; // used only in LF mode

  // 3) Boosters: (players + 3) available. (LF: pool of 14.)
  const boosterPool = lf
    ? [...idsOf(SETUP_CATALOG.boosters), ...idsOf(SETUP_CATALOG.boostersLF)]
    : idsOf(SETUP_CATALOG.boosters);
  const boosters = shuffleSeeded(boosterPool, streamFor(seed, "boosters"));
  const availableCount = Math.min(playerCount + 3, boosters.length);
  const available = boosters.slice(0, availableCount);
  const unused = boosters.slice(availableCount);

  // 4) Round scoring: draw 6 from the physical pool (10, LF: 13).
  const scoringTiles = lf
    ? [...SETUP_CATALOG.roundScoring, ...SETUP_CATALOG.roundScoringLF]
    : SETUP_CATALOG.roundScoring;
  const scoringPool = shuffleSeeded(physicalPoolOf(scoringTiles), streamFor(seed, "roundScoring"));
  const roundScoring = scoringPool.slice(0, 6);

  // 5) Final scoring: draw 2 (of 6, LF: of 9).
  const finalPool = lf
    ? [...idsOf(SETUP_CATALOG.finalScoring), ...idsOf(SETUP_CATALOG.finalScoringLF)]
    : idsOf(SETUP_CATALOG.finalScoring);
  const finals = shuffleSeeded(finalPool, streamFor(seed, "finalScoring"));
  const finalScoring = finals.slice(0, 2);

  // 6) Federation for Terraforming research level 5: draw 1 of 6 types.
  const feds = shuffleSeeded(idsOf(SETUP_CATALOG.federations), streamFor(seed, "federationLv5"));
  const federationLv5 = feds[0];

  const base: SetupResult = {
    seed,
    playerCount,
    standardTech: { byTrack: stdByTrack, free: stdFree },
    advancedTech: { byTrack: advByTrack, ...(lf ? { extension: advExtension } : {}) },
    boosters: { available, unused },
    roundScoring,
    finalScoring,
    federationLv5,
  };

  if (!lf) return base;

  // --- Lost Fleet only draws (independent streams) --------------------------

  // Ships in play; Rebellion is boxed at 2 players.
  const ships: ShipId[] = SHIP_IDS.filter((s) => !(playerCount === 2 && s === "rebellion"));
  const techShips = TECH_SHIP_IDS.filter((s) => ships.includes(s));

  // New standard tech types onto the ship tech spaces (leftover boxed at 2p).
  const shipTechDraw = shuffleSeeded(idsOf(SETUP_CATALOG.standardTechLF), streamFor(seed, "shipTech"));
  applyShipDistanceRules(shipTechDraw, techShips, input);
  const shipTech: Partial<Record<ShipId, string>> = {};
  techShips.forEach((ship, i) => {
    shipTech[ship] = shipTechDraw[i];
  });

  // playerCount artifacts onto Twilight.
  const artifactsDraw = shuffleSeeded(idsOf(SETUP_CATALOG.artifacts), streamFor(seed, "artifacts"));
  const artifacts = artifactsDraw.slice(0, playerCount);

  // One gold federation tile per ship in play.
  const goldDraw = shuffleSeeded(idsOf(SETUP_CATALOG.federationsGold), streamFor(seed, "goldFederations"));
  applyRebellionGoldRule(goldDraw, ships, input.rebellionGoldFed);
  const goldFederations: Partial<Record<ShipId, string>> = {};
  ships.forEach((ship, i) => {
    goldFederations[ship] = goldDraw[i];
  });

  // Face of the economy-research adjustment tile: random unless pinned.
  const econTileFace =
    input.econFaceMode ?? shuffleSeeded(["A", "B"] as const, streamFor(seed, "econTileFace"))[0];

  // Scoring-board extension face: player-count default, random, or pinned.
  const extensionFace =
    input.extensionFaceMode === "vp25" || input.extensionFaceMode === "shuttle"
      ? input.extensionFaceMode
      : input.extensionFaceMode === "random"
        ? shuffleSeeded(["vp25", "shuttle"] as const, streamFor(seed, "extensionFace"))[0]
        : playerCount === 2
          ? ("vp25" as const)
          : ("shuttle" as const);

  return {
    ...base,
    mode: "lostFleet",
    ships,
    shipTech,
    artifacts,
    goldFederations,
    econTileFace,
    extensionFace,
  };
}

type AdvDirectives = {
  /** トラックごとの「このいずれかを置く」集合（強制：ランダム/タイル指定） */
  wantedByTrack: Partial<Record<ResearchTrackId, Set<string>>>;
  /** トラックごとの「置かない」集合（回避＝全量／許容＝指定タイル以外） */
  bannedByTrack: Partial<Record<ResearchTrackId, Set<string>>>;
};

/**
 * 入力の4形態（avoidRules / forceRules / forceTileRules / allowTileRules）を
 * トラック別の wanted / banned 集合に正規化する。ルール外の id・セット外の
 * タイル指定は無視（保存データの前方互換のため黙って落とす）。
 */
function resolveAdvDirectives(input: BuildSetupInput): AdvDirectives {
  const wantedByTrack: AdvDirectives["wantedByTrack"] = {};
  const bannedByTrack: AdvDirectives["bannedByTrack"] = {};
  const add = (
    map: Partial<Record<ResearchTrackId, Set<string>>>,
    track: ResearchTrackId,
    ids: string[]
  ) => {
    if (ids.length === 0) return;
    const set = map[track] ?? new Set<string>();
    for (const id of ids) set.add(id);
    map[track] = set;
  };
  const byId = new Map(AVOID_RULES.map((r) => [r.id, r]));

  for (const id of input.forceRules ?? []) {
    const r = byId.get(id);
    if (r) add(wantedByTrack, r.track, r.tileIds);
  }
  for (const [id, tile] of Object.entries(input.forceTileRules ?? {})) {
    const r = byId.get(id);
    if (r && r.tileIds.includes(tile)) add(wantedByTrack, r.track, [tile]);
  }
  for (const id of input.avoidRules ?? []) {
    const r = byId.get(id);
    if (r) add(bannedByTrack, r.track, r.tileIds);
  }
  for (const [id, tile] of Object.entries(input.allowTileRules ?? {})) {
    const r = byId.get(id);
    if (r) add(bannedByTrack, r.track, r.tileIds.filter((t) => t !== tile));
  }
  return { wantedByTrack, bannedByTrack };
}

/**
 * Enforce placement-avoidance rules on the shuffled advanced-tech array
 * (in place). Track slots are indices 0..5; in LF, index 6 is the extension
 * (never swapped in as a spare), so spares start at 7 there. A violating slot
 * is swapped with the first spare that is legal for that track; if none
 * exists (practically impossible: >=8 spares) the slot is left as drawn.
 */
function applyAvoidRules(
  adv: string[],
  bannedByTrack: AdvDirectives["bannedByTrack"],
  lf: boolean
): void {
  const spareStart = RESEARCH_TRACK_IDS.length + (lf ? 1 : 0);
  RESEARCH_TRACK_IDS.forEach((track, i) => {
    const banned = bannedByTrack[track];
    if (!banned || banned.size === 0 || !banned.has(adv[i])) return;
    for (let j = spareStart; j < adv.length; j++) {
      if (!banned.has(adv[j])) {
        [adv[i], adv[j]] = [adv[j], adv[i]];
        return;
      }
    }
  });
}

/**
 * Enforce FORCE rules on the shuffled advanced-tech array (in place):
 * each rule's track must end up holding one of the rule's wanted tiles.
 * - まずスペア（回避と同じ範囲）から探して入替（他トラック不変）。
 * - スペアに無い場合のみ、対象タイルを持つ他スロット（トラック/LF拡張枠）と
 *   クロス入替する（対象タイルはプール全量が adv に含まれるため必ず充足する）。
 *   押し出されたタイルが回避対象トラックへ移る可能性は、この後に走る
 *   applyAvoidRules が解消する。
 */
function applyForceRules(
  adv: string[],
  wantedByTrack: AdvDirectives["wantedByTrack"],
  lf: boolean
): void {
  const spareStart = RESEARCH_TRACK_IDS.length + (lf ? 1 : 0);
  RESEARCH_TRACK_IDS.forEach((track, i) => {
    const wanted = wantedByTrack[track];
    if (!wanted || wanted.size === 0 || wanted.has(adv[i])) return;
    for (let j = spareStart; j < adv.length; j++) {
      if (wanted.has(adv[j])) {
        [adv[i], adv[j]] = [adv[j], adv[i]];
        return;
      }
    }
    for (let j = 0; j < spareStart; j++) {
      if (j !== i && wanted.has(adv[j])) {
        [adv[i], adv[j]] = [adv[j], adv[i]];
        return;
      }
    }
  });
}

/**
 * 距離タイル（TSL2）の船別 回避/強制 を shipTechDraw（シャッフル済み3枚、
 * 先頭 techShips.length 枚が配置対象、残りは2人時のスペア）に in place 適用。
 * - 強制: TECH_SHIP_IDS 順の先頭1隻のみ（タイルは1枚）。回避と同一船の指定は
 *   UI が防ぐ（単一プルダウン）。
 * - 回避: 移動先はスペア優先、無ければ回避・強制指定のない他船スロット。
 *   合法な移動先が無い場合（3人以上で全船回避など）はそのスロットを据え置く。
 * - 指定なしは完全 no-op（出力バイト不変）。
 */
function applyShipDistanceRules(
  shipTechDraw: string[],
  techShips: ShipId[],
  input: Pick<BuildSetupInput, "shipDistanceAvoid" | "shipDistanceForce">
): void {
  const avoidSet = new Set((input.shipDistanceAvoid ?? []).filter((s) => techShips.includes(s)));
  const forceShip = TECH_SHIP_IDS.find(
    (s) => (input.shipDistanceForce ?? []).includes(s) && techShips.includes(s)
  );
  if (!forceShip && avoidSet.size === 0) return;

  if (forceShip) {
    const i = techShips.indexOf(forceShip);
    const j = shipTechDraw.indexOf(SHIP_DISTANCE_TECH);
    if (j >= 0 && j !== i) [shipTechDraw[i], shipTechDraw[j]] = [shipTechDraw[j], shipTechDraw[i]];
    avoidSet.delete(forceShip); // 同一船の回避は強制が優先（UI では起きない）
  }

  techShips.forEach((ship, i) => {
    if (!avoidSet.has(ship) || shipTechDraw[i] !== SHIP_DISTANCE_TECH) return;
    // スペア（2人時のみ存在）→ 回避・強制指定のない他船スロットの順で探す
    for (let j = techShips.length; j < shipTechDraw.length; j++) {
      if (shipTechDraw[j] !== SHIP_DISTANCE_TECH) {
        [shipTechDraw[i], shipTechDraw[j]] = [shipTechDraw[j], shipTechDraw[i]];
        return;
      }
    }
    for (let j = 0; j < techShips.length; j++) {
      const other = techShips[j];
      if (j !== i && shipTechDraw[j] !== SHIP_DISTANCE_TECH && !avoidSet.has(other) && other !== forceShip) {
        [shipTechDraw[i], shipTechDraw[j]] = [shipTechDraw[j], shipTechDraw[i]];
        return;
      }
    }
    // 合法な移動先なし（全船回避など）: 据え置き
  });
}

/**
 * リベリオンの金枠同盟の FEDG2「任意の技術タイル1枚」回避/強制を
 * goldDraw（シャッフル済み8枚、先頭 ships.length 枚が配置対象）に適用。
 * 回避の移動先はスペア（8枚 - 配置3〜4枚で常に存在）。指定なし・2人
 * （リベリオン箱戻し）は no-op。
 */
function applyRebellionGoldRule(
  goldDraw: string[],
  ships: ShipId[],
  mode: "avoid" | "force" | undefined
): void {
  if (!mode) return;
  const i = ships.indexOf("rebellion");
  if (i < 0) return; // 2人: リベリオンは箱の中
  if (mode === "force") {
    const j = goldDraw.indexOf(REBELLION_GOLD_TECH_FED);
    if (j >= 0 && j !== i) [goldDraw[i], goldDraw[j]] = [goldDraw[j], goldDraw[i]];
    return;
  }
  if (goldDraw[i] !== REBELLION_GOLD_TECH_FED) return;
  for (let j = ships.length; j < goldDraw.length; j++) {
    if (goldDraw[j] !== REBELLION_GOLD_TECH_FED) {
      [goldDraw[i], goldDraw[j]] = [goldDraw[j], goldDraw[i]];
      return;
    }
  }
}

function clampPlayers(n: number | undefined, lf: boolean): number {
  const v = Math.floor(Number(n));
  const min = lf ? 2 : 1;
  if (!Number.isFinite(v)) return 4;
  return Math.max(min, Math.min(4, v));
}
