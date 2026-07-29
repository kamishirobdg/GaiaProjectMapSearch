// src/gaia/eval/factionWeights.ts
//
// ⚠️ DRAFT — 種族別重みの素案（2026-07-24、ユーザーレビュー待ち）。
// 一覧タブの「推奨セットアップ」用データ。値はすべて -2..+2 の粗い整数で、
// 「そのタイル/マップ特徴が その種族をどれだけ有利にするか」の相対値。
// 非ゼロのみ記載（記載なし＝0）。数値を直すだけで挙動が変わる純データ。
//
// 設計メモ:
// - 標準技術タイル9種は毎ゲーム全部場に出る（配置差のみ）ため、セットアップ
//   間の差別化に寄与しない → セットアップ評価からは除外（重みも定義しない）。
// - 同盟タイル（惑星改造Lv5）は全員が同条件で1枚のみ → 全種族0とする。
// - LFの金枠同盟・アーティファクトは全員が取り合う共有物なので原則0、
//   明確なアーキタイプ相性のみ非ゼロ。

/** 14種族（基本ゲーム。Lost Fleet は種族を追加しない）。 */
export type FactionId =
  | "terrans"
  | "lantids"
  | "xenos"
  | "gleens"
  | "taklons"
  | "ambas"
  | "hadschHallas"
  | "ivits"
  | "geodens"
  | "balTaks"
  | "firaks"
  | "bescods"
  | "nevlas"
  | "itars";

export type FactionDef = {
  id: FactionId;
  /** 母星色（マップ評価の PLANET_ORDER と同じ語彙。BLACK=チタニウム/灰色） */
  color: "BLACK" | "BLUE" | "BROWN" | "ORANGE" | "RED" | "WHITE" | "YELLOW";
  labelJa: string;
  labelEn: string;
};

export const FACTIONS: FactionDef[] = [
  { id: "terrans", color: "BLUE", labelJa: "テラン", labelEn: "Terrans" },
  { id: "lantids", color: "BLUE", labelJa: "ランティド", labelEn: "Lantids" },
  { id: "xenos", color: "YELLOW", labelJa: "ゼノ", labelEn: "Xenos" },
  { id: "gleens", color: "YELLOW", labelJa: "グリーン", labelEn: "Gleens" },
  { id: "taklons", color: "BROWN", labelJa: "タクロン", labelEn: "Taklons" },
  { id: "ambas", color: "BROWN", labelJa: "アンバス", labelEn: "Ambas" },
  { id: "hadschHallas", color: "RED", labelJa: "ハッシュ・ホラ", labelEn: "Hadsch Hallas" },
  { id: "ivits", color: "RED", labelJa: "イヴィッツ", labelEn: "Ivits" },
  { id: "geodens", color: "ORANGE", labelJa: "ジオデン", labelEn: "Geodens" },
  { id: "balTaks", color: "ORANGE", labelJa: "バルタック", labelEn: "Bal T'aks" },
  { id: "firaks", color: "BLACK", labelJa: "フィラク", labelEn: "Firaks" },
  { id: "bescods", color: "BLACK", labelJa: "ベスコド", labelEn: "Bescods" },
  { id: "nevlas", color: "WHITE", labelJa: "ネヴラ", labelEn: "Nevlas" },
  { id: "itars", color: "WHITE", labelJa: "イタル", labelEn: "Itars" },
];

export const FACTION_IDS: readonly FactionId[] = FACTIONS.map((f) => f.id);

/**
 * マップ特徴への親和度（母星色の供給量は全種族共通で基本点になるため、
 * ここにはガイア惑星・次元横断惑星への依存度だけを持つ）。
 * スコア寄与は mapFaction.ts で `0.5 * (gaia*ガイア数 + transdim*横断数)`。
 *
 * 2026-07-25 ユーザーレビュー反映:
 * - ガイア惑星（既成の緑惑星）依存はグリーンのみ。
 * - ガイアフォーマー（次元横断→ガイア化）依存は テラン(最高) > イタル(高い)
 *   > バルタック(他種族よりはあり) の順。
 */
export const MAP_AFFINITY: Partial<Record<FactionId, { gaia?: number; transdim?: number }>> = {
  gleens: { gaia: 2 },
  terrans: { transdim: 2 },
  itars: { transdim: 1.5 },
  balTaks: { transdim: 1 },
};

