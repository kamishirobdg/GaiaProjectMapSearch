// src/gaia/setup/data.ts
//
// ⚠️ DRAFT CATALOG — pending user verification.
//
// The STRUCTURE (how many tiles, which slots they fill) is what the randomizer
// in buildSetup.ts depends on. Counts verified against the rulebook component
// overview (2026-07-21):
//   - standard tech:  9 types x4 copies (one TYPE per slot: 6 tracks + 3 free)
//   - advanced tech:  15 tiles, 6 drawn (one per research track)
//   - round boosters: 10, of which (players + 3) are used
//   - round scoring:  7 types = 4 x1 + 3 x2 -> physical pool of 10; 6 drawn
//   - final scoring:  6 tiles, 2 drawn
//
// Verification status of the TEXT:
//   - boosters:      ✅ verified against the rulebook (2026-07-21)
//   - standardTech:  ⚠️ DRAFT (best-effort guesses)
//   - advancedTech:  ⚠️ PLACEHOLDER (icon-only image; awaiting rulebook text)
//   - roundScoring:  ⚠️ PLACEHOLDER (icon-only image; awaiting rulebook text)
//   - finalScoring:  ⚠️ PLACEHOLDER (icon-only image; awaiting rulebook text)
// Fixing label/effect text never changes randomizer behavior (ids only).
//
// Lost Fleet expansion additions are NOT included yet — add them once the base
// catalog is confirmed.

import type { SetupCatalog } from "./types";

export const SETUP_CATALOG: SetupCatalog = {
  // --- 9 standard tech tile types (x4 identical copies each) ----------------
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

  // --- 15 advanced tech tiles (6 drawn per game) ----------------------------
  // PLACEHOLDER: the component image is icon-only, so no effect text is
  // recorded yet. Ids AT01..AT15 will be mapped to the rulebook's tile
  // descriptions once provided.
  advancedTech: Array.from({ length: 15 }, (_, i) => {
    const n = String(i + 1).padStart(2, "0");
    return {
      id: `AT${n}`,
      label: `上級技術タイル ${i + 1}（内容未確認）`,
      labelEn: `Advanced tech tile ${i + 1} (unverified)`,
    };
  }),

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

  // --- 7 round scoring types (physical pool of 10; 6 drawn) -----------------
  // PLACEHOLDER: icon-only image; effect text pending. Per the rulebook
  // caption, the 4 types in the image's top row exist once (RS01..RS04) and
  // the 3 types in the bottom row exist twice (RS05..RS07, copies: 2), so
  // those can score up to two rounds in one game.
  roundScoring: [
    { id: "RS01", label: "ラウンド得点タイル 1（内容未確認）", labelEn: "Round scoring tile 1 (unverified)" },
    { id: "RS02", label: "ラウンド得点タイル 2（内容未確認）", labelEn: "Round scoring tile 2 (unverified)" },
    { id: "RS03", label: "ラウンド得点タイル 3（内容未確認）", labelEn: "Round scoring tile 3 (unverified)" },
    { id: "RS04", label: "ラウンド得点タイル 4（内容未確認）", labelEn: "Round scoring tile 4 (unverified)" },
    { id: "RS05", label: "ラウンド得点タイル 5（内容未確認）", labelEn: "Round scoring tile 5 (unverified)", copies: 2 },
    { id: "RS06", label: "ラウンド得点タイル 6（内容未確認）", labelEn: "Round scoring tile 6 (unverified)", copies: 2 },
    { id: "RS07", label: "ラウンド得点タイル 7（内容未確認）", labelEn: "Round scoring tile 7 (unverified)", copies: 2 },
  ],

  // --- 6 final scoring tiles (2 drawn per game) -----------------------------
  // PLACEHOLDER: icon-only image; effect text pending.
  finalScoring: [
    { id: "FS01", label: "最終得点タイル 1（内容未確認）", labelEn: "Final scoring tile 1 (unverified)" },
    { id: "FS02", label: "最終得点タイル 2（内容未確認）", labelEn: "Final scoring tile 2 (unverified)" },
    { id: "FS03", label: "最終得点タイル 3（内容未確認）", labelEn: "Final scoring tile 3 (unverified)" },
    { id: "FS04", label: "最終得点タイル 4（内容未確認）", labelEn: "Final scoring tile 4 (unverified)" },
    { id: "FS05", label: "最終得点タイル 5（内容未確認）", labelEn: "Final scoring tile 5 (unverified)" },
    { id: "FS06", label: "最終得点タイル 6（内容未確認）", labelEn: "Final scoring tile 6 (unverified)" },
  ],
};
