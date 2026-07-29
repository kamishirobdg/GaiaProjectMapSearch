// src/gaia/eval/factionWeights.ts
//
// ⚠️ DRAFT — 種族別重みの素案（2026-07-24、ユーザーレビュー待ち）。
// 一覧タブの「推奨セットアップ」用データ。値はすべて -2..+2 の粗い整数で、
// 「そのタイル/マップ特徴が その種族をどれだけ有利にするか」の相対値。
// 非ゼロのみ記載（記載なし＝0）。数値を直すだけで挙動が変わる純データ。
//
// 設計メモ:
// - 標準技術タイル9種は毎ゲーム全部場に出るが、「どの研究トラックの下に付くか」
//   はセットアップごとに変わる。2026-07-25 のレビューを受け、トラック配置を
//   TRACK_AFFINITY × TECH_PREF の積で評価する（下部の「標準技術のトラック別評価」）。
// - 同盟タイル（惑星改造Lv5）は全員が同条件で1枚のみ → 全種族0とする。
// - LFの金枠同盟・アーティファクトは全員が取り合う共有物なので原則0、
//   明確なアーキタイプ相性のみ非ゼロ。

import type { ResearchTrackId } from "@/gaia/setup/types";

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
  { id: "terrans", color: "BLUE", labelJa: "地球人", labelEn: "Terrans" },
  { id: "lantids", color: "BLUE", labelJa: "ランティダ人", labelEn: "Lantids" },
  { id: "xenos", color: "YELLOW", labelJa: "ゼノ族", labelEn: "Xenos" },
  { id: "gleens", color: "YELLOW", labelJa: "グリーン人", labelEn: "Gleens" },
  { id: "taklons", color: "BROWN", labelJa: "タクロン族", labelEn: "Taklons" },
  { id: "ambas", color: "BROWN", labelJa: "アンバス人", labelEn: "Ambas" },
  { id: "hadschHallas", color: "RED", labelJa: "ハッシュ・ホラ人", labelEn: "Hadsch Hallas" },
  { id: "ivits", color: "RED", labelJa: "ダー・シュワーム人", labelEn: "Ivits" },
  { id: "geodens", color: "ORANGE", labelJa: "ジオデン人", labelEn: "Geodens" },
  { id: "balTaks", color: "ORANGE", labelJa: "バルタック人", labelEn: "Bal T'aks" },
  { id: "firaks", color: "BLACK", labelJa: "フィラク族", labelEn: "Firaks" },
  { id: "bescods", color: "BLACK", labelJa: "マッドアンドロイド", labelEn: "Bescods" },
  { id: "nevlas", color: "WHITE", labelJa: "ネヴラ人", labelEn: "Nevlas" },
  { id: "itars", color: "WHITE", labelJa: "イタル人", labelEn: "Itars" },
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

// --- 標準技術のトラック別評価（2026-07-25 案1 DRAFT） ---------------------
//
// 標準技術9種は毎ゲーム全部場に出るが、「6種がどの研究トラックの下に付くか」
// はセットアップごとに変わる。トラック下のタイルは そのトラックを1段上げる
// ついでに手に入る ので、価値は「そのトラックを登りたいか」×「そのタイルが
// 有用か」で決まる。
//
// ★ここが編集用の正本テーブル（研究列 × 技術タイル）。
//   セルに「そのタイルがその研究列に置かれたとき ± がある種族と値」を書く。
//   記載なし＝0。値の目安: 4=主役級 / 2=得意 / 1=噛み合う / -1..-2=噛み合わない。
//   寄与 = TECH_TRACK_WEIGHTS[タイル][研究列][種族] × STD_TECH_TRACK_SCALE
//
// 初期値は「トラック親和度(0..2) × タイル有用度(-1..2)」で機械生成したもの。
// 参考にした親和度（＝その種族が登りたい列）:
//   terrans:ガイア2/改造1/科学1  lantids:科学2/航行1/改造1  xenos:AI2/改造1/航行1
//   gleens:改造2/ガイア1/航行1（科学0＝研究苦手）  taklons:経済2/航行2
//   ambas:航行2/改造1/経済1  hadschHallas:経済2/改造1  ivits:AI2/航行1/改造1
//   geodens:改造2/AI1  balTaks:ガイア2/改造1（航行0＝登れない）
//   firaks:科学2/AI1/経済1  bescods:科学2/AI1/経済1  nevlas:科学2/経済2
//   itars:ガイア2/科学1
export const TECH_TRACK_WEIGHTS: Record<
  string,
  Partial<Record<ResearchTrackId, Partial<Record<FactionId, number>>>>
