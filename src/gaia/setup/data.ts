// src/gaia/setup/data.ts
//
// ⚠️ DRAFT CATALOG — pending user verification.
//
// The STRUCTURE (how many tiles, which slots they fill) is what the randomizer
// in buildSetup.ts depends on. Verified against the rulebook (内容物 p2,
// ゲームの準備 p4-5, 2026-07-22):
//   - standard tech:  9 types x4 copies (one TYPE per slot: 6 tracks + 3 free)
//   - advanced tech:  15 tiles, 6 drawn (one per research track)
//   - round boosters: 10, of which (players + 3) are used
//   - round scoring:  9 entries = 8 x1 + 1 x2 -> physical pool of 10; 6 drawn
//                     (the overview's "7種類" groups by icon; trading station
//                     and gaia-mine each exist as separate 3 VP / 4 VP tiles;
//                     the federation +5 VP pair is confirmed by the p2 photo:
//                     the doubles row shows TS / gaia-mine / federation)
//   - final scoring:  6 tiles, 2 drawn
//   - federations:    6 types x3 copies (Gleens-only tile excluded); 1 drawn
//                     for Terraforming research level 5 (rulebook p4)
//
// Verification status of the TEXT:
//   - boosters:      ✅ rulebook appendix IV (2026-07-21)
//   - roundScoring:  ✅ rulebook appendix V + p2 photo (2026-07-22)
//   - standardTech:  ✅ read from the p2 component photo (icons are large and
//                    unambiguous); ids TS1..TS9 follow the photo's row order
//   - finalScoring:  ✅ rulebook p18 (full text list)
//   - advancedTech:  🟡 icon-read from the p2 photo using appendix VI's legend;
//                    confident but awaiting the user's B-check (2026-07-22)
//   - federations:   🟡 icon-read from the p2 photo; physical check pending
//                    (user memo 2026-07-22)
// Fixing label/effect text never changes randomizer behavior (ids only).
//
// Lost Fleet expansion additions are NOT included yet — see
// docs/setup-lostfleet-spec.md for the planned model.

import type { SetupCatalog } from "./types";

