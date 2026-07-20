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
  boosters: [
    { id: "RB01", label: "パワー+1／鉱石+1（収入）", labelEn: "+1 power / +1 ore" },
    { id: "RB02", label: "知識+1／クレジット+1（収入）", labelEn: "+1 knowledge / +1 credit" },
    { id: "RB03", label: "QIC+1／知識+2（収入）", labelEn: "+1 QIC / +2 knowledge" },
    { id: "RB04", label: "鉱石+1／宇宙船移動+3（アクション）", labelEn: "+1 ore / +3 range action" },
    { id: "RB05", label: "パワートークン+2／即時+2VP", labelEn: "+2 power token / +2 VP" },
    { id: "RB06", label: "パス時：鉱山1つにつき +1VP", labelEn: "pass: +1 VP per mine" },
    { id: "RB07", label: "パス時：交易所1つにつき +2VP", labelEn: "pass: +2 VP per trading station" },
    { id: "RB08", label: "パス時：研究所1つにつき +3VP", labelEn: "pass: +3 VP per research lab" },
    { id: "RB09", label: "パス時：ガイア惑星1つにつき +1VP", labelEn: "pass: +1 VP per Gaia planet" },
    { id: "RB10", label: "パス時：要塞/学術都市1つにつき +4VP", labelEn: "pass: +4 VP per PI/academy" },
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
