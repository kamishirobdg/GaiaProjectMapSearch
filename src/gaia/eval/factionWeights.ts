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
// - 同盟タイル（惑星改造Lv5）は到達者1人が取る単発の賞。VP量は共通なので
//   付随資源の相性のみ弱め（1）に見る（2026-07-25 に 全0 から変更）。
// - LFの金枠同盟・アーティファクトは全員が取り合う共有物なので原則0、
//   明確なアーキタイプ相性のみ非ゼロ（原則1）。
//
// 2026-07-31: LF4種族の値を追加（DRAFT、要レビュー）。根拠は LF ルールブック
// （web_GP_LostFleet_JPN.pdf「別表Ⅰ：新たな勢力」13ページ）の能力のみ。
// 各勢力ボードの初期資源・初期研究レベルは画像ページで読めていないので、
// 研究列の親和度は能力から推定した仮置き（下の TECH_TRACK_WEIGHTS 冒頭に明記）。
//   モウェイド人   : 惑星首府でパワーリング設置＝建造物のパワー値+2。初期から
//                    T.F.マーズに探査シャトル。→ パワー経済・同盟形成が主役。
//   スペースジャイアント: 通常惑星は常に惑星改造2段階。探査ボードに無料2段階改造
//                    付き鉱山建設。惑星首府で任意の技術タイル1枚。→ 改造・惑星種類。
//   ティンカーロイド: 初期配置で惑星首府を置く（＝以後は首府を建設できない）。
//                    応用研究タイルを毎ラウンド1枚。→ 早期の追加アクション。
//   ダルカニア人   : 通常惑星は全色が惑星改造1段階。惑星首府で未入植の宙域／
//                    深宇宙宙域に鉱山を建てると 2クレ+1知識。→ 広域展開。
// 共通: モウェイド人以外の3種族はガイア惑星の入植コストが Q.I.C.2個（標準の倍）。

import type { ResearchTrackId } from "@/gaia/setup/types";

/**
 * 18種族。基本14＋Lost Fleet の4（2026-07-30 ユーザー訂正。
 * 「LF は種族を追加しない」という以前の記述は誤りだった）。
 * LF の4種族は母星が原始惑星／小惑星で、基本7色には属さない。
 */
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
  | "itars"
  // --- Lost Fleet の4種族（母星＝原始惑星／小惑星） ---
  | "moweyds"
  | "spaceGiants"
  | "tinkerroids"
  | "darkanians";

export type FactionDef = {
  id: FactionId;
  /**
   * 母星色（マップ評価の PLANET_ORDER と同じ語彙。BLACK=チタニウム/灰色）。
   * LF の4種族は基本7色ではなく PROTO（原始惑星）/ ASTEROID（小惑星）。
   */
  color:
    | "BLACK"
    | "BLUE"
    | "BROWN"
    | "ORANGE"
    | "RED"
    | "WHITE"
    | "YELLOW"
    | "PROTO"
    | "ASTEROID";
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
  // Lost Fleet（2026-07-30 追加、重みは 2026-07-31 に DRAFT を投入＝要レビュー）。
  { id: "moweyds", color: "PROTO", labelJa: "モウェイド人", labelEn: "Moweyds" },
  { id: "spaceGiants", color: "PROTO", labelJa: "スペースジャイアント", labelEn: "Space Giants" },
  { id: "tinkerroids", color: "ASTEROID", labelJa: "ティンカーロイド", labelEn: "Tinkerroids" },
  { id: "darkanians", color: "ASTEROID", labelJa: "ダルカニア人", labelEn: "Darkanians" },
];

export const FACTION_IDS: readonly FactionId[] = FACTIONS.map((f) => f.id);

/** Lost Fleet で追加される4種族。 */
export const LF_FACTION_IDS: ReadonlySet<FactionId> = new Set<FactionId>([
  "moweyds",
  "spaceGiants",
  "tinkerroids",
  "darkanians",
]);