/**
 * タイル id → 種族別重み（非ゼロのみ）。DRAFT — 全値レビュー対象。
 * 根拠はアーキタイプの通説ベース（2026-07-25 レビュー反映）:
 *   lantids=入植数/widespread・研究得意、firaks/bescods/nevlas=研究、
 *   gleens=ガイア得点だが研究は苦手（研究タイルは負値）、
 *   ivits=単一大同盟・衛星、geodens=惑星種類・改造、
 *   terrans/gleens/itars=ガイア得点（イタルもメイン）、hadschHallas=クレ経済、
 *   ambas=首府スワップ、nevlas=パワー経済・学院、itars=トークン→技術、
 *   bescods=灰色/技術、xenos=多鉱山・同盟数、
 *   taklons=経済＋航法＋広域展開（パワー受動が増える程強い）、
 *   balTaks=ガイアフォーマー（航行弱い／小惑星化＝消費は不利）。
 */
export const TILE_FACTION_WEIGHTS: Record<string, Partial<Record<FactionId, number>>> = {
  // --- 上級技術（15＋LF6） ---
  AT01: { ivits: 2, xenos: 1, ambas: 1, gleens: 1 }, // パス時：同盟×3VP
  AT02: { firaks: 2, bescods: 1, nevlas: 1, lantids: 1, gleens: -1 }, // 研究を進めるたび+2VP（研究系: ランティド得意/グリーン苦手）
  AT03: { hadschHallas: 1, nevlas: 1, taklons: 1 }, // アクション：QIC1+クレ5（経済系: ネヴラ/タクロンも得意）
  AT04: { lantids: 2, xenos: 1, geodens: 1 }, // 取得時：鉱山×2VP
  AT05: { firaks: 2, bescods: 1, lantids: 1, gleens: -1 }, // パス時：研究所×3VP（研究系: ランティド得意/グリーン苦手）
  AT06: { lantids: 1, ambas: 1, taklons: 1 }, // 取得時：宙域×鉱石1（タクロンは広域展開）
  AT07: { geodens: 1 }, // アクション：鉱石3
  AT08: { terrans: 2, gleens: 2, itars: 2, balTaks: 1 }, // 取得時：ガイア×2VP（イタルもメイン）
  AT09: { hadschHallas: 1, taklons: 1 }, // 取得時：交易所×4VP
  AT10: { lantids: 1, ambas: 1, xenos: 1, taklons: 1 }, // 取得時：宙域×2VP（タクロンは広域展開）
  AT11: { hadschHallas: 1, nevlas: 1 }, // 交易所建設ごと+3VP
  AT12: { ivits: 2, ambas: 1, xenos: 1, gleens: 1 }, // 取得時：同盟×5VP
  AT13: { bescods: 1, firaks: 1 }, // アクション：知識3
  AT14: { lantids: 2, geodens: 1, xenos: 1 }, // 鉱山建設ごと+3VP
  AT15: { geodens: 2, lantids: 1, xenos: 1, gleens: 1 }, // パス時：惑星種類×1VP
  AT16: { nevlas: 1, ambas: 1, itars: 1 }, // 取得時：首府・学院×6VP (LF)
  AT17: { lantids: 1, xenos: 1, taklons: 1 }, // 取得時：深宇宙×4VP (LF、タクロンは広域展開)
  AT18: { balTaks: -1 }, // パス時：小惑星×2VP (LF、小惑星=ガイアフォーマー消費でバルタックはむしろ不利)
  AT19: { geodens: 2, xenos: 1, lantids: 1 }, // 改造1段階ごと+2VP (LF)
  AT20: { hadschHallas: 1, xenos: 1 }, // QICアクションごと+4VP (LF)
  AT21: { lantids: 1, xenos: 1, taklons: 1 }, // パス時：深宇宙×2VP (LF、タクロンは広域展開)

  // --- ラウンドブースター（10＋LF4） ---
  RB03: { itars: 1, taklons: 1 }, // 収入：PT2+鉱石1
  RB04: { geodens: 1, xenos: 1 }, // 特別：鉱山建設(改造1無料)
  RB05: { balTaks: 2, terrans: 1, itars: 1 }, // 特別：鉱山orガイア計画(距離+3)
  RB06: { lantids: 1, xenos: 1 }, // パス：鉱山×1VP
  RB07: { firaks: 2, bescods: 1 }, // パス：研究所×3VP
  RB08: { hadschHallas: 1 }, // パス：交易所×2VP
  RB09: { nevlas: 1, ambas: 1 }, // パス：学院・首府×4VP
  RB10: { gleens: 2, terrans: 1, hadschHallas: 1 }, // パス：ガイア×1VP
  RB11: { balTaks: 2, terrans: 1, itars: 1 }, // パス：ガイアフォーマー×3VP (LF)
  RB12: { geodens: 1, lantids: 1, gleens: 1 }, // パス：惑星種類×1VP (LF)
  RB13: { lantids: 1, xenos: 1 }, // パス：深宇宙×2VP (LF)
  RB14: { terrans: 1, balTaks: 1, itars: 1 }, // 特別：ガイア計画(即変換) (LF)

  // --- ラウンド得点（9種＋LF3、×2はエンジン側で枚数分加算） ---
  RS01: { lantids: 1, xenos: 1, geodens: 1 }, // 鉱山+2VP
  RS02: { hadschHallas: 1, nevlas: 1, taklons: 1 }, // 交易所+3VP（経済系: ネヴラ/タクロンも得意）
  RS03: { hadschHallas: 1, nevlas: 1, taklons: 1 }, // 交易所+4VP（経済系: ネヴラ/タクロンも得意）
  RS04: { ambas: 1, nevlas: 1, itars: 1, bescods: 1 }, // 学院/首府+5VP
  RS05: { terrans: 2, gleens: 2, itars: 2, balTaks: 1 }, // ガイア鉱山+3VP（イタルもメイン）
  RS06: { terrans: 2, gleens: 2, itars: 2, balTaks: 1 }, // ガイア鉱山+4VP（イタルもメイン）
  RS07: { firaks: 2, bescods: 1, nevlas: 1, lantids: 1, gleens: -1 }, // 研究+2VP（研究系: ランティド得意/グリーン苦手）
  RS08: { ivits: 2, ambas: 1, xenos: 1 }, // 同盟+5VP
  RS09: { geodens: 2, xenos: 1 }, // 改造1段階+2VP
  RS10: { lantids: 1, ambas: 1, xenos: 1, taklons: 1 }, // 未入植宙域で鉱山+3VP (LF、タクロンは広域展開)
  RS11: { geodens: 2, lantids: 1, gleens: 1 }, // 未入植種類に鉱山+3VP (LF)
  RS12: { firaks: 2, bescods: 1, lantids: 1, gleens: -1 }, // 研究所+4VP (LF、研究系: ランティド得意/グリーン苦手)

  // --- 最終得点（6＋LF3） ---
  FS01: { ivits: 2, ambas: 1, xenos: 1 }, // 同盟内建造物 最多
  FS02: { lantids: 2, xenos: 1, taklons: 1 }, // 建造物 最多（タクロンは広域展開）
  FS03: { geodens: 2, lantids: 1, gleens: 1, xenos: 1 }, // 惑星種類 最多
  FS04: { terrans: 2, gleens: 2, itars: 2, balTaks: 1 }, // ガイア 最多（イタルもメイン）
  FS05: { lantids: 1, ambas: 1, taklons: 1, ivits: -1 }, // 入植宙域 最多（タクロン広域/イヴィッツは一極集中）
  FS06: { ivits: 2 }, // 衛星 最多（宇宙ステーションが衛星扱い）
  FS07: { balTaks: -1 }, // 小惑星 最多 (LF、ガイアフォーマー消費でバルタックはむしろ不利)
  FS08: { ambas: 2 }, // 首府⇔学院 距離最長 (LF、首府スワップで操作可能)
  FS09: { lantids: 1, xenos: 1, taklons: 1 }, // 深宇宙 最多 (LF、タクロンは広域展開)

  // --- LF 宇宙船まわり（共有物のため原則0、明確な相性のみ） ---
  TSL1: { geodens: 1 }, // 2段階無料改造+鉱山
  TSL2: { balTaks: 2, gleens: 1 }, // 基本到達距離+1（バルタックは航行が弱い）
  FEDG3: { balTaks: 1 }, // 距離無限の鉱山建設
  ART03: { bescods: 1, firaks: 1 }, // 科学レベル×3VP
  ART04: { terrans: 1, balTaks: 1, itars: 1 }, // ガイア計画レベル×3VP
  ART05: { firaks: 1 }, // Lv3以上の研究×3VP
};
