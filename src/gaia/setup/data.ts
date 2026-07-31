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
//                     the academy/PI +5 VP pair is confirmed by the p2 photo:
//                     the doubles row shows TS / gaia-mine / academy-PI)
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
//   - advancedTech:  ✅ B-checked by the user against the physical tiles
//                    (2026-07-23)
//   - federations:   ✅ physically checked by the user (2026-07-23)
// Fixing label/effect text never changes randomizer behavior (ids only).
//
// Lost Fleet groups (2026-07-23, all contents user-confirmed; see
// docs/setup-lostfleet-spec.md §4):
//   - boostersLF 4 / roundScoringLF 3 / advancedTechLF 6 / standardTechLF 3
//     types / finalScoringLF 3 / federationsGold 8 / artifacts 13.
//   The "2 resources" on gold federation FEDG5 = 2 ore (user-confirmed);
//   AT19 scores per terraforming STEP; AT20 triggers on QIC action SPACES;
//   ART06 is an immediate one-time score.

import type { SetupCatalog } from "./types";

// 各グループの並びは「似た挙動」でまとまるよう整理してある（2026-07-30 ユーザー要望）:
//   収入 → 即時獲得 → アクション → パス時 → 条件トリガー → 順位 → その他。
// この配列順はシャッフルの入力なので、並べ替えると同じシードの出目が変わる。
// 実際 2026-07-30 の整理で全シードの出目が変わり、buildSetup.test の golden 値を
// 更新した（保存済みセットアップが変わるのはユーザー了承済み）。
export const SETUP_CATALOG: SetupCatalog = {
  // --- 9 standard tech tile types (x4 identical copies each) ----------------
  // ✅ Read from the p2 component photo (2026-07-22); TS1..TS9 follow the
  // photo's row order (top-left to bottom-right).
  standardTech: [
    { id: "TS5", label: "収入：鉱石1・パワー1", labelEn: "Income: 1 ore, charge 1 power", effect: "各収入フェイズ中、鉱石1を得てパワー1をチャージする。", effectEn: "During each income phase, gain 1 ore and charge 1 power." },
    { id: "TS6", label: "収入：知識1・クレジット1", labelEn: "Income: 1 knowledge, 1 credit", effect: "各収入フェイズ中、知識1とクレジット1を得る。", effectEn: "During each income phase, gain 1 knowledge and 1 credit." },
    { id: "TS8", label: "収入：クレジット4", labelEn: "Income: 4 credits", effect: "各収入フェイズ中、クレジット4を得る。", effectEn: "During each income phase, gain 4 credits." },
    { id: "TS1", label: "即時：鉱石1＋QIC1", labelEn: "Immediate: 1 ore + 1 QIC", effect: "このタイルを取ったとき、即座に鉱石1とQ.I.C.駒1個を得る。", effectEn: "When you take this tile, immediately gain 1 ore and 1 QIC." },
    { id: "TS2", label: "即時：惑星種類×知識1", labelEn: "Immediate: 1 knowledge per planet type", effect: "このタイルを取ったとき、即座に入植している惑星の種類1つごとに知識1を得る。", effectEn: "When you take this tile, immediately gain 1 knowledge per planet type you have settled." },
    { id: "TS4", label: "即時：7VP", labelEn: "Immediate: 7 VP", effect: "このタイルを取ったとき、即座に7勝利点を得る。", effectEn: "When you take this tile, immediately gain 7 VP." },
    { id: "TS9", label: "アクション：パワー4", labelEn: "Action: charge 4 power", effect: "ラウンドごとに1回、アクションとしてパワー4をチャージできる。", effectEn: "Once per round, as an action, charge 4 power." },
    { id: "TS7", label: "ガイア惑星に鉱山建設で＋3VP", labelEn: "+3 VP per mine built on Gaia planet", effect: "ガイア惑星上に鉱山を建設するたびに、追加の3勝利点を得る。", effectEn: "Each time you build a mine on a Gaia planet, gain 3 additional VP." },
    { id: "TS3", label: "首府・学院のパワー値4", labelEn: "PI & academies have power value 4", effect: "自分の惑星首府と学院のパワー値は4になる（上級技術タイルで覆われた場合は3に戻る）。", effectEn: "Your planetary institute and academies have power value 4 (reverts to 3 if this tile is covered by an advanced tech tile)." },
  ],

  // --- 15 advanced tech tiles (6 drawn per game) ----------------------------
  // 🟡 Icon-read from the p2 component photo using appendix VI's legend
  // (red crescent = on pass, green = each time that action, white = once when
  // taken, orange octagon = once-per-round action). AT01..AT15 follow the
  // photo's row order. Awaiting the user's B-check.
  advancedTech: [
    { id: "AT04", label: "取得時：鉱山×2VP", labelEn: "Immediate: 2 VP per mine", effect: "このタイルを取ったとき、即座に建設済みの鉱山1つごとに2勝利点を得る。", effectEn: "When taken, immediately gain 2 VP per mine you have built." },
    { id: "AT06", label: "取得時：宙域×鉱石1", labelEn: "Immediate: 1 ore per sector", effect: "このタイルを取ったとき、即座に自分の建造物がある宙域1つごとに鉱石1を得る。", effectEn: "When taken, immediately gain 1 ore per sector containing your structures." },
    { id: "AT08", label: "取得時：ガイア惑星×2VP", labelEn: "Immediate: 2 VP per Gaia planet", effect: "このタイルを取ったとき、即座に入植しているガイア惑星1つごとに2勝利点を得る。", effectEn: "When taken, immediately gain 2 VP per Gaia planet you have settled." },
    { id: "AT09", label: "取得時：交易所×4VP", labelEn: "Immediate: 4 VP per trading station", effect: "このタイルを取ったとき、即座に建設済みの交易所1つごとに4勝利点を得る。", effectEn: "When taken, immediately gain 4 VP per trading station you have built." },
    { id: "AT10", label: "取得時：宙域×2VP", labelEn: "Immediate: 2 VP per sector", effect: "このタイルを取ったとき、即座に自分の建造物がある宙域1つごとに2勝利点を得る。", effectEn: "When taken, immediately gain 2 VP per sector containing your structures." },
    { id: "AT12", label: "取得時：同盟タイル×5VP", labelEn: "Immediate: 5 VP per federation tile", effect: "このタイルを取ったとき、即座に持っている同盟タイル1枚ごとに5勝利点を得る。", effectEn: "When taken, immediately gain 5 VP per federation tile you own." },
    { id: "AT03", label: "アクション：QIC1＋クレジット5", labelEn: "Action: 1 QIC + 5 credits", effect: "ラウンドごとに1回、アクションとしてQ.I.C.駒1個と5クレジットを得る。", effectEn: "Once per round, as an action, gain 1 QIC and 5 credits." },
    { id: "AT07", label: "アクション：鉱石3", labelEn: "Action: 3 ore", effect: "ラウンドごとに1回、アクションとして鉱石3を得る。", effectEn: "Once per round, as an action, gain 3 ore." },
    { id: "AT13", label: "アクション：知識3", labelEn: "Action: 3 knowledge", effect: "ラウンドごとに1回、アクションとして知識3を得る。", effectEn: "Once per round, as an action, gain 3 knowledge." },
    { id: "AT01", label: "パス時：同盟タイル×3VP", labelEn: "Pass: 3 VP per federation tile", effect: "パス時、持っている同盟タイル1枚ごとに3勝利点を得る。", effectEn: "When passing, gain 3 VP per federation tile you own." },
    { id: "AT05", label: "パス時：研究所×3VP", labelEn: "Pass: 3 VP per research lab", effect: "パス時、建設済みの研究所1つごとに3勝利点を得る。", effectEn: "When passing, gain 3 VP per research lab you have built." },
    { id: "AT15", label: "パス時：惑星種類×1VP", labelEn: "Pass: 1 VP per planet type", effect: "パス時、入植している惑星の種類1つごとに1勝利点を得る。", effectEn: "When passing, gain 1 VP per planet type you have settled." },
    { id: "AT02", label: "研究を進めるたび＋2VP", labelEn: "+2 VP per research advance", effect: "研究エリアでマーカーを進めるたびに、追加の2勝利点を得る。", effectEn: "Each time you advance in a research area, gain 2 additional VP." },
    { id: "AT11", label: "交易所を建設するたび＋3VP", labelEn: "+3 VP per trading station built", effect: "交易所を建設するたびに、追加の3勝利点を得る。", effectEn: "Each time you build a trading station, gain 3 additional VP." },
    { id: "AT14", label: "鉱山を建設するたび＋3VP", labelEn: "+3 VP per mine built", effect: "鉱山を建設するたびに、追加の3勝利点を得る。", effectEn: "Each time you build a mine, gain 3 additional VP." },
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
  // ✅ VERIFIED against rulebook appendix V + the p2 component photo read at
  // high resolution (2026-07-25). The overview's "7種類" groups tiles by icon;
  // the bottom x2 row is trading station / gaia mine / ACADEMY-PI, so the
  // identical pair is academy/PI +5 VP (RS04, copies: 2) — TS and gaia mine
  // are the 3/4 VP variants, and federation +5 VP (RS08) is a single, sitting
  // in the photo's top x1 row. (An earlier elimination guess had federation as
  // the pair; the photo overrules it. ⚠️ physical double-check welcome.)
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
      copies: 2,
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

  // ==========================================================================
  // Lost Fleet expansion groups (drawn only in "lostFleet" mode)
  // ==========================================================================

  // --- 4 new round boosters (mixed into the base pool) ----------------------
  boostersLF: [
    {
      id: "RB11",
      label: "収入：鉱石1／パス：ガイアフォーマー×3VP",
      labelEn: "Income: 1 ore / Pass: 3 VP per Gaiaformer",
      effect: "収入：鉱石1。パス時、自分のガイアフォーマー駒（勢力ボード上か配置済みかは問わない）1個ごとに3勝利点。小惑星入植に使った駒からは得点しない。",
      effectEn: "Income: 1 ore. When passing, gain 3 VP per Gaiaformer you own (on your board or deployed); Gaiaformers spent to settle asteroids do not count.",
    },
    {
      id: "RB12",
      label: "収入：鉱石1／パス：惑星種類×1VP",
      labelEn: "Income: 1 ore / Pass: 1 VP per planet type",
      effect: "収入：鉱石1。パス時、入植している惑星の種類1つごとに1勝利点。",
      effectEn: "Income: 1 ore. When passing, gain 1 VP per planet type you have settled.",
    },
    {
      id: "RB13",
      label: "収入：クレジット3／パス：深宇宙×2VP",
      labelEn: "Income: 3 credits / Pass: 2 VP per deep-space sector",
      effect: "収入：クレジット3。パス時、最低1つの惑星に入植している深宇宙宙域1つごとに2勝利点。",
      effectEn: "Income: 3 credits. When passing, gain 2 VP per deep-space sector where you have settled at least one planet.",
    },
    {
      id: "RB14",
      label: "収入：パワー2／特別：ガイア計画（即変換）",
      labelEn: "Income: charge 2 power / Special: instant Gaia project",
      effect: "収入：パワー2（チャージ）。特別アクション：パワートークンをガイアエリアに移動させずに「ガイア計画の開始」を実行し、その次元横断惑星を即座にガイア惑星に変換する（同ラウンド中に鉱山建設可、ガイアフォーマーは同ラウンド中に再利用可）。到達可能距離内が対象、QIC支払いで距離延長可。",
      effectEn: "Income: charge 2 power. Special action: start a Gaia project without moving tokens to the Gaia area and immediately convert the transdim planet to a Gaia planet (buildable this round; the Gaiaformer is reusable this round). Range applies; QIC may extend it.",
    },
  ],

  // --- 3 new round scoring tiles (mixed into the physical pool) -------------
  roundScoringLF: [
    {
      id: "RS10",
      label: "未入植の宙域で鉱山建設 +3VP",
      labelEn: "Mine in a new sector: +3 VP",
      effect: "まだ自分が入植していない各宙域／深宇宙宙域内で鉱山を建設したとき、追加の3勝利点を得る。宙間タイルは宙域ではない。",
      effectEn: "When you build a mine in a sector / deep-space sector you have not settled yet, gain 3 additional VP. Interspace tiles are not sectors.",
    },
    {
      id: "RS11",
      label: "未入植の種類の惑星に鉱山建設 +3VP",
      labelEn: "Mine on a new planet type: +3 VP",
      effect: "まだ自分が入植していない種類の惑星に鉱山を建設したとき、追加の3勝利点を得る。",
      effectEn: "When you build a mine on a planet type you have not settled yet, gain 3 additional VP.",
    },
    {
      id: "RS12",
      label: "研究所建設 +4VP",
      labelEn: "Research lab built: +4 VP",
      effect: "研究所を建設したとき、追加の4勝利点を得る。",
      effectEn: "When you build a research lab, gain 4 additional VP.",
    },
  ],

  // --- 6 new advanced tech tiles (mixed into the base 15) -------------------
  advancedTechLF: [
    { id: "AT16", label: "取得時：首府・学院×6VP", labelEn: "Immediate: 6 VP per PI & academy", effect: "このタイルを取ったとき、即座に自分の惑星首府駒と学院駒1個ごとに6勝利点を得る。", effectEn: "When taken, immediately gain 6 VP per planetary institute and academy you have built." },
    { id: "AT17", label: "取得時：深宇宙宙域×4VP", labelEn: "Immediate: 4 VP per deep-space sector", effect: "このタイルを取ったとき、即座に最低1つの惑星に入植している深宇宙宙域1つごとに4勝利点を得る。", effectEn: "When taken, immediately gain 4 VP per deep-space sector where you have settled at least one planet." },
    { id: "AT18", label: "パス時：小惑星×2VP", labelEn: "Pass: 2 VP per asteroid", effect: "パス時、入植している小惑星1つごとに2勝利点を得る。", effectEn: "When passing, gain 2 VP per asteroid you have settled." },
    { id: "AT21", label: "パス時：深宇宙宙域×2VP", labelEn: "Pass: 2 VP per deep-space sector", effect: "パス時、最低1つの惑星に入植している深宇宙宙域1つごとに2勝利点を得る。", effectEn: "When passing, gain 2 VP per deep-space sector where you have settled at least one planet." },
    { id: "AT19", label: "惑星改造1段階ごと＋2VP", labelEn: "+2 VP per terraforming step", effect: "惑星改造を実行するたび、実行した1段階ごとに2勝利点を得る。", effectEn: "Each time you terraform, gain 2 VP per terraforming step performed." },
    { id: "AT20", label: "QICアクションのたび＋4VP", labelEn: "+4 VP per QIC action", effect: "発展ボードのQICアクションスペースを実行するたび、4勝利点を得る（フリーアクションでのQIC消費は含まない）。", effectEn: "Each time you take a QIC action space, gain 4 VP (free-action QIC spending does not count)." },
  ],

  // --- 3 new standard tech types (NOT mixed; ship tech spaces) --------------
  standardTechLF: [
    {
      id: "TSL1",
      label: "即時：2段階無料改造＋鉱山建設",
      labelEn: "Immediate: build mine w/ 2 free terraform steps",
      effect: "即時（1回）：2段階までの無料の惑星改造を得て、鉱山のコストを支払わずに「鉱山の建設」を実行する。追加の鉱石で3段階目を得たり、QIC支払いで到達可能距離を伸ばしたりできる。",
      effectEn: "Immediately (once): build a mine without paying its cost, with up to 2 free terraforming steps; you may pay ore for a 3rd step and QIC to extend range.",
    },
    {
      id: "TSL3",
      label: "即時：鉱石1＋知識3",
      labelEn: "Immediate: 1 ore + 3 knowledge",
      effect: "このタイルを取ったとき、即座に鉱石1と知識3を得る。",
      effectEn: "When you take this tile, immediately gain 1 ore and 3 knowledge.",
    },
    {
      id: "TSL2",
      label: "基本到達距離＋1",
      labelEn: "Base range +1",
      effect: "このタイルが上級技術タイルに覆われない限り、ゲーム終了まで基本到達可能距離が1増える。",
      effectEn: "While this tile is not covered by an advanced tech tile, your base range is increased by 1 until game end.",
    },
  ],

  // --- 3 new final scoring tiles (mixed into the base 6) --------------------
  finalScoringLF: [
    { id: "FS07", label: "小惑星 最多", labelEn: "Most asteroids settled", effect: "最も多くの小惑星に入植している。", effectEn: "Have settled the most asteroids." },
    { id: "FS08", label: "首府⇔学院の距離 最長", labelEn: "Longest PI-academy distance", effect: "自分の惑星首府と自分の学院のうち1つのあいだの距離が最も長い（首府からその学院への到達距離。どちらかを建設していない場合は得点しない）。", effectEn: "Have the longest distance between your planetary institute and one of your academies (reach distance; no VP if either is missing)." },
    { id: "FS09", label: "深宇宙宙域 最多", labelEn: "Most deep-space sectors settled", effect: "最低1つの惑星に入植している深宇宙宙域が最も多い。暗黒惑星も入植済みの惑星と見なす。", effectEn: "Have the most deep-space sectors with at least one settled planet (the Lost Planet counts as settled)." },
  ],

  // --- 8 gold-frame federation tiles (one per ship) -------------------------
  federationsGold: [
    { id: "FEDG1", label: "金枠同盟：12VP（緑面あり）", labelEn: "Gold federation: 12 VP (has green side)", effect: "即時（1回）：12勝利点。基本ゲームの12VPタイルと異なり緑色面があるため、上級技術タイルの取得や研究レベル5への到達に使える。", effectEn: "Immediately (once): 12 VP. Unlike the base 12 VP tile it has a green side, so it can be spent for advanced tech or research level 5." },
    { id: "FEDG2", label: "金枠同盟：任意の技術タイル1枚", labelEn: "Gold federation: gain any tech tile", effect: "即時（1回）：任意の技術タイルを1枚得る。「既存の建造物の改良」アクションと同じルールが適用される。", effectEn: "Immediately (once): gain any tech tile, following the same rules as upgrading a structure." },
    { id: "FEDG3", label: "金枠同盟：距離無限の鉱山建設", labelEn: "Gold federation: build mine at any range", effect: "即時（1回）：到達可能距離が無限であるとして、鉱山のコストを支払わずに「鉱山の建設」を1回実行する。鉱石で惑星改造可。ガイア惑星に入植する場合は必要なQICを支払う。", effectEn: "Immediately (once): build a mine without paying its cost, treating range as unlimited. Ore may be paid for terraforming; settling a Gaia planet costs the usual QIC." },
    { id: "FEDG4", label: "金枠同盟：3段階無料改造＋鉱山建設", labelEn: "Gold federation: mine w/ 3 free terraform steps", effect: "即時（1回）：3段階までの無料の惑星改造を得て、鉱山のコストを支払わずに「鉱山の建設」を実行する。QIC支払いで到達可能距離を伸ばせる。", effectEn: "Immediately (once): build a mine without paying its cost, with up to 3 free terraforming steps; QIC may extend range." },
    { id: "FEDG5", label: "金枠同盟：4VP＋鉱石2＋QIC1", labelEn: "Gold federation: 4 VP + 2 ore + 1 QIC", effect: "即時：4勝利点と鉱石2とQ.I.C.駒1個。", effectEn: "Immediate: 4 VP, 2 ore and 1 QIC." },
    { id: "FEDG6", label: "金枠同盟：4VP＋知識4", labelEn: "Gold federation: 4 VP + 4 knowledge", effect: "即時：4勝利点と知識4。", effectEn: "Immediate: 4 VP and 4 knowledge." },
    { id: "FEDG7", label: "金枠同盟：7VP＋パワートークン2", labelEn: "Gold federation: 7 VP + 2 power tokens", effect: "即時：7勝利点とパワートークン2個（パワーエリアIIIへ）。", effectEn: "Immediate: 7 VP and 2 power tokens (to power area III)." },
    { id: "FEDG8", label: "金枠同盟：8VP＋クレジット8", labelEn: "Gold federation: 8 VP + 8 credits", effect: "即時：8勝利点とクレジット8。", effectEn: "Immediate: 8 VP and 8 credits." },
  ],

  // --- 13 artifact tokens (playerCount drawn onto Twilight) -----------------
  artifacts: [
    { id: "ART12", label: "収入：パワー駒2個（エリアIII）", labelEn: "Income: 2 power tokens (area III)", effect: "収入として、パワー駒を2個得てパワーエリアIIIに置く。", effectEn: "As income, gain 2 power tokens placed in power area III." },
    { id: "ART13", label: "収入：知識1＋鉱石1", labelEn: "Income: 1 knowledge + 1 ore", effect: "収入として、知識1と鉱石1を得る。", effectEn: "As income, gain 1 knowledge and 1 ore." },
    { id: "ART09", label: "即時：知識3＋QIC1", labelEn: "Immediate: 3 knowledge + 1 QIC", effect: "即時（1回）：知識3とQ.I.C.駒1個を得る。", effectEn: "Immediately (once): gain 3 knowledge and 1 QIC." },
    { id: "ART10", label: "即時：クレジット5＋鉱石2", labelEn: "Immediate: 5 credits + 2 ore", effect: "即時（1回）：クレジット5と鉱石2を得る。", effectEn: "Immediately (once): gain 5 credits and 2 ore." },
    { id: "ART11", label: "即時：クレジット3＋鉱石3", labelEn: "Immediate: 3 credits + 3 ore", effect: "即時（1回）：クレジット3と鉱石3を得る。", effectEn: "Immediately (once): gain 3 credits and 3 ore." },
    { id: "ART01", label: "7VP（小惑星鉱山扱い）", labelEn: "7 VP (counts as asteroid mine)", effect: "即時（1回）：7勝利点。獲得は小惑星に入植して鉱山を1つ建設したと見なされる（宙域には割り当てられない。原始惑星入植の6VPは得られない）。", effectEn: "Immediately (once): 7 VP. Gaining it counts as settling an asteroid with one mine (assigned to no sector)." },
    { id: "ART02", label: "7VP（原始惑星鉱山扱い）", labelEn: "7 VP (counts as proto-planet mine)", effect: "即時（1回）：7勝利点。獲得は原始惑星に入植して鉱山を1つ建設したと見なされる（宙域には割り当てられない）。", effectEn: "Immediately (once): 7 VP. Gaining it counts as settling a proto planet with one mine (assigned to no sector)." },
    { id: "ART03", label: "科学レベル×3VP", labelEn: "3 VP per Science level", effect: "即時（1回）：科学（知識）研究エリアで進んでいる1レベルごとに3勝利点を得る。", effectEn: "Immediately (once): gain 3 VP per level you have advanced in the Science research area." },
    { id: "ART04", label: "ガイア計画レベル×3VP", labelEn: "3 VP per Gaia Project level", effect: "即時（1回）：ガイア計画研究エリアで進んでいる1レベルごとに3勝利点を得る。", effectEn: "Immediately (once): gain 3 VP per level you have advanced in the Gaia Project research area." },
    { id: "ART05", label: "Lv3以上の研究×3VP", labelEn: "3 VP per research area at level 3+", effect: "即時（1回）：最低レベル3に到達している研究エリア1つごとに3勝利点を得る。", effectEn: "Immediately (once): gain 3 VP per research area where you have reached at least level 3." },
    { id: "ART06", label: "深宇宙宙域×3VP", labelEn: "3 VP per deep-space sector", effect: "即時（1回）：最低1つの惑星に入植している深宇宙宙域1つごとに3勝利点を得る。", effectEn: "Immediately (once): gain 3 VP per deep-space sector where you have settled at least one planet." },
    { id: "ART07", label: "3VP＋惑星種類×1VP", labelEn: "3 VP + 1 VP per planet type", effect: "即時（1回）：3勝利点と、入植している惑星の種類1つごとに1勝利点を得る。", effectEn: "Immediately (once): gain 3 VP plus 1 VP per planet type you have settled." },
    { id: "ART08", label: "同盟タイル1枚の恩恵を再取得", labelEn: "Re-gain one federation tile's benefits", effect: "即時（1回）：獲得済みの同盟タイル1枚の勝利点・資源・即時効果を再び得る。", effectEn: "Immediately (once): re-gain the VP, resources and immediate effects of one federation tile you own." },
  ],
};