/**
 * その拡張で選べる勢力（基本版=14、Lost Fleet=18）。
 * **基本版では LF の4種族は使えない**ので、評価表にも出さず、上位K種族・
 * セット提案の選定対象にも入れない（2026-07-31 ユーザー確定）。
 * 重み自体は共通テーブルに持ったままで、絞り込みは参照側で行う。
 */
export function factionsForMode(lostFleet: boolean): FactionDef[] {
  return lostFleet ? FACTIONS : FACTIONS.filter((f) => !LF_FACTION_IDS.has(f.id));
}

/** 同上のID配列。 */
export function factionIdsForMode(lostFleet: boolean): readonly FactionId[] {
  return lostFleet ? FACTION_IDS : FACTION_IDS.filter((id) => !LF_FACTION_IDS.has(id));
}

/**
 * マップ特徴への親和度（母星色の供給量は全種族共通で基本点になるため、
 * ここにはガイア惑星・次元横断惑星への依存度だけを持つ）。
 * スコア寄与は mapFaction.ts で `0.5 * (gaia*ガイア数 + transdim*横断数)`。
 *
 * 2026-07-25 ユーザーレビュー反映:
 * - ガイア惑星（既成の緑惑星）依存はグリーンのみ。
 * - ガイアフォーマー（次元横断→ガイア化）依存は テラン(最高) > イタル(高い)
 *   > バルタック(他種族よりはあり) の順。
 *
 * 2026-07-31 LF4種族（DRAFT）: ガイアフォーマー依存は4種族とも無い（transdim なし）。
 * ガイア惑星の入植コストが Q.I.C.2個＝標準の倍になる3種族だけ、ガイア惑星の多い盤面が
 * 相対的に不利なので負値を置く。モウェイド人はガイア惑星のコストが標準なので0。
 * このテーブルで負値を使うのはここが初めて（式は素の線形和なので符号の制約はない）。
 */