> = {
  // TS1 即時:鉱石1+QIC1
  TS1: {
    terra: { xenos: 1, ivits: 1, geodens: 2 }, // 惑星改造
    nav:   { xenos: 1, ivits: 1 }, // 航行
    ai:    { xenos: 2, ivits: 2, geodens: 1 }, // 人工知能
    gaia:  {}, // ガイア計画
    eco:   {}, // 経済
    sci:   {}, // 科学
  },
  // TS2 即時:惑星種類×知識1
  TS2: {
    terra: { lantids: 1, xenos: 1, gleens: 2, geodens: 4 }, // 惑星改造
    nav:   { lantids: 1, xenos: 1, gleens: 1 }, // 航行
    ai:    { xenos: 2, geodens: 2 }, // 人工知能
    gaia:  { gleens: 1 }, // ガイア計画
    eco:   {}, // 経済
    sci:   { lantids: 2 }, // 科学
  },
  // TS3 首府学院のパワー値4
  TS3: {
    terra: { ambas: 1 }, // 惑星改造
    nav:   { taklons: 4, ambas: 2 }, // 航行
    ai:    { bescods: 1 }, // 人工知能
    gaia:  { itars: 2 }, // ガイア計画
    eco:   { taklons: 4, ambas: 1, bescods: 1, nevlas: 4 }, // 経済
    sci:   { bescods: 2, nevlas: 4, itars: 1 }, // 科学
  },
  // TS4 即時:7VP（純粋な点数＝相性なし）
  TS4: {
    terra: {}, // 惑星改造
    nav:   {}, // 航行
    ai:    {}, // 人工知能
    gaia:  {}, // ガイア計画
    eco:   {}, // 経済
    sci:   {}, // 科学
  },
  // TS5 収入:鉱石1+パワー1
  TS5: {
    terra: { gleens: 2, geodens: 2 }, // 惑星改造
    nav:   { gleens: 1, taklons: 2 }, // 航行
    ai:    { geodens: 1 }, // 人工知能
    gaia:  { gleens: 1, itars: 2 }, // ガイア計画
    eco:   { taklons: 2 }, // 経済
    sci:   { itars: 1 }, // 科学
  },
  // TS6 収入:知識1+クレ1
  TS6: {
    terra: { lantids: 1, gleens: -2 }, // 惑星改造
    nav:   { lantids: 1, gleens: -1 }, // 航行
    ai:    { firaks: 1, bescods: 1 }, // 人工知能
    gaia:  { gleens: -1 }, // ガイア計画
    eco:   { firaks: 1, bescods: 1, nevlas: 2 }, // 経済
    sci:   { lantids: 2, firaks: 2, bescods: 2, nevlas: 2 }, // 科学
  },
  // TS7 ガイア鉱山+3VP
  TS7: {
    terra: { terrans: 2, gleens: 4, balTaks: 1 }, // 惑星改造
    nav:   { gleens: 2 }, // 航行
    ai:    {}, // 人工知能
    gaia:  { terrans: 4, gleens: 2, balTaks: 2, itars: 4 }, // ガイア計画
    eco:   {}, // 経済
    sci:   { terrans: 2, itars: 2 }, // 科学
  },
  // TS8 収入:クレ4
  TS8: {
    terra: { ambas: 1, hadschHallas: 2 }, // 惑星改造
    nav:   { taklons: 2, ambas: 2 }, // 航行
    ai:    {}, // 人工知能
    gaia:  {}, // ガイア計画
    eco:   { taklons: 2, ambas: 1, hadschHallas: 4, nevlas: 2 }, // 経済
    sci:   { nevlas: 2 }, // 科学
  },
  // TS9 アクション:パワー4
  TS9: {
    terra: {}, // 惑星改造
    nav:   { taklons: 4 }, // 航行
    ai:    { bescods: 1 }, // 人工知能
    gaia:  { itars: 2 }, // ガイア計画
    eco:   { taklons: 4, bescods: 1, nevlas: 4 }, // 経済
    sci:   { bescods: 2, nevlas: 4, itars: 1 }, // 科学
  },
};

/**
 * 自由列（トラックに紐付かない3枚）用のタイル別有用度（-1..2、非ゼロのみ）。
 * 研究列に関係なく取れるぶん、上のテーブルより低い係数で効かせる。DRAFT。
 */
export const TECH_PREF: Record<string, Partial<Record<FactionId, number>>> = {
  TS1: { xenos: 1, ivits: 1, geodens: 1 }, // 即時：鉱石1＋QIC1
  TS2: { geodens: 2, xenos: 1, lantids: 1, gleens: 1 }, // 即時：惑星種類×知識1
  TS3: { nevlas: 2, taklons: 2, ambas: 1, bescods: 1, itars: 1 }, // 首府・学院のパワー値4
  TS4: {}, // 即時：7VP（純粋な点数＝相性なし）
  TS5: { taklons: 1, itars: 1, geodens: 1, gleens: 1 }, // 収入：鉱石1・パワー1
  TS6: { firaks: 1, bescods: 1, nevlas: 1, lantids: 1, gleens: -1 }, // 収入：知識1・クレジット1
  TS7: { terrans: 2, gleens: 2, itars: 2, balTaks: 1 }, // ガイア惑星に鉱山建設で＋3VP
  TS8: { hadschHallas: 2, taklons: 1, nevlas: 1, ambas: 1 }, // 収入：クレジット4
  TS9: { taklons: 2, nevlas: 2, itars: 1, bescods: 1 }, // アクション：パワー4
};

/**
 * 標準技術の寄与スケール。他タイル（-2..+2 の素点合計）に対して
 * 支配的にならないよう、積（最大4）を圧縮する。DRAFT。
 */
export const STD_TECH_TRACK_SCALE = 0.5;
/** 自由列3枚（トラック制約なし）の係数。トラック分より軽くする。 */
export const STD_TECH_FREE_SCALE = 0.25;

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