export const SETUP_CATALOG: SetupCatalog = {
  // --- 9 standard tech tile types (x4 identical copies each) ----------------
  // ✅ Read from the p2 component photo (2026-07-22); TS1..TS9 follow the
  // photo's row order (top-left to bottom-right).
  standardTech: [
    { id: "TS1", label: "即時：鉱石1＋QIC1", labelEn: "Immediate: 1 ore + 1 QIC", effect: "このタイルを取ったとき、即座に鉱石1とQ.I.C.駒1個を得る。", effectEn: "When you take this tile, immediately gain 1 ore and 1 QIC." },
    { id: "TS2", label: "即時：惑星種類×知識1", labelEn: "Immediate: 1 knowledge per planet type", effect: "このタイルを取ったとき、即座に入植している惑星の種類1つごとに知識1を得る。", effectEn: "When you take this tile, immediately gain 1 knowledge per planet type you have settled." },
    { id: "TS3", label: "首府・学院のパワー値4", labelEn: "PI & academies have power value 4", effect: "自分の惑星首府と学院のパワー値は4になる（上級技術タイルで覆われた場合は3に戻る）。", effectEn: "Your planetary institute and academies have power value 4 (reverts to 3 if this tile is covered by an advanced tech tile)." },
    { id: "TS4", label: "即時：7VP", labelEn: "Immediate: 7 VP", effect: "このタイルを取ったとき、即座に7勝利点を得る。", effectEn: "When you take this tile, immediately gain 7 VP." },
    { id: "TS5", label: "収入：鉱石1・パワー1", labelEn: "Income: 1 ore, charge 1 power", effect: "各収入フェイズ中、鉱石1を得てパワー1をチャージする。", effectEn: "During each income phase, gain 1 ore and charge 1 power." },
    { id: "TS6", label: "収入：知識1・クレジット1", labelEn: "Income: 1 knowledge, 1 credit", effect: "各収入フェイズ中、知識1とクレジット1を得る。", effectEn: "During each income phase, gain 1 knowledge and 1 credit." },
    { id: "TS7", label: "ガイア惑星に鉱山建設で＋3VP", labelEn: "+3 VP per mine built on Gaia planet", effect: "ガイア惑星上に鉱山を建設するたびに、追加の3勝利点を得る。", effectEn: "Each time you build a mine on a Gaia planet, gain 3 additional VP." },
    { id: "TS8", label: "収入：クレジット4", labelEn: "Income: 4 credits", effect: "各収入フェイズ中、クレジット4を得る。", effectEn: "During each income phase, gain 4 credits." },
    { id: "TS9", label: "アクション：パワー4", labelEn: "Action: charge 4 power", effect: "ラウンドごとに1回、アクションとしてパワー4をチャージできる。", effectEn: "Once per round, as an action, charge 4 power." },
  ],

  // --- 15 advanced tech tiles (6 drawn per game) ----------------------------
  // 🟡 Icon-read from the p2 component photo using appendix VI's legend
  // (red crescent = on pass, green = each time that action, white = once when
  // taken, orange octagon = once-per-round action). AT01..AT15 follow the
  // photo's row order. Awaiting the user's B-check.
  advancedTech: [
    { id: "AT01", label: "パス時：同盟タイル×3VP", labelEn: "Pass: 3 VP per federation tile", effect: "パス時、持っている同盟タイル1枚ごとに3勝利点を得る。", effectEn: "When passing, gain 3 VP per federation tile you own." },
    { id: "AT02", label: "研究を進めるたび＋2VP", labelEn: "+2 VP per research advance", effect: "研究エリアでマーカーを進めるたびに、追加の2勝利点を得る。", effectEn: "Each time you advance in a research area, gain 2 additional VP." },
    { id: "AT03", label: "アクション：QIC1＋クレジット5", labelEn: "Action: 1 QIC + 5 credits", effect: "ラウンドごとに1回、アクションとしてQ.I.C.駒1個と5クレジットを得る。", effectEn: "Once per round, as an action, gain 1 QIC and 5 credits." },
    { id: "AT04", label: "取得時：鉱山×2VP", labelEn: "Immediate: 2 VP per mine", effect: "このタイルを取ったとき、即座に建設済みの鉱山1つごとに2勝利点を得る。", effectEn: "When taken, immediately gain 2 VP per mine you have built." },
    { id: "AT05", label: "パス時：研究所×3VP", labelEn: "Pass: 3 VP per research lab", effect: "パス時、建設済みの研究所1つごとに3勝利点を得る。", effectEn: "When passing, gain 3 VP per research lab you have built." },
    { id: "AT06", label: "取得時：宙域×鉱石1", labelEn: "Immediate: 1 ore per sector", effect: "このタイルを取ったとき、即座に自分の建造物がある宙域1つごとに鉱石1を得る。", effectEn: "When taken, immediately gain 1 ore per sector containing your structures." },
    { id: "AT07", label: "アクション：鉱石3", labelEn: "Action: 3 ore", effect: "ラウンドごとに1回、アクションとして鉱石3を得る。", effectEn: "Once per round, as an action, gain 3 ore." },
    { id: "AT08", label: "取得時：ガイア惑星×2VP", labelEn: "Immediate: 2 VP per Gaia planet", effect: "このタイルを取ったとき、即座に入植しているガイア惑星1つごとに2勝利点を得る。", effectEn: "When taken, immediately gain 2 VP per Gaia planet you have settled." },
    { id: "AT09", label: "取得時：交易所×4VP", labelEn: "Immediate: 4 VP per trading station", effect: "このタイルを取ったとき、即座に建設済みの交易所1つごとに4勝利点を得る。", effectEn: "When taken, immediately gain 4 VP per trading station you have built." },
    { id: "AT10", label: "取得時：宙域×2VP", labelEn: "Immediate: 2 VP per sector", effect: "このタイルを取ったとき、即座に自分の建造物がある宙域1つごとに2勝利点を得る。", effectEn: "When taken, immediately gain 2 VP per sector containing your structures." },
    { id: "AT11", label: "交易所を建設するたび＋3VP", labelEn: "+3 VP per trading station built", effect: "交易所を建設するたびに、追加の3勝利点を得る。", effectEn: "Each time you build a trading station, gain 3 additional VP." },
    { id: "AT12", label: "取得時：同盟タイル×5VP", labelEn: "Immediate: 5 VP per federation tile", effect: "このタイルを取ったとき、即座に持っている同盟タイル1枚ごとに5勝利点を得る。", effectEn: "When taken, immediately gain 5 VP per federation tile you own." },
    { id: "AT13", label: "アクション：知識3", labelEn: "Action: 3 knowledge", effect: "ラウンドごとに1回、アクションとして知識3を得る。", effectEn: "Once per round, as an action, gain 3 knowledge." },
    { id: "AT14", label: "鉱山を建設するたび＋3VP", labelEn: "+3 VP per mine built", effect: "鉱山を建設するたびに、追加の3勝利点を得る。", effectEn: "Each time you build a mine, gain 3 additional VP." },
    { id: "AT15", label: "パス時：惑星種類×1VP", labelEn: "Pass: 1 VP per planet type", effect: "パス時、入植している惑星の種類1つごとに1勝利点を得る。", effectEn: "When passing, gain 1 VP per planet type you have settled." },
  ],

  // --- 10 round boosters ----------------------------------------------------
  // ✅ VERIFIED against the rulebook (2026-07-21). Ids RB01..RB10 correspond to
  // booster numbers 1..10 in the rulebook. "フェイズI中に得る" is recorded as
  // income (confirmed by the user). Boosters 6-10 additionally score VP when
  // returned via the Pass action.
  boosters: [
    {
      id: "RB01",
      label: "収入：鉱石1・知識1",
      labelEn: "Income: 1 ore, 1 knowledge",
      effect: "フェイズI中に1鉱石と1知識を得る。",
      effectEn: "During phase I, gain 1 ore and 1 knowledge.",
    },
    {
      id: "RB02",
      label: "収入：クレジット2・QIC1",
      labelEn: "Income: 2 credits, 1 QIC",
      effect: "フェイズI中に2クレジットとQ.I.C.駒1個を得る。",
      effectEn: "During phase I, gain 2 credits and 1 QIC.",
    },
    {
      id: "RB03",
      label: "収入：パワートークン2・鉱石1",
      labelEn: "Income: 2 power tokens, 1 ore",
      effect: "フェイズI中にパワートークン2個（エリアIへ）と1鉱石を得る。",
      effectEn: "During phase I, gain 2 power tokens (to area I) and 1 ore.",
    },
    {
      id: "RB04",
      label: "収入：クレジット2／特別：鉱山建設（改造1無料）",
      labelEn: "Income: 2 credits / Special: build mine (1 free terraform)",
      effect:
        "フェイズI中に2クレジットを得る。特別アクション「鉱山の建設」（1段階の惑星改造が無料）を実行できる。追加の惑星改造のために鉱石を支払えるが、このアクションを他のアクションと組み合わせることはできない。",
      effectEn:
        "During phase I, gain 2 credits. Special action: build a mine with 1 free terraforming step; you may pay ore for additional steps, but this action cannot be combined with other actions.",
    },
    {
      id: "RB05",
      label: "収入：パワー2／特別：鉱山建設orガイア計画（距離+3）",
      labelEn: "Income: charge 2 power / Special: mine or Gaia project (+3 range)",
      effect:
        "フェイズI中に2パワーを得る（チャージ）。特別アクション「鉱山の建設」または「ガイア計画の開始」（到達可能距離が3伸びる）を実行できる。各アクションの通常ルールが適用される。他のアクションと組み合わせることはできない。",
      effectEn:
        "During phase I, charge 2 power. Special action: build a mine or start a Gaia project with +3 range. Normal rules for each action apply; cannot be combined with other actions.",
    },
    {
      id: "RB06",
      label: "収入：鉱石1／パス：鉱山×1VP",
      labelEn: "Income: 1 ore / Pass: 1 VP per mine",
      effect:
        "フェイズI中に1鉱石を得る。「パス」アクションでこのブースターを返却したとき、建設済みの自分の鉱山（暗黒惑星の“鉱山”も含む）1つごとに1勝利点を得る。",
      effectEn:
        "During phase I, gain 1 ore. When returning this booster via the Pass action, gain 1 VP per mine you have built (including the Lost Planet's \"mine\").",
    },
    {
      id: "RB07",
      label: "収入：知識1／パス：研究所×3VP",
      labelEn: "Income: 1 knowledge / Pass: 3 VP per research lab",
      effect:
        "フェイズI中に1知識を得る。「パス」アクションでこのブースターを返却したとき、建設済みの自分の研究所1つごとに3勝利点を得る。",
      effectEn:
        "During phase I, gain 1 knowledge. When returning this booster via the Pass action, gain 3 VP per research lab you have built.",
    },
    {
      id: "RB08",
      label: "収入：鉱石1／パス：交易所×2VP",
      labelEn: "Income: 1 ore / Pass: 2 VP per trading station",
      effect:
        "フェイズI中に1鉱石を得る。「パス」アクションでこのブースターを返却したとき、建設済みの自分の交易所1つごとに2勝利点を得る。",
      effectEn:
        "During phase I, gain 1 ore. When returning this booster via the Pass action, gain 2 VP per trading station you have built.",
    },
    {
      id: "RB09",
      label: "収入：パワー4／パス：学院・首府×4VP",
      labelEn: "Income: charge 4 power / Pass: 4 VP per academy & PI",
      effect:
        "フェイズI中に4パワーを得る（チャージ）。「パス」アクションでこのブースターを返却したとき、建設済みの自分の学院と惑星首府1つごとに4勝利点を得る。",
      effectEn:
        "During phase I, charge 4 power. When returning this booster via the Pass action, gain 4 VP per academy and planetary institute you have built.",
    },
    {
      id: "RB10",
      label: "収入：クレジット4／パス：ガイア惑星×1VP",
      labelEn: "Income: 4 credits / Pass: 1 VP per Gaia planet",
      effect:
        "フェイズI中に4クレジットを得る。「パス」アクションでこのブースターを返却したとき、自分が入植しているガイア惑星1つごとに1勝利点を得る（ガイアフォーマー駒が置かれているだけのガイア惑星は入植とみなされない）。",
      effectEn:
        "During phase I, gain 4 credits. When returning this booster via the Pass action, gain 1 VP per Gaia planet you have settled (a Gaia planet holding only a Gaiaformer does not count).",
    },
  ],

  // --- 9 round scoring entries (physical pool of 10; 6 drawn) ---------------
  // ✅ VERIFIED against rulebook appendix V (2026-07-22). The component
  // overview's "7種類" groups tiles by icon; two of the x2 icon-types (trading
  // station, gaia mine) exist as DIFFERENT tiles worth 3 or 4 VP ("タイルに
  // よります"), so the catalog models 9 distinct entries. The remaining pair —
  // federation +5 VP as two identical copies — follows by elimination
  // (appendix lists every other tile with a single fixed value);
  // ⚠️ that x2 assignment still awaits the user's confirmation.
  roundScoring: [
    {
      id: "RS01",
      label: "鉱山建設 +2VP",
      labelEn: "Mine built: +2 VP",
      effect: "鉱山を建設したとき、追加の2勝利点を得る。",
      effectEn: "When you build a mine, gain 2 additional VP.",
    },
    {
      id: "RS02",
      label: "交易所建設 +3VP",
      labelEn: "Trading station built: +3 VP",
      effect: "交易所を建設したとき、追加の3勝利点を得る。",
      effectEn: "When you build a trading station, gain 3 additional VP.",
    },
    {
      id: "RS03",
      label: "交易所建設 +4VP",
      labelEn: "Trading station built: +4 VP",
      effect: "交易所を建設したとき、追加の4勝利点を得る。",
      effectEn: "When you build a trading station, gain 4 additional VP.",
    },
    {
      id: "RS04",
      label: "学院・惑星首府建設 +5VP",
      labelEn: "Academy/PI built: +5 VP",
      effect: "学院か惑星首府を建設したとき、追加の5勝利点を得る。",
      effectEn: "When you build an academy or planetary institute, gain 5 additional VP.",
    },
    {
      id: "RS05",
      label: "ガイア惑星に鉱山建設 +3VP",
      labelEn: "Mine on Gaia planet: +3 VP",
      effect: "ガイア惑星上に鉱山を建設したとき、追加の3勝利点を得る。",
      effectEn: "When you build a mine on a Gaia planet, gain 3 additional VP.",
    },
    {
      id: "RS06",
      label: "ガイア惑星に鉱山建設 +4VP",
      labelEn: "Mine on Gaia planet: +4 VP",
      effect: "ガイア惑星上に鉱山を建設したとき、追加の4勝利点を得る。",
      effectEn: "When you build a mine on a Gaia planet, gain 4 additional VP.",
    },
    {
      id: "RS07",
      label: "研究1レベル +2VP",
      labelEn: "Research advance: +2 VP",
      effect: "研究エリアでマーカーを1レベル進めたとき、追加の2勝利点を得る。",
      effectEn: "When you advance a marker one level in a research area, gain 2 additional VP.",
    },
    {
      id: "RS08",
      label: "同盟タイル獲得 +5VP",
      labelEn: "Federation tile gained: +5 VP",
      effect: "同盟タイルを得たとき（入手手段は問わない）、追加の5勝利点を得る。",
      effectEn: "When you gain a federation tile (by any means), gain 5 additional VP.",
      copies: 2,
    },
    {
      id: "RS09",
      label: "惑星改造1段階 +2VP",
      labelEn: "Terraforming step: +2 VP",
      effect: "実行した惑星改造1段階ごとに（実行手段は問わない）追加の2勝利点を得る。",
      effectEn: "For each terraforming step you perform (by any means), gain 2 additional VP.",
    },
  ],

  // --- 6 final scoring tiles (2 drawn per game) -----------------------------
  // ✅ Verified against rulebook p18 (2026-07-22). Ranking VP: 1st=18, 2nd=12,
  // 3rd=6 (shared ranks split the sum evenly).
  finalScoring: [
    { id: "FS01", label: "同盟内の建造物 最多", labelEn: "Most structures in federations", effect: "最も多くの建造物（暗黒惑星を含む）を同盟（複数可）に含んでいる。", effectEn: "Have the most structures (including the Lost Planet) inside your federations." },
    { id: "FS02", label: "建造物 最多", labelEn: "Most structures built", effect: "最も多くの建造物（暗黒惑星を含む）を建設している。", effectEn: "Have built the most structures (including the Lost Planet)." },
    { id: "FS03", label: "惑星の種類 最多", labelEn: "Most planet types settled", effect: "最も多くの種類の惑星（ガイア惑星や暗黒惑星も含む）に入植している。", effectEn: "Have settled the most different planet types (including Gaia and the Lost Planet)." },
    { id: "FS04", label: "ガイア惑星 最多", labelEn: "Most Gaia planets settled", effect: "最も多くのガイア惑星に入植している。", effectEn: "Have settled the most Gaia planets." },
    { id: "FS05", label: "入植宙域 最多", labelEn: "Most sectors settled", effect: "最も多くの宙域タイル上に入植している（宙域ごとに最低1個の建造物、暗黒惑星を含む）。", effectEn: "Have settled the most sectors (at least 1 structure per sector, including the Lost Planet)." },
    { id: "FS06", label: "衛星 最多", labelEn: "Most satellites", effect: "最も多くの衛星を建設している（ダー・シュワーム人の宇宙ステーションも衛星として数える）。", effectEn: "Have built the most satellites (Ivits' space stations count as satellites)." },
  ],

  // --- 6 federation tile types (x3 copies each; 1 drawn for Terraforming Lv5)
  // 🟡 Icon-read from the p2 component photo (2026-07-22); physical check
  // pending (user memo). The Gleens-only tile (no VP) is excluded. The 12 VP
  // tile is gray on both sides (cannot be flipped for advanced tech / Lv5).
  federations: [
    { id: "FED12", label: "同盟：12VP", labelEn: "Federation: 12 VP", effect: "即時：12勝利点（両面灰色のため、上級技術タイルの取得や研究レベル5への到達には使えない）。", effectEn: "Immediate: 12 VP (gray on both sides; cannot be spent for advanced tech or research level 5)." },
    { id: "FED8Q", label: "同盟：8VP＋QIC1", labelEn: "Federation: 8 VP + 1 QIC", effect: "即時：8勝利点とQ.I.C.駒1個。", effectEn: "Immediate: 8 VP and 1 QIC." },
    { id: "FED8PT", label: "同盟：8VP＋パワートークン2", labelEn: "Federation: 8 VP + 2 power tokens", effect: "即時：8勝利点とパワートークン2個。", effectEn: "Immediate: 8 VP and 2 power tokens." },
    { id: "FED7O", label: "同盟：7VP＋鉱石2", labelEn: "Federation: 7 VP + 2 ore", effect: "即時：7勝利点と鉱石2。", effectEn: "Immediate: 7 VP and 2 ore." },
    { id: "FED7C", label: "同盟：7VP＋クレジット6", labelEn: "Federation: 7 VP + 6 credits", effect: "即時：7勝利点とクレジット6。", effectEn: "Immediate: 7 VP and 6 credits." },
    { id: "FED6K", label: "同盟：6VP＋知識2", labelEn: "Federation: 6 VP + 2 knowledge", effect: "即時：6勝利点と知識2。", effectEn: "Immediate: 6 VP and 2 knowledge." },
  ],
};