export const MAP_AFFINITY: Partial<Record<FactionId, { gaia?: number; transdim?: number }>> = {
  gleens: { gaia: 2 },
  terrans: { transdim: 2 },
  itars: { transdim: 1.5 },
  balTaks: { transdim: 1 },
  spaceGiants: { gaia: -1 },
  tinkerroids: { gaia: -1 },
  darkanians: { gaia: -1 },
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
// LF4種族の親和度（2026-07-31 DRAFT）。勢力ボードの初期研究レベルが読めていないので、
// 能力から推定した仮置き —— ここが今回いちばん弱い部分で、要レビュー:
//   moweyds:経済2/航行1/改造1（パワー収入がパワーリング能力と相乗、LF船探査に距離）
//   spaceGiants:改造2/航行1（通常惑星が常に2段階＝改造トラックが直に効く）
//   tinkerroids:改造2/AI1/科学1（3種類の惑星が3段階、ガイアと距離に QIC が要る）
//   darkanians:航行2/経済1（未入植の宙域へ広げるのが得点源。改造は1段階で足りるので0）
export const TECH_TRACK_WEIGHTS: Record<
  string,
  Partial<Record<ResearchTrackId, Partial<Record<FactionId, number>>>>
> = {
  // TS1 即時:鉱石1+QIC1
  TS1: {
    terra: { xenos: 1, ivits: 1, geodens: 2, spaceGiants: 2, tinkerroids: 2 }, // 惑星改造
    nav:   { xenos: 1, ivits: 1, spaceGiants: 1, darkanians: 2 }, // 航行
    ai:    { xenos: 2, ivits: 2, geodens: 1, tinkerroids: 1 }, // 人工知能
    gaia:  {}, // ガイア計画
    eco:   { darkanians: 1 }, // 経済
    sci:   { tinkerroids: 1 }, // 科学
  },
  // TS2 即時:惑星種類×知識1
  TS2: {
    terra: { lantids: 1, xenos: 1, gleens: 2, geodens: 4, spaceGiants: 4 }, // 惑星改造
    nav:   { lantids: 1, xenos: 1, gleens: 1, spaceGiants: 2, darkanians: 2 }, // 航行
    ai:    { xenos: 2, geodens: 2 }, // 人工知能
    gaia:  { gleens: 1 }, // ガイア計画
    eco:   { darkanians: 1 }, // 経済
    sci:   { lantids: 2 }, // 科学
  },
  // TS3 首府学院のパワー値4
  TS3: {
    terra: { ambas: 1, moweyds: 2, tinkerroids: 4 }, // 惑星改造
    nav:   { taklons: 4, ambas: 2, moweyds: 2 }, // 航行
    ai:    { bescods: 1, tinkerroids: 2 }, // 人工知能
    gaia:  { itars: 2 }, // ガイア計画
    eco:   { taklons: 4, ambas: 1, bescods: 1, nevlas: 4, moweyds: 4 }, // 経済
    sci:   { bescods: 2, nevlas: 4, itars: 1, tinkerroids: 2 }, // 科学
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
    terra: { gleens: 2, geodens: 2, spaceGiants: 2, tinkerroids: 2, moweyds: 1 }, // 惑星改造
    nav:   { gleens: 1, taklons: 2, spaceGiants: 1, moweyds: 1 }, // 航行
    ai:    { geodens: 1, tinkerroids: 1 }, // 人工知能
    gaia:  { gleens: 1, itars: 2 }, // ガイア計画
    eco:   { taklons: 2, moweyds: 2 }, // 経済
    sci:   { itars: 1, tinkerroids: 1 }, // 科学
  },
  // TS6 収入:知識1+クレ1
  TS6: {
    terra: { lantids: 1, gleens: -2, tinkerroids: 2 }, // 惑星改造
    nav:   { lantids: 1, gleens: -1, darkanians: 2 }, // 航行
    ai:    { firaks: 1, bescods: 1, tinkerroids: 1 }, // 人工知能
    gaia:  { gleens: -1 }, // ガイア計画
    eco:   { firaks: 1, bescods: 1, nevlas: 2, darkanians: 1 }, // 経済
    sci:   { lantids: 2, firaks: 2, bescods: 2, nevlas: 2, tinkerroids: 1 }, // 科学
  },
  // TS7 ガイア鉱山+3VP（LF3種族はガイア惑星が Q.I.C.2個で割高＝逆風）
  TS7: {
    terra: { terrans: 2, gleens: 4, balTaks: 1, spaceGiants: -2, tinkerroids: -2 }, // 惑星改造
    nav:   { gleens: 2, spaceGiants: -1, darkanians: -2 }, // 航行
    ai:    { tinkerroids: -1 }, // 人工知能
    gaia:  { terrans: 4, gleens: 2, balTaks: 2, itars: 4 }, // ガイア計画
    eco:   { darkanians: -1 }, // 経済
    sci:   { terrans: 2, itars: 2, tinkerroids: -1 }, // 科学
  },
  // TS8 収入:クレ4
  TS8: {
    terra: { ambas: 1, hadschHallas: 2 }, // 惑星改造
    nav:   { taklons: 2, ambas: 2, darkanians: 4 }, // 航行
    ai:    {}, // 人工知能
    gaia:  {}, // ガイア計画
    eco:   { taklons: 2, ambas: 1, hadschHallas: 4, nevlas: 2, darkanians: 2 }, // 経済
    sci:   { nevlas: 2 }, // 科学
  },
  // TS9 アクション:パワー4
  TS9: {
    terra: { moweyds: 2 }, // 惑星改造
    nav:   { taklons: 4, moweyds: 2 }, // 航行
    ai:    { bescods: 1 }, // 人工知能
    gaia:  { itars: 2 }, // ガイア計画
    eco:   { taklons: 4, bescods: 1, nevlas: 4, moweyds: 4 }, // 経済
    sci:   { bescods: 2, nevlas: 4, itars: 1 }, // 科学
  },
};

/**
 * 自由列（トラックに紐付かない3枚）用のタイル別有用度（-1..2、非ゼロのみ）。
 * 研究列に関係なく取れるぶん、上のテーブルより低い係数で効かせる。DRAFT。
 */
export const TECH_PREF: Record<string, Partial<Record<FactionId, number>>> = {
  TS1: { xenos: 1, ivits: 1, geodens: 1, spaceGiants: 1, tinkerroids: 1, darkanians: 1 }, // 即時：鉱石1＋QIC1
  TS2: { geodens: 2, xenos: 1, lantids: 1, gleens: 1, spaceGiants: 2, darkanians: 1 }, // 即時：惑星種類×知識1
  TS3: { nevlas: 2, taklons: 2, ambas: 1, bescods: 1, itars: 1, moweyds: 2, tinkerroids: 2 }, // 首府・学院のパワー値4
  TS4: {}, // 即時：7VP（純粋な点数＝相性なし）
  TS5: { taklons: 1, itars: 1, geodens: 1, gleens: 1, spaceGiants: 1, tinkerroids: 1, moweyds: 1 }, // 収入：鉱石1・パワー1
  TS6: { firaks: 1, bescods: 1, nevlas: 1, lantids: 1, gleens: -1, tinkerroids: 1, darkanians: 1 }, // 収入：知識1・クレジット1
  TS7: { terrans: 2, gleens: 2, itars: 2, balTaks: 1, spaceGiants: -1, tinkerroids: -1, darkanians: -1 }, // ガイア惑星に鉱山建設で＋3VP
  TS8: { hadschHallas: 2, taklons: 1, nevlas: 1, ambas: 1, darkanians: 2 }, // 収入：クレジット4
  TS9: { taklons: 2, nevlas: 2, itars: 1, bescods: 1, moweyds: 2 }, // アクション：パワー4
};

/**
 * 標準技術の寄与スケール。他タイル（-2..+2 の素点合計）に対して
 * 支配的にならないよう、積（最大4）を圧縮する。DRAFT。
 */
export const STD_TECH_TRACK_SCALE = 0.5;
/** 自由列3枚（トラック制約なし）の係数。トラック分より軽くする。 */
export const STD_TECH_FREE_SCALE = 0.25;

/**
 * タイル id → 種族別重み。DRAFT — 全値レビュー対象（編集用の正本）。
 *
 * ★カタログの全タイルを列挙してある（空 {} ＝どの種族にも ± なし＝全0）。
 *   セルに「± がある種族と値」を書く。値の目安:
 *   2=主役級（そのタイル狙いで勢力を選べる） / 1=噛み合う / -1..-2=噛み合わない。
 *   ラウンド得点の ×2 表記は物理2枚のタイルで、出た枚数分このスコアが加算される。
 *
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
  // ===== 上級技術（15＋LF6） =====
  AT01: { ivits: 2, xenos: 1, ambas: 1, gleens: 1, moweyds: 2 }, // パス時：同盟タイル×3VP
  AT02: { firaks: 2, bescods: 1, nevlas: 1, lantids: 1, gleens: -1, tinkerroids: 1 }, // 研究を進めるたび＋2VP
  AT03: { hadschHallas: 1, nevlas: 1, taklons: 1 }, // アクション：QIC1＋クレジット5
  AT04: { lantids: 2, xenos: 1, geodens: 1, spaceGiants: 1 }, // 取得時：鉱山×2VP
  AT05: { firaks: 2, bescods: 1, lantids: 1, gleens: -1 }, // パス時：研究所×3VP
  AT06: { lantids: 1, ambas: 1, taklons: 1, darkanians: 1 }, // 取得時：宙域×鉱石1
  AT07: { geodens: 1, spaceGiants: 1 }, // アクション：鉱石3
  AT08: { terrans: 2, gleens: 2, itars: 2, balTaks: 1, spaceGiants: -1, tinkerroids: -1, darkanians: -1 }, // 取得時：ガイア惑星×2VP
  AT09: { hadschHallas: 1, taklons: 1 }, // 取得時：交易所×4VP
  AT10: { lantids: 1, ambas: 1, xenos: 1, taklons: 1, darkanians: 2 }, // 取得時：宙域×2VP
  AT11: { hadschHallas: 1, nevlas: 1 }, // 交易所を建設するたび＋3VP
  AT12: { ivits: 2, ambas: 1, xenos: 1, gleens: 1, moweyds: 2 }, // 取得時：同盟タイル×5VP
  AT13: { bescods: 1, firaks: 1, tinkerroids: 1 }, // アクション：知識3
  AT14: { lantids: 2, geodens: 1, xenos: 1, spaceGiants: 1, darkanians: 1 }, // 鉱山を建設するたび＋3VP
  AT15: { geodens: 2, lantids: 1, xenos: 1, gleens: 1, spaceGiants: 2, darkanians: 1 }, // パス時：惑星種類×1VP
  // AT16: ティンカーロイドは初期配置で惑星首府を置いているので取得時点で即6VP。
  AT16: { nevlas: 1, ambas: 1, itars: 1, tinkerroids: 2, moweyds: 1 }, // 取得時：首府・学院×6VP
  AT17: { lantids: 1, xenos: 1, taklons: 1, darkanians: 1 }, // 取得時：深宇宙宙域×4VP
  AT18: { balTaks: -1, tinkerroids: 1, darkanians: 1 }, // パス時：小惑星×2VP
  // AT19/RS09: ダルカニア人は通常惑星が全色1段階なので改造段階数が積み上がらない＝逆風。
  AT19: { geodens: 2, xenos: 1, lantids: 1, moweyds: 1, tinkerroids: 1, spaceGiants: 1, darkanians: -1 }, // 惑星改造1段階ごと＋2VP
  AT20: { hadschHallas: 1, xenos: 1 }, // QICアクションのたび＋4VP
  AT21: { lantids: 1, xenos: 1, taklons: 1, darkanians: 1 }, // パス時：深宇宙宙域×2VP

  // ===== ラウンドブースター（10＋LF4） =====
  RB01: { geodens: 1, gleens: 1, firaks: 1, bescods: 1, spaceGiants: 1, tinkerroids: 1 }, // 収入：鉱石1・知識1（改造勢の鉱石＋研究勢の知識）
  RB02: { xenos: 1, ivits: 1, hadschHallas: 1, tinkerroids: 1 }, // 収入：クレジット2・QIC1（QIC勢＋クレ経済）
  RB03: { itars: 1, taklons: 1, moweyds: 1 }, // 収入：パワートークン2・鉱石1
  RB04: { geodens: 1, xenos: 1, spaceGiants: 1, darkanians: 1 }, // 収入：クレジット2／特別：鉱山建設（改造1無料）
  RB05: { balTaks: 2, terrans: 1, itars: 1, darkanians: 1 }, // 収入：パワー2／特別：鉱山建設orガイア計画（距離+3）
  RB06: { lantids: 1, xenos: 1 }, // 収入：鉱石1／パス：鉱山×1VP
  RB07: { firaks: 2, bescods: 1 }, // 収入：知識1／パス：研究所×3VP
  RB08: { hadschHallas: 1 }, // 収入：鉱石1／パス：交易所×2VP
  // RB09/RS04: ティンカーロイドは初期配置で首府を置くので「首府を建設」では得点できない。
  RB09: { nevlas: 1, ambas: 1, moweyds: 1, tinkerroids: -1 }, // 収入：パワー4／パス：学院・首府×4VP
  RB10: { gleens: 2, terrans: 1, hadschHallas: 1 }, // 収入：クレジット4／パス：ガイア惑星×1VP
  RB11: { balTaks: 2, terrans: 1, itars: 1 }, // 収入：鉱石1／パス：ガイアフォーマー×3VP
  RB12: { geodens: 1, lantids: 1, gleens: 1, spaceGiants: 1, darkanians: 1 }, // 収入：鉱石1／パス：惑星種類×1VP
  RB13: { lantids: 1, xenos: 1, darkanians: 2 }, // 収入：クレジット3／パス：深宇宙×2VP
  RB14: { terrans: 1, balTaks: 1, itars: 1 }, // 収入：パワー2／特別：ガイア計画（即変換）

  // ===== ラウンド得点（9＋LF3、copies>1は枚数分加算） =====
  RS01: { lantids: 1, xenos: 1, geodens: 1, spaceGiants: 1, darkanians: 1 }, // 鉱山建設 +2VP
  RS02: { hadschHallas: 1, nevlas: 1, taklons: 1 }, // 交易所建設 +3VP
  RS03: { hadschHallas: 1, nevlas: 1, taklons: 1 }, // 交易所建設 +4VP
  RS04: { ambas: 1, nevlas: 1, itars: 1, bescods: 1, tinkerroids: -1 }, // 学院・惑星首府建設 +5VP ×2
  RS05: { terrans: 2, gleens: 2, itars: 2, balTaks: 1, spaceGiants: -1, tinkerroids: -1, darkanians: -1 }, // ガイア惑星に鉱山建設 +3VP
  RS06: { terrans: 2, gleens: 2, itars: 2, balTaks: 1, spaceGiants: -1, tinkerroids: -1, darkanians: -1 }, // ガイア惑星に鉱山建設 +4VP
  RS07: { firaks: 2, bescods: 1, nevlas: 1, lantids: 1, gleens: -1, tinkerroids: 1 }, // 研究1レベル +2VP
  RS08: { ivits: 2, ambas: 1, xenos: 1, moweyds: 2 }, // 同盟タイル獲得 +5VP
  RS09: { geodens: 2, xenos: 1, moweyds: 1, tinkerroids: 1, spaceGiants: 1, darkanians: -1 }, // 惑星改造1段階 +2VP
  RS10: { lantids: 1, ambas: 1, xenos: 1, taklons: 1, darkanians: 2 }, // 未入植の宙域で鉱山建設 +3VP
  RS11: { geodens: 2, lantids: 1, gleens: 1, spaceGiants: 2, darkanians: 2 }, // 未入植の種類の惑星に鉱山建設 +3VP
  RS12: { firaks: 2, bescods: 1, lantids: 1, gleens: -1 }, // 研究所建設 +4VP

  // ===== 最終得点（6＋LF3） =====
  FS01: { ivits: 2, ambas: 1, xenos: 1, moweyds: 1 }, // 同盟内の建造物 最多
  FS02: { lantids: 2, xenos: 1, taklons: 1, darkanians: 1 }, // 建造物 最多
  FS03: { geodens: 2, lantids: 1, gleens: 1, xenos: 1, spaceGiants: 2, darkanians: 2 }, // 惑星の種類 最多
  FS04: { terrans: 2, gleens: 2, itars: 2, balTaks: 1, spaceGiants: -1, tinkerroids: -1, darkanians: -1 }, // ガイア惑星 最多
  FS05: { lantids: 1, ambas: 1, taklons: 1, ivits: -1, darkanians: 2 }, // 入植宙域 最多
  FS06: { ivits: 2 }, // 衛星 最多
  // FS07: ティンカーロイド／ダルカニア人は小惑星から開始するので1つ先行している。
  FS07: { balTaks: -1, tinkerroids: 1, darkanians: 1 }, // 小惑星 最多
  FS08: { ambas: 2, tinkerroids: 1 }, // 首府⇔学院の距離 最長
  FS09: { lantids: 1, xenos: 1, taklons: 1, darkanians: 2 }, // 深宇宙宙域 最多

  // ===== 同盟タイル（惑星改造Lv5） =====
  // 改造Lv5に到達した1人だけが取る単発の賞。VP量は同じなので、
  // 付随資源の相性だけを弱め（1）に見る。12VP は純粋な点数＝相性なし。
  FED12: {}, // 同盟：12VP
  FED8Q: { xenos: 1, ivits: 1, spaceGiants: 1, tinkerroids: 1, darkanians: 1 }, // 同盟：8VP＋QIC1
  FED8PT: { taklons: 1, nevlas: 1, itars: 1, moweyds: 1 }, // 同盟：8VP＋パワートークン2
  FED7O: { geodens: 1, gleens: 1, spaceGiants: 1 }, // 同盟：7VP＋鉱石2
  FED7C: { hadschHallas: 1, darkanians: 1 }, // 同盟：7VP＋クレジット6
  FED6K: { firaks: 1, bescods: 1, nevlas: 1, tinkerroids: 1 }, // 同盟：6VP＋知識2

  // ===== LF 船の基本技術 =====
  TSL1: { geodens: 1, spaceGiants: 1, moweyds: 1, tinkerroids: 1 }, // 即時：2段階無料改造＋鉱山建設
  TSL2: { balTaks: 2, gleens: 1, darkanians: 2, moweyds: 1 }, // 基本到達距離＋1
  TSL3: { firaks: 1, bescods: 1, nevlas: 1, lantids: 1, tinkerroids: 1 }, // 即時：鉱石1＋知識3

  // ===== LF 金枠同盟 =====
  FEDG1: {}, // 金枠同盟：12VP（緑面あり）＝純粋な点数
  FEDG2: { firaks: 1, bescods: 1, itars: 1, spaceGiants: 1 }, // 金枠同盟：任意の技術タイル1枚
  FEDG3: { balTaks: 1, darkanians: 2 }, // 金枠同盟：距離無限の鉱山建設
  // FEDG4: モウェイド人／ティンカーロイドは3種類の惑星が3段階改造なので3段階無料が刺さる。
  FEDG4: { geodens: 2, gleens: 1, lantids: 1, moweyds: 2, tinkerroids: 2, spaceGiants: 1 }, // 金枠同盟：3段階無料改造＋鉱山建設
  FEDG5: { xenos: 1, geodens: 1, spaceGiants: 1 }, // 金枠同盟：4VP＋鉱石2＋QIC1
  FEDG6: { firaks: 1, bescods: 1, nevlas: 1, tinkerroids: 1 }, // 金枠同盟：4VP＋知識4
  FEDG7: { taklons: 1, nevlas: 1, itars: 1, moweyds: 1 }, // 金枠同盟：7VP＋パワートークン2
  FEDG8: { hadschHallas: 1, darkanians: 1 }, // 金枠同盟：8VP＋クレジット8

  // ===== LF アーティファクト =====
  // 全員で取り合う共有物なので、明確なアーキタイプ相性のみ非ゼロ（原則1）。
  // ART01/ART02 は小惑星／原始惑星の鉱山として数えるが、原始惑星入植の6VPは対象外
  // （ルールブック15ページ）。小惑星最多への寄与は全勢力共通なので0のままにしてある。
  ART01: {}, // 7VP（小惑星鉱山扱い）＝純粋な点数
  ART02: {}, // 7VP（原始惑星鉱山扱い）＝純粋な点数
  ART03: { bescods: 1, firaks: 1, tinkerroids: 1 }, // 科学レベル×3VP
  ART04: { terrans: 1, balTaks: 1, itars: 1 }, // ガイア計画レベル×3VP
  ART05: { firaks: 1 }, // Lv3以上の研究×3VP
  ART06: { lantids: 1, xenos: 1, taklons: 1, darkanians: 1 }, // 深宇宙宙域×3VP
  ART07: { geodens: 1, lantids: 1, gleens: 1, spaceGiants: 1, darkanians: 1 }, // 3VP＋惑星種類×1VP
  ART08: { ivits: 1, ambas: 1, xenos: 1, moweyds: 1 }, // 同盟タイル1枚の恩恵を再取得
  ART09: { firaks: 1, bescods: 1, nevlas: 1, tinkerroids: 1 }, // 即時：知識3＋QIC1
  ART10: { hadschHallas: 1, geodens: 1 }, // 即時：クレジット5＋鉱石2
  ART11: { geodens: 1, gleens: 1, spaceGiants: 1 }, // 即時：クレジット3＋鉱石3
  ART12: { taklons: 1, nevlas: 1, itars: 1, moweyds: 1 }, // 収入：パワー駒2個（エリアIII）
  ART13: { firaks: 1, bescods: 1, geodens: 1, spaceGiants: 1, tinkerroids: 1 }, // 収入：知識1＋鉱石1
};
