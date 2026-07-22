// src/gaia/setup/data.ts
//
// ⚠️ DRAFT CATALOG — pending user verification.
//
// The STRUCTURE here (how many tiles, which slots they fill) is what the
// randomizer in buildSetup.ts depends on, and is believed correct for the
// Gaia Project base game:
//   - 9 standard tech tiles  (6 under the research tracks + 3 free)
//   - 6 advanced tech tiles  (one per research track)
//   - 10 round boosters      (players + 3 used per game)
//   - 10 round scoring tiles (6 drawn, one per round)
//
// The `label`/`effect` TEXT is a best-effort first cut and MUST be checked
// against the physical components. Fixing a label never changes randomizer
// behavior (which keys off ids only), so corrections here are safe and local.
//
// Verification status:
//   - boosters:      ✅ verified against the rulebook (2026-07-21)
//   - standardTech:  ⚠️ DRAFT
//   - advancedTech:  ⚠️ DRAFT
//   - roundScoring:  ⚠️ DRAFT
//
// Lost Fleet expansion additions are NOT included yet — add them once the base
// catalog is confirmed.

import type { SetupCatalog } from "./types";

export const SETUP_CATALOG: SetupCatalog = {
  // --- 9 standard tech tiles ------------------------------------------------
  standardTech: [
    { id: "TS1", label: "鉱石収入 +1", labelEn: "+1 ore income", effect: "収入フェイズに鉱石 +1", effectEn: "+1 ore during income" },
    { id: "TS2", label: "知識収入 +1", labelEn: "+1 knowledge income", effect: "収入フェイズに知識 +1", effectEn: "+1 knowledge during income" },
    { id: "TS3", label: "クレジット収入 +3", labelEn: "+3 credits income", effect: "収入フェイズにクレジット +3", effectEn: "+3 credits during income" },
    { id: "TS4", label: "パワー収入 +1", labelEn: "+1 power income", effect: "収入フェイズにパワー +1", effectEn: "+1 power during income" },
    { id: "TS5", label: "QIC +1（アクション）", labelEn: "+1 QIC (action)", effect: "アクションで QIC +1", effectEn: "action: gain +1 QIC" },
    { id: "TS6", label: "得点：鉱山1つにつき +1VP", labelEn: "+1 VP per mine", effect: "即時：所有する鉱山1つにつき +1VP", effectEn: "immediate: +1 VP per mine owned" },
    { id: "TS7", label: "得点：交易所1つにつき +1VP", labelEn: "+1 VP per trading station", effect: "即時：交易所1つにつき +1VP", effectEn: "immediate: +1 VP per trading station" },
    { id: "TS8", label: "パワー4を得る（アクション）", labelEn: "gain 4 power (action)", effect: "アクション：パワー4をチャージ", effectEn: "action: charge 4 power" },
    { id: "TS9", label: "知識+1・クレジット+1（収入）", labelEn: "+1 knowledge, +1 credit income", effect: "収入：知識+1・クレジット+1", effectEn: "income: +1 knowledge and +1 credit" },
  ],

  // --- 6 advanced tech tiles ------------------------------------------------
  advancedTech: [
    { id: "AT1", label: "得点：セクター横断1つにつき +2VP", labelEn: "+2 VP per sector crossed", effectEn: "immediate: +2 VP per sector you occupy" },
    { id: "AT2", label: "得点：連盟トークン1つにつき +5VP", labelEn: "+5 VP per federation", effectEn: "immediate: +5 VP per federation token" },
    { id: "AT3", label: "鉱山建設で +3VP（パス毎）", labelEn: "+3 VP per mine built", effectEn: "pass/round: +VP for mines built" },
    { id: "AT4", label: "研究段階を進めるたび +2VP", labelEn: "+2 VP per research step", effectEn: "+2 VP each time you advance research" },
    { id: "AT5", label: "交易所1つにつき +3VP（アクション毎）", labelEn: "+3 VP per trading station", effectEn: "action-linked: +VP for trading stations" },
    { id: "AT6", label: "ガイア惑星1つにつき +2VP", labelEn: "+2 VP per Gaia planet", effectEn: "immediate: +2 VP per Gaia planet" },
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

  // --- 10 round scoring tiles -----------------------------------------------
  // forbiddenRounds are a DRAFT guess and are NOT yet enforced by the builder.
  roundScoring: [
    { id: "RS01", label: "鉱山建設で +2VP", labelEn: "+2 VP for building a mine" },
    { id: "RS02", label: "研究段階で +2VP", labelEn: "+2 VP for research step" },
    { id: "RS03", label: "交易所建設で +3VP", labelEn: "+3 VP for trading station" },
    { id: "RS04", label: "ガイア惑星で +3VP", labelEn: "+3 VP for Gaia planet" },
    { id: "RS05", label: "居住惑星種で +2VP", labelEn: "+2 VP per planet type settled" },
    { id: "RS06", label: "連盟で +5VP", labelEn: "+5 VP for federation" },
    { id: "RS07", label: "研究所建設で +3VP", labelEn: "+3 VP for research lab" },
    { id: "RS08", label: "要塞/学術都市で +5VP", labelEn: "+5 VP for PI/academy" },
    { id: "RS09", label: "鉱山4つにつき +? VP", labelEn: "+VP per set of mines" },
    { id: "RS10", label: "テラフォーミングで +2VP", labelEn: "+2 VP for terraforming step" },
  ],
};
