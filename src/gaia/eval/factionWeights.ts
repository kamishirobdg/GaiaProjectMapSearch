// src/gaia/eval/factionWeights.ts
//
// 種別重みテーブル。一覧タブの「推奨セットアップ」用データ。値はすべて粗い整数で、
// 「そのタイル/マップ特徴が その種族をどれだけ有利にするか」の相対値。
// 非ゼロのみ記載（記載なし＝0）。数値を直すだけで挙動が変わる純データ。
//
// 2026-08-01: **18種族 × 全タイルを1つずつ見直した**（ユーザー指示）。
// 根拠はルールブックの実文:
//   - 基本14種族の能力／惑星首府 = 基本版ルールブック p20-21「別表Ⅰ：勢力」
//     （画像ページ。pypdfium2 でレンダリングして読む）
//   - LF4種族 = web_GP_LostFleet_JPN.pdf p13「別表Ⅰ：新たな勢力」
//   - 原始惑星／小惑星の入植コスト = 同 p10「1) 鉱山の建設」
//     原始惑星＝全勢力とも3段階（入植で6VP、開始惑星からは得られない）／
//     小惑星＝ガイアフォーマー1個を使い捨て（改造段階は不要・建設コストも不要）
// **各勢力ボードの初期研究レベルだけは今も未確認**（ルールブックの別表になく、
// 勢力ボードの画像にしかない）。研究列の親和度はそのぶん能力からの推定を含む。
//
// 設計メモ:
// - 標準技術タイル9種は毎ゲーム全部場に出るが、「どの研究トラックの下に付くか」
//   はセットアップごとに変わる。2026-07-31 に TRACK_AFFINITY × TECH_PREF の積を
//   やめ、TECH_POSITION_WEIGHTS[タイル][配置][種族] の1つの表へ統合した
//   （フリー枠は研究列6つの最大値として自動で決まる）。**種族×研究列だけの
//   親和度テーブルはもう無い** —— 親和度は各セルの値に溶け込んでいる。
// - 同盟タイル（惑星改造Lv5）は到達者1人が取る単発の賞。VP量は共通なので
//   付随資源の相性のみ弱め（1）に見る。
// - LFの金枠同盟・アーティファクトは全員が取り合う共有物なので原則0、
//   明確なアーキタイプ相性のみ非ゼロ（原則1）。
// - カテゴリの重さ（1枚あたりの影響力）は評価指数 DEFAULT_SETUP_WEIGHTS 側で表す。
//   ここの値は「そのタイルとその種族の噛み合い」だけを見る。
//
// LF4種族（p13 の原文どおり）:
//   モウェイド人   : 開始は原始惑星、鉱山1個。初期から T.F.マーズに探査シャトル。
//                    通常惑星は3種類が3段階・他は1段階の改造。惑星首府＝ラウンド1回、
//                    自分の建造物のある惑星にパワーリングを置き、その惑星の建造物の
//                    パワー値を+2。→ パワー経済・同盟形成。ガイアのQIC倍加は無い。
//   スペースジャイアント: 開始は原始惑星、鉱山1個。通常惑星は**常に2段階**改造。
//                    探査ボードに**ラウンドごとに1回**使える「無料2段階改造＋鉱山建設」
//                    特別アクション（p10）。惑星首府＝**1回だけ**任意の技術タイル1枚。
//                    → 毎ラウンド鉱山が増える＝鉱山数・惑星種類・改造段階の主役。
//   ティンカーロイド: 開始は小惑星、鉱山2個の代わりに**惑星首府**を置く。通常惑星は
//                    3種類が3段階・他は1段階。応用研究タイルを毎ラウンド1枚選び、
//                    惑星首府でそのアクションを実行。→ 早期の追加アクション。
//   ダルカニア人   : 開始は小惑星、鉱山1個。通常惑星は**全色が1段階**改造（全勢力中最安）。
//                    惑星首府＝未入植の宙域／深宇宙宙域に鉱山を建てると 2クレ+1知識。
//                    → 広域展開。
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
  geodens: { gaia: 2 },
  spaceGiants: { gaia: -1 },
  tinkerroids: { gaia: -1 },
  darkanians: { gaia: -1 },
};

// --- 標準技術のトラック別評価 ---------------------------------------------
//
// 標準技術9種は毎ゲーム全部場に出るが、「6種がどの研究トラックの下に付くか」
// はセットアップごとに変わる。トラック下のタイルは そのトラックを1段上げる
// ついでに手に入る ので、価値は「そのトラックを登りたいか」×「そのタイルが
// 有用か」で決まる。
//
// ★ここが編集用の正本テーブル（研究列 × 技術タイル）。
//   セルに「そのタイルがその列の下に置かれたとき ± がある種族と値」を書く。
//   記載なし＝0。値の目安: 4=主役級 / 2=得意 / 1=噛み合う / -1..-2=噛み合わない。
//   寄与 = techPositionCell(タイル, 配置)[種族] × STD_TECH_SCALE
//
// **フリー枠はここに書かない**（2026-08-01）。研究列6つの最大値として
// `techPositionCell()` が計算する。理由はその関数のコメントを参照
// （ルールブック p13: フリー枠は「任意の研究エリア」を進められるので、
// どのトラック配置に対しても完全な上位互換）。
// 副作用: 負の値はフリー枠では 0 になる（記載のない列＝0 が最大値として選ばれる）。
// 嫌なタイルでも、フリー枠にあるなら取らずに済むので損はしない、という意味。
//
// 値は「トラック親和度(0..2) × タイル有用度(-2..2)」の積。
// 親和度（＝その種族が登りたい列。2026-08-01 に見直し。**初期研究レベルは未確認**なので
// 能力からの推定を含む）:
//   terrans:ガイア2/改造1/科学1     lantids:科学2/航行1/改造1   xenos:AI2/改造1/航行1
//   gleens:改造2/ガイア2/航行1（科学0＝研究苦手）              taklons:経済2/航行2
//   ambas:航行2/改造1/経済1         hadschHallas:経済2/改造1    ivits:AI2/航行1/改造1
//   geodens:改造2/AI1               balTaks:ガイア2/改造1（航行0＝そもそも登れない）
//   firaks:科学2/AI1/経済1          bescods:科学2/AI1/経済1     nevlas:科学2/経済2
//   itars:ガイア2/科学1
// LF4種族:
//   moweyds:経済2/航行1/改造1（パワー収入がパワーリング能力と相乗、LF船探査に距離）
//   spaceGiants:改造2/航行1（通常惑星が常に2段階＝改造トラックが直に効く）
//   tinkerroids:改造2/AI1/科学1（3種類の惑星が3段階、ガイアと距離に QIC が要る）
//   darkanians:航行2/経済1（未入植の宙域へ広げるのが得点源。改造は1段階で足りるので0）
// 2026-08-01 の変更点: グリーン人のガイアを 1→2（ガイア惑星の鉱山が自前の+2VPと重なる
// のが勝ち筋なので、ガイア列を登りたい度合いは改造と同格）。
/** 標準技術の置き場所: 研究列6つ、または列に紐付かないフリー枠。 */
export type TechPosition = ResearchTrackId | "free";

/**
 * 標準技術の重みテーブル（タイル → 研究列 → 種族 → 値）。
 *
 * **研究列6つだけを書く。フリー枠は書かない**（2026-08-01）。
 * ルールブック p13「技術タイルの獲得」:
 *   - 研究エリアの真下の6枚 → **その研究エリアでのみ**マーカーを進められる。
 *     そこで進められない場合、その進展分は失われる。
 *   - 他の3枚（フリー枠） → **任意の研究エリア1つ**を進められる。
 * つまりフリー枠は常にトラック配置の完全な上位互換で、フリー枠に置かれることの
 * 利益は「登りたい列を選べる」ことに尽きる。だから
 *   **free = そのタイルの研究列6つのうち最大値**
 * が正しく、`techPositionCell()` がそれを計算する（データには持たない）。
 * 値を直すときは研究列だけ触ればよく、フリー枠は自動で追随する。
 */
export type TechPositionTable = Record<
  string,
  Partial<Record<ResearchTrackId, Partial<Record<FactionId, number>>>>
>;

/**
 * ★編集用の正本（**通常版**）。基本14種族ぶん。
 *
 * 2026-08-01: ユーザー作成の CSV（Tile_Score_通常.csv）から機械生成した。
 * 手で写すと 9タイル×6列×14種族＝756セルの写し間違いが避けられないため:
 *   生成   python scripts/gen_tech_position_table.py <csv>      → この中身を差し替え
 *   検算   python scripts/gen_tech_position_table.py <csv> --check（全セル・両方向）
 * 値を直すときはこのファイルを直接編集してよい（CSV は履歴。
 * techPositionBase.test.ts は CSV ではなくこの表の構造だけを見る）。
 *
 * LF の4種族（モウェイド人・スペースジャイアント・ティンカーロイド・ダルカニア人）は
 * **通常版では選べない**ので、この表には入れない（記載なし＝0）。
 *
 * 通常版と拡張版で値を分ける理由（ユーザー 2026-08-01）:
 * 拡張の有無で場に出るタイルの母集団が変わり、同じ標準技術タイルでも
 * 相対的な影響力が変わるため。
 */
export const TECH_POSITION_WEIGHTS_BASE: TechPositionTable = {
  // TS1 即時:鉱石1+QIC1
  TS1: {
    terra: { lantids: 1, xenos: 3, taklons: 2, ambas: 3, hadschHallas: 3, ivits: 3, geodens: 1, balTaks: 2, firaks: 3, nevlas: 2, itars: 2 }, // 惑星改造
    nav:   { lantids: 2, xenos: 3, gleens: -1, taklons: 2, ambas: 3, hadschHallas: 3, ivits: 3, geodens: 2, balTaks: -1, firaks: 2, bescods: 2, nevlas: 2, itars: 2 }, // 航行
    ai:    { lantids: 2, xenos: 3, taklons: 2, ambas: 3, hadschHallas: 3, ivits: 3, balTaks: 2, nevlas: 2, itars: 2 }, // 人工知能
    gaia:  { gleens: -1, balTaks: 1, itars: 2 }, // ガイア計画
    eco:   { lantids: 1, xenos: 2, taklons: 2, ambas: 2, hadschHallas: 3, ivits: 2, firaks: 3, bescods: 1, nevlas: 2, itars: 2 }, // 経済
    sci:   { nevlas: 1 }, // 科学
  },
  // TS2 即時:惑星種類×知識1
  TS2: {
    terra: { taklons: 1, ivits: 2, geodens: 4, balTaks: 2, nevlas: 2 }, // 惑星改造
    nav:   { gleens: -1, taklons: 1, geodens: 3 }, // 航行
    ai:    { xenos: 2, taklons: 2, ambas: 2, hadschHallas: 2, ivits: 2, geodens: 5, balTaks: 2, firaks: 1, nevlas: 2, itars: 1 }, // 人工知能
    gaia:  { terrans: -1, gleens: -1 }, // ガイア計画
    eco:   { geodens: 1 }, // 経済
    sci:   { taklons: 1, geodens: 1, nevlas: 2 }, // 科学
  },
  // TS3 首府学院のパワー値4
  TS3: {
    terra: { lantids: 1, bescods: 1 }, // 惑星改造
    nav:   { terrans: 2, lantids: 1, gleens: 1, taklons: 1, ambas: 1, bescods: 2 }, // 航行
    ai:    { lantids: 1, xenos: 1, taklons: 1, bescods: 2, itars: 1 }, // 人工知能
    gaia:  { terrans: 2, lantids: -1, xenos: -1, gleens: 2, taklons: -2, ambas: -1, hadschHallas: -1, ivits: 1, geodens: -1, balTaks: 2, bescods: 1, nevlas: -2, itars: 2 }, // ガイア計画
    eco:   { taklons: 1, hadschHallas: 1, firaks: 1, bescods: 2, nevlas: 1, itars: 1 }, // 経済
    sci:   {}, // 科学
  },
  // TS4 即時:7VP
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
    terra: { terrans: 1, lantids: 2, xenos: 2, gleens: 2, taklons: 2, ambas: 2, hadschHallas: 2, ivits: 2, geodens: 2, balTaks: 2, firaks: 2, bescods: 1, nevlas: 2, itars: 2 }, // 惑星改造
    nav:   { terrans: 2, lantids: 2, xenos: 2, gleens: 2, taklons: 3, ambas: 3, hadschHallas: 3, ivits: 3, geodens: 2, firaks: 1, bescods: 3, nevlas: 2, itars: 3 }, // 航行
    ai:    { xenos: 2, taklons: 1, ambas: 1, hadschHallas: 1, ivits: 1, firaks: 1, nevlas: 1, itars: 2 }, // 人工知能
    gaia:  { terrans: 2, gleens: 2, taklons: -2, ivits: 1, balTaks: 3, nevlas: -2, itars: 2 }, // ガイア計画
    eco:   { lantids: 3, xenos: 2, taklons: 3, ambas: 3, hadschHallas: 3, ivits: 3, geodens: 1, balTaks: 2, firaks: 3, bescods: 2, nevlas: 3, itars: 3 }, // 経済
    sci:   { taklons: 1, geodens: 1, nevlas: 1 }, // 科学
  },
  // TS6 収入:知識1+クレ1
  TS6: {
    terra: { lantids: 2, taklons: 2, ambas: 2, hadschHallas: 2, ivits: 1, geodens: 2, balTaks: 2, firaks: 2, bescods: 1, nevlas: 1, itars: 1 }, // 惑星改造
    nav:   { terrans: 2, lantids: 2, xenos: 2, gleens: 2, taklons: 3, ambas: 3, hadschHallas: 2, ivits: 2, geodens: 2, firaks: 2, bescods: 2, nevlas: 2, itars: 2 }, // 航行
    ai:    { terrans: 1, lantids: 1, xenos: 2, taklons: 1, ambas: 2, ivits: 2, bescods: 1, itars: 1 }, // 人工知能
    gaia:  { terrans: 3, hadschHallas: -1, balTaks: 3, nevlas: -1, itars: 2 }, // ガイア計画
    eco:   { lantids: 2, taklons: 2, ambas: 3, hadschHallas: 3, ivits: 3, geodens: 2, balTaks: 2, firaks: 3, bescods: 2, nevlas: 3, itars: 1 }, // 経済
    sci:   { terrans: 1, lantids: 2, gleens: 3, taklons: 2, ambas: 2, hadschHallas: 2, ivits: 1, geodens: 1, balTaks: 1, firaks: 3, bescods: 1, nevlas: 3, itars: 2 }, // 科学
  },
  // TS7 ガイア鉱山+3VP
  TS7: {
    terra: { terrans: 2, gleens: 2 }, // 惑星改造
    nav:   { terrans: 4, gleens: 4, itars: 1 }, // 航行
    ai:    { terrans: 2, balTaks: 2, itars: 1 }, // 人工知能
    gaia:  { terrans: 4, gleens: 4, ivits: 1, balTaks: 1, bescods: 2, itars: 2 }, // ガイア計画
    eco:   { terrans: 1, gleens: 1 }, // 経済
    sci:   { terrans: 1, gleens: 1 }, // 科学
  },
  // TS8 収入:クレ4
  TS8: {
    terra: { terrans: 2, lantids: 2, xenos: 2, gleens: 3, taklons: 2, ambas: 2, hadschHallas: 2, ivits: 2, geodens: 2, balTaks: 2, firaks: 2, bescods: 2, nevlas: 2, itars: 2 }, // 惑星改造
    nav:   { terrans: 3, lantids: 3, xenos: 3, gleens: 4, taklons: 3, ambas: 4, hadschHallas: 4, ivits: 3, geodens: 3, firaks: 3, bescods: 3, nevlas: 3, itars: 3 }, // 航行
    ai:    { terrans: 1, lantids: 1, xenos: 3, taklons: 1, ambas: 1, hadschHallas: 1, ivits: 1, geodens: 1, balTaks: 1, firaks: 1, bescods: 1, nevlas: 1, itars: 1 }, // 人工知能
    gaia:  { terrans: 4, gleens: 3, balTaks: 4, bescods: 1 }, // ガイア計画
    eco:   { terrans: 2, lantids: 3, xenos: 3, gleens: 2, taklons: 3, ambas: 3, hadschHallas: 4, ivits: 2, geodens: 2, balTaks: 3, firaks: 3, bescods: 3, nevlas: 3, itars: 3 }, // 経済
    sci:   { lantids: 1, xenos: 1, ambas: 1, hadschHallas: 1, ivits: 1, firaks: 1, bescods: 2, nevlas: 1, itars: 1 }, // 科学
  },
  // TS9 アクション:パワー4
  TS9: {
    terra: { lantids: 2, xenos: 1, gleens: 1, taklons: 3, ambas: 2, hadschHallas: 2, ivits: 2, geodens: 2, balTaks: 2, firaks: 2, bescods: 2, nevlas: 3, itars: 2 }, // 惑星改造
    nav:   { terrans: 3, lantids: 3, xenos: 3, gleens: 3, taklons: 5, ambas: 3, hadschHallas: 3, ivits: 3, geodens: 3, firaks: 3, bescods: 3, nevlas: 3, itars: 2 }, // 航行
    ai:    { xenos: 3, taklons: 3, ambas: 2, hadschHallas: 2, ivits: 2, geodens: 2, balTaks: 2, firaks: 2, bescods: 2, nevlas: 2, itars: 2 }, // 人工知能
    gaia:  { terrans: 3, gleens: 3, taklons: -3, ivits: 1, balTaks: 4, bescods: 2, nevlas: -2, itars: 2 }, // ガイア計画
    eco:   { lantids: 3, xenos: 2, gleens: 2, taklons: 5, ambas: 3, hadschHallas: 4, ivits: 3, geodens: 2, balTaks: 2, firaks: 4, bescods: 3, nevlas: 4, itars: 2 }, // 経済
    sci:   { terrans: 2, nevlas: 1 }, // 科学
  },
};

/**
 * ★編集用の正本（**Lost Fleet 版**）。18種族ぶん。
 *
 * 2026-08-01: 拡張の有無で同じタイルの影響力が変わるため、通常版
 * （TECH_POSITION_WEIGHTS_BASE）と別テーブルにした。参照は
 * `techPositionCell(tileId, pos, lostFleet)` を通すこと。
 *
 * **この表はまだ通常版の CSV が反映されていない**（2026-08-01 時点の値のまま）。
 * 拡張版の値が出来たら差し替える。
 */
export const TECH_POSITION_WEIGHTS_LF: TechPositionTable = {
  // TS1 即時:鉱石1+QIC1
  // ダー・シュワーム人は衛星をQICで払う唯一の勢力＝QICが直接得点になる。
  // グリーン人はQICを得られず鉱石に化けるので、QIC付きのタイルは1枚ぶん損。
  TS1: {
    terra: { ivits: 2, geodens: 2, spaceGiants: 2, tinkerroids: 2, xenos: 1, balTaks: 1, gleens: -2 }, // 惑星改造
    nav:   { ivits: 2, darkanians: 2, xenos: 1, spaceGiants: 1, gleens: -1 }, // 航行
    ai:    { ivits: 4, xenos: 2, geodens: 1, tinkerroids: 1 }, // 人工知能
    gaia:  { balTaks: 2, gleens: -2 }, // ガイア計画
    eco:   { darkanians: 1 }, // 経済
    sci:   { tinkerroids: 1 }, // 科学
  },
  // TS2 即時:惑星種類×知識1
  // ランティダ人の「他プレイヤーの惑星に置く鉱山」は惑星の種類に数えないので対象外。
  TS2: {
    terra: { geodens: 4, spaceGiants: 4, gleens: 2, tinkerroids: 2, xenos: 1 }, // 惑星改造
    nav:   { darkanians: 4, spaceGiants: 2, gleens: 1, xenos: 1 }, // 航行
    ai:    { xenos: 2, geodens: 2, tinkerroids: 1 }, // 人工知能
    gaia:  { gleens: 2 }, // ガイア計画
    eco:   { darkanians: 2 }, // 経済
    sci:   { tinkerroids: 1 }, // 科学
  },
  // TS3 首府学院のパワー値4
  // パワー値は「受動的にチャージする量」と「同盟のパワー値合計」の両方に効く。
  // ティンカーロイドは初期配置で首府が出ているので1ラウンド目から乗る。
  TS3: {
    terra: { tinkerroids: 4, moweyds: 2, ambas: 1, ivits: 1, xenos: 1 }, // 惑星改造
    nav:   { taklons: 4, ambas: 2, moweyds: 2, ivits: 1, xenos: 1 }, // 航行
    ai:    { ivits: 2, xenos: 2, tinkerroids: 2, bescods: 1 }, // 人工知能
    gaia:  { itars: 2 }, // ガイア計画
    eco:   { taklons: 4, nevlas: 4, moweyds: 4, ambas: 1, bescods: 1 }, // 経済
    sci:   { nevlas: 4, bescods: 2, tinkerroids: 2, itars: 1 }, // 科学
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
  // スペースジャイアントは通常惑星が常に2段階改造＝鉱石の消費がいちばん重い。
  TS5: {
    terra: { spaceGiants: 4, geodens: 2, gleens: 2, tinkerroids: 2, moweyds: 1 }, // 惑星改造
    nav:   { taklons: 2, spaceGiants: 2, gleens: 1, moweyds: 1 }, // 航行
    ai:    { geodens: 1, tinkerroids: 1 }, // 人工知能
    gaia:  { gleens: 2, itars: 2 }, // ガイア計画
    eco:   { taklons: 2, nevlas: 2, moweyds: 2 }, // 経済
    sci:   { nevlas: 2, itars: 1, tinkerroids: 1 }, // 科学
  },
  // TS6 収入:知識1+クレ1
  TS6: {
    terra: { tinkerroids: 2, lantids: 1, gleens: -2 }, // 惑星改造
    nav:   { darkanians: 2, lantids: 1, gleens: -1 }, // 航行
    ai:    { firaks: 1, bescods: 1, tinkerroids: 1 }, // 人工知能
    gaia:  { gleens: -2 }, // ガイア計画
    eco:   { nevlas: 2, firaks: 1, bescods: 1, darkanians: 1 }, // 経済
    sci:   { lantids: 2, firaks: 2, bescods: 2, nevlas: 2, tinkerroids: 1 }, // 科学
  },
  // TS7 ガイア鉱山+3VP
  // グリーン人は自前の「ガイア惑星に鉱山で+2VP」と重なって1つの鉱山が5VPになる。
  // LF3種族はガイア惑星の入植が Q.I.C.2個で割高＝逆風。
  TS7: {
    terra: { gleens: 4, terrans: 2, balTaks: 1, spaceGiants: -2, tinkerroids: -2 }, // 惑星改造
    nav:   { gleens: 2, spaceGiants: -1, darkanians: -2 }, // 航行
    ai:    { tinkerroids: -1 }, // 人工知能
    gaia:  { terrans: 4, gleens: 4, itars: 4, balTaks: 2 }, // ガイア計画
    eco:   { darkanians: -1 }, // 経済
    sci:   { terrans: 2, itars: 2, tinkerroids: -1 }, // 科学
  },
  // TS8 収入:クレ4
  // ハッシュ・ホラ人のPIは「パワーの代わりにクレジットを払う」＝クレジットが第2のパワー。
  TS8: {
    terra: { hadschHallas: 2, ambas: 1 }, // 惑星改造
    nav:   { darkanians: 4, taklons: 2, ambas: 2 }, // 航行
    ai:    {}, // 人工知能
    gaia:  {}, // ガイア計画
    eco:   { hadschHallas: 4, taklons: 2, nevlas: 2, darkanians: 2, ambas: 1 }, // 経済
    sci:   { nevlas: 2 }, // 科学
  },
  // TS9 アクション:パワー4
  // ネヴラ人はエリアⅢのトークンが2パワー、モウェイド人はパワーリングで建造物の
  // パワー値+2、タクロン族はブレインストーンと受動チャージ＝どれもパワー総量が主資源。
  TS9: {
    terra: { moweyds: 2 }, // 惑星改造
    nav:   { taklons: 4, moweyds: 2 }, // 航行
    ai:    { bescods: 1 }, // 人工知能
    gaia:  { itars: 2 }, // ガイア計画
    eco:   { taklons: 4, nevlas: 4, moweyds: 4, bescods: 1 }, // 経済
    sci:   { nevlas: 4, bescods: 2, itars: 1 }, // 科学
  },
};

/** 研究列6つ（フリー枠を除いた配置）。`free` の計算に使う。 */
const TECH_TRACK_POSITIONS: readonly ResearchTrackId[] = [
  "terra",
  "nav",
  "ai",
  "gaia",
  "eco",
  "sci",
];

/**
 * その拡張で使う標準技術のテーブル。
 * 拡張の有無で場に出るタイルの母集団が変わり、同じタイルでも相対的な影響力が
 * 変わるため、通常版と拡張版で別の値を持つ（ユーザー 2026-08-01）。
 */
export function techPositionTable(lostFleet: boolean): TechPositionTable {
  return lostFleet ? TECH_POSITION_WEIGHTS_LF : TECH_POSITION_WEIGHTS_BASE;
}

/** `${base|lf}:${tileId}` → 計算した free 枠のセル（初回だけ作る）。 */
const freeCellCache = new Map<string, Partial<Record<FactionId, number>>>();

function computeFreeCell(tileId: string, lostFleet: boolean): Partial<Record<FactionId, number>> {
  const tile = techPositionTable(lostFleet)[tileId];
  const out: Partial<Record<FactionId, number>> = {};
  if (!tile) return out;
  for (const f of FACTION_IDS) {
    // 記載のない列は0。**6列すべての最大値**を取るので、どこか1列でも
    // 記載が無ければ 0 が下限になる（＝嫌なタイルでもフリー枠なら取らずに済む）。
    let best = 0;
    for (const pos of TECH_TRACK_POSITIONS) {
      const v = tile[pos]?.[f] ?? 0;
      if (v > best) best = v;
    }
    if (best !== 0) out[f] = best;
  }
  return out;
}

/**
 * 標準技術1枚ぶんの重み（配置ごと）。**参照はここを通すこと。**
 *
 * フリー枠はデータに持たず、研究列6つの**最大値**として計算する（2026-08-01）。
 * 根拠はルールブック p13「技術タイルの獲得」——
 * 研究エリアの真下の6枚は「その研究エリアでのみ」マーカーを進められ、進められない
 * 場合は進展分が失われる。フリー枠の3枚は「任意の研究エリア1つ」を進められる。
 * つまりフリー枠はどのトラック配置に対しても完全な上位互換で、フリー枠であることの
 * 利益は「登りたい列を選べる」ことに尽きる。だから最大値を取るのが正しい。
 *
 * 副作用として、**編集するのは研究列だけでよい**（フリー枠は自動で追随する）。
 */
export function techPositionCell(
  tileId: string,
  pos: TechPosition,
  lostFleet: boolean
): Partial<Record<FactionId, number>> | undefined {
  const table = techPositionTable(lostFleet);
  if (pos !== "free") return table[tileId]?.[pos];
  if (!table[tileId]) return undefined;
  const key = `${lostFleet ? "lf" : "base"}:${tileId}`;
  let cell = freeCellCache.get(key);
  if (!cell) {
    cell = computeFreeCell(tileId, lostFleet);
    freeCellCache.set(key, cell);
  }
  return cell;
}

// --- 拡張ごとのタイル重み上書き（2026-08-01）--------------------------------
//
// TILE_FACTION_WEIGHTS は通常版・拡張版で共通の正本。拡張の有無で影響力が
// 変わるタイルだけ、ここに Lost Fleet 用の値を書いて上書きする。
// **いまは空**（ユーザー: 標準技術以外は影響が小さいので当面は共通でよい。
// 上級技術は今後値を分ける可能性があるので、仕組みだけ用意しておく）。
//
// 書き方は TILE_FACTION_WEIGHTS と同じで、**タイル単位で丸ごと差し替える**
// （部分マージはしない。半端に混ざると追えなくなるため）。
//   TILE_FACTION_WEIGHTS_LF = { AT08: { terrans: 3, gleens: 2, ... } }

export const TILE_FACTION_WEIGHTS_LF: Record<string, Partial<Record<FactionId, number>>> = {};

/**
 * そのタイルの種族別重み。Lost Fleet では上書きがあればそちらを使う。
 * 参照はここを通すこと（`TILE_FACTION_WEIGHTS` を直接引くと上書きを取り逃す）。
 */
export function tileFactionWeights(
  tileId: string,
  lostFleet: boolean
): Partial<Record<FactionId, number>> | undefined {
  if (lostFleet) {
    const override = TILE_FACTION_WEIGHTS_LF[tileId];
    if (override) return override;
  }
  return TILE_FACTION_WEIGHTS[tileId];
}

/**
 * 標準技術の寄与スケール（＝評価指数 standardTech の既定値）。
 *
 * 2026-08-01: 他カテゴリの基準（SETUP_WEIGHT_BASE = 5）に対して **1.2倍の 6**。
 * 狙いの影響力の順（技術が最上位）に合わせるため。標準技術は9枚が毎ゲーム必ず出て
 * 最後まで場に残るので、実プレイでの影響力はどのカテゴリより大きい、という
 * ユーザーの評価に合わせた。
 * 実測（scripts/_probe_category_influence.ts、4人LF 300件の種族間SD）:
 *   基準と同じ係数だと8カテゴリ中3位 → 1.2倍で1位（LF船・上級を上回る）。
 * 整数のままなので評価値に小数は出ない。
 */
export const STD_TECH_SCALE = 6;

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
// --- 編集の目安: この表だけから見た種族の強さ（2026-08-01 時点）-------------
//
// **値をいじったら `npx tsx scripts/_probe_faction_totals.ts` を再実行すること。**
// 下の数字はすぐ古くなる。セットアップを引かずにこの表と TECH_POSITION_WEIGHTS を
// 素で数え、「1ゲームで実際に場に出る枚数」で割り引いた期待値（4人LF）。
//
//   ダルカニア人 104.5 / ネヴラ人 87.1 / スペースジャイアント 81.4
//   ティンカーロイド 78.7 / ジオデン人 77.1 / イタル人 75.8 / タクロン族 72.5
//   ゼノ族 71.0 / ランティダ人 65.0 / フィラク族 61.4 / マッドアンドロイド 60.7
//   モウェイド人 58.7 / グリーン人 47.8 / ダー・シュワーム人 45.5 / 地球人 43.4
//   ハッシュ・ホラ人 40.3 / アンバス人 33.9 / バル・タック人 19.7  （最大/最小 = 5.3倍）
//
// 正規化しない方針（案C＝「タイル関与の広さ＝強さ」）なので差が出ること自体は
// 設計どおり。ただし**上下の外れ値は「1つの能力を何枚ものタイルに書いた」結果**
// なので、幅が気になるならここを削るのがいちばん効く:
//
// - **ダルカニア人（最大）**: 「通常惑星が全色1段階改造」という1つの能力から
//   ①宙域・深宇宙 ②惑星の種類 ③鉱山数 の3つの系統に波及させている。
//   とくに①は AT06/AT10/AT17/AT21/FS05/FS09/RB13/RS10/ART06/TSL2/FEDG3 の
//   **11枚**にほぼ全部 +2 が入っていて、これが単独で最大の押し上げ要因。
//   下げるなら「系統の代表だけ2、残りは1」にするのが素直。
// - **バル・タック人（最小）**: 逆に「航法を進められない」を同じ①の系統へ
//   マイナスで波及させてある（負が17枚）。片方だけ直すと順位が入れ替わるので、
//   触るときは両方を見ること。
// - **グリーン人**: 正40枚・負23枚と振れが大きい（QICを得られない欠点を
//   QIC付きタイルすべてに書いているため）。合計は中位だが分散が大きい。
//
// 母星色ごと（その色でいちばん強い種族＝色優遇の掛け先と同じ見かた）:
//   小惑星104.5 / 白87.1 / 原始81.4 / 橙77.1 / 茶72.5 / 黄71.0 / 青65.0 /
//   黒61.4 / 赤45.5  —— 赤（ハッシュ・ホラ／ダー・シュワーム）が一段低い。
// ---------------------------------------------------------------------------
export const TILE_FACTION_WEIGHTS: Record<string, Partial<Record<FactionId, number>>> = {
  // ===== 上級技術（15＋LF6） =====
  // **★2026-08-03: この AT 行はもう評価に使われない。** 上級技術の正本は
  // ADVANCED_TECH_WEIGHTS_BASE / _LF（タイル×研究列×種族、VP 換算。
  // src/gaia/eval/advancedTechWeights.ts）へ移した。ここを直しても評価は変わらない。
  // 残してあるのは雛形生成（gen_advanced_tech_table.py --template）の入力と、
  // 「研究列ごとの差を付ける前はどの相性値だったか」の記録のため
  // （ラウンド得点の RS 行と同じ扱い）。
  AT01: { ivits: 2, xenos: 2, moweyds: 2, ambas: 1, gleens: 1 }, // パス時：同盟タイル×3VP
  // AT02/RS07: 技術タイルの獲得には研究1レベルが付くので、技術タイルを多く取る
  // 勢力（イタル人=PIで反復、フィラク族=研究所の建て直し、マッドアンドロイド=毎ラウンド無料の1レベル）が伸びる。
  AT02: { bescods: 2, firaks: 2, itars: 2, nevlas: 1, lantids: 1, gleens: -1 }, // 研究を進めるたび＋2VP
  AT03: { hadschHallas: 2, ivits: 1, balTaks: 1, taklons: 1, gleens: -1 }, // アクション：QIC1＋クレジット5
  AT04: { lantids: 2, xenos: 2, spaceGiants: 2, geodens: 1, darkanians: 1 }, // 取得時：鉱山×2VP
  AT05: { firaks: 2, bescods: 1, lantids: 1, gleens: -1 }, // パス時：研究所×3VP
  AT06: { darkanians: 2, lantids: 1, ambas: 1, taklons: 1, balTaks: -1 }, // 取得時：宙域×鉱石1
  AT07: { spaceGiants: 2, geodens: 1, gleens: 1, tinkerroids: 1 }, // アクション：鉱石3
  AT08: { terrans: 2, gleens: 2, itars: 2, balTaks: 1, spaceGiants: -1, tinkerroids: -1, darkanians: -1 }, // 取得時：ガイア惑星×2VP
  // AT09/AT11/RS02/RS03/RB08: フィラク族はPIで研究所→交易所の格下げが「交易所への改良」
  // と見なされるので、毎ラウンド交易所を建て直せる。
  AT09: { hadschHallas: 2, firaks: 1, taklons: 1, nevlas: 1 }, // 取得時：交易所×4VP
  AT10: { darkanians: 2, lantids: 1, ambas: 1, xenos: 1, taklons: 1, balTaks: -1 }, // 取得時：宙域×2VP
  AT11: { firaks: 2, hadschHallas: 1, nevlas: 1 }, // 交易所を建設するたび＋3VP
  AT12: { ivits: 2, xenos: 2, moweyds: 2, ambas: 1, gleens: 1 }, // 取得時：同盟タイル×5VP
  AT13: { firaks: 1, bescods: 1, nevlas: 1, lantids: 1, tinkerroids: 1 }, // アクション：知識3
  AT14: { lantids: 2, spaceGiants: 2, darkanians: 2, xenos: 1, geodens: 1 }, // 鉱山を建設するたび＋3VP
  // AT15/FS03/RB12/RS11/TS2/ART07: ランティダ人の「他プレイヤーの惑星に置く鉱山」は
  // 惑星の種類にもガイア惑星の数にも数えないので、種類系のタイルには乗らない（別表Ⅰ）。
  AT15: { geodens: 2, spaceGiants: 2, darkanians: 2, tinkerroids: 1, xenos: 1, gleens: 1 }, // パス時：惑星種類×1VP
  // AT16/RB09: 「建設済みの首府・学院1つごと」の数え上げなので、初期配置で首府を
  // 置いているティンカーロイドは最初から1つぶん確定している（RS04 の「建設したとき」とは別）。
  AT16: { tinkerroids: 2, nevlas: 1, ambas: 1, itars: 1, bescods: 1 }, // 取得時：首府・学院×6VP
  // AT17/AT21/FS09/RB13/RS10/ART06: バル・タック人は航法を進められないので
  // 到達距離が伸びず、深宇宙・宙域の広がりを要求するタイルは全部逆風（別表Ⅰ）。
  AT17: { darkanians: 2, lantids: 1, xenos: 1, taklons: 1, balTaks: -2 }, // 取得時：深宇宙宙域×4VP
  // AT18/FS07: 小惑星の入植はガイアフォーマー1個を使い捨てる（10ページ）。
  // バル・タック人はガイアフォーマーをQICに換えるので取り合いになる。
  AT18: { tinkerroids: 2, darkanians: 2, balTaks: -1 }, // パス時：小惑星×2VP
  // AT19/RS09: 改造の段階数は スペースジャイアント(常に2段階) が最大。
  // モウェイド人／ティンカーロイドは3種類だけ3段階（他は1段階）でムラがある。
  // ダルカニア人は通常惑星が全色1段階なので段階数が積み上がらない＝逆風。
  AT19: { spaceGiants: 2, geodens: 2, moweyds: 1, tinkerroids: 1, xenos: 1, darkanians: -1 }, // 惑星改造1段階ごと＋2VP
  // AT20: バル・タック人はガイアフォーマー→QIC のフリーアクションを持つ唯一のQIC源。
  // グリーン人はQICを得られない（代わりに鉱石）ので、QICアクションを実行できない。
  AT20: { balTaks: 2, hadschHallas: 1, ivits: 1, gleens: -2 }, // QICアクションのたび＋4VP
  AT21: { darkanians: 2, lantids: 1, xenos: 1, taklons: 1, balTaks: -2 }, // パス時：深宇宙宙域×2VP

  // ===== ラウンドブースター（10＋LF4） =====
  // 交換できるので1枚の拘束力は上級技術より弱いが、収入は毎ラウンド効く。
  RB01: { geodens: 1, gleens: 1, firaks: 1, bescods: 1, nevlas: 1, spaceGiants: 1, tinkerroids: 1 }, // 収入：鉱石1・知識1
  RB02: { ivits: 2, hadschHallas: 1, xenos: 1, spaceGiants: 1, tinkerroids: 1, darkanians: 1, gleens: -1 }, // 収入：クレジット2・QIC1
  RB03: { itars: 2, taklons: 2, nevlas: 1, moweyds: 1 }, // 収入：パワートークン2・鉱石1
  // RB04: 無料の1段階はダルカニア人の通常惑星のコストちょうど＝毎ラウンド無料で鉱山1つ。
  RB04: { darkanians: 2, geodens: 1, xenos: 1, spaceGiants: 1, lantids: 1 }, // 収入：クレジット2／特別：鉱山建設（改造1無料）
  RB05: { balTaks: 2, terrans: 1, itars: 1, gleens: 1, darkanians: 1 }, // 収入：パワー2／特別：鉱山建設orガイア計画（距離+3）
  RB06: { lantids: 2, xenos: 1, spaceGiants: 1, darkanians: 1 }, // 収入：鉱石1／パス：鉱山×1VP
  RB07: { firaks: 2, bescods: 1, lantids: 1, gleens: -1 }, // 収入：知識1／パス：研究所×3VP
  RB08: { hadschHallas: 2, firaks: 1, taklons: 1, nevlas: 1 }, // 収入：鉱石1／パス：交易所×2VP
  RB09: { tinkerroids: 2, nevlas: 2, ambas: 1, itars: 1, bescods: 1, moweyds: 1 }, // 収入：パワー4／パス：学院・首府×4VP
  RB10: { gleens: 2, terrans: 1, itars: 1, balTaks: 1, hadschHallas: 1 }, // 収入：クレジット4／パス：ガイア惑星×1VP
  RB11: { balTaks: 2, terrans: 2, itars: 1, gleens: 1 }, // 収入：鉱石1／パス：ガイアフォーマー×3VP
  RB12: { geodens: 2, spaceGiants: 2, darkanians: 2, tinkerroids: 1, gleens: 1 }, // 収入：鉱石1／パス：惑星種類×1VP
  RB13: { darkanians: 2, lantids: 1, xenos: 1, taklons: 1, balTaks: -2 }, // 収入：クレジット3／パス：深宇宙×2VP
  RB14: { terrans: 2, balTaks: 2, itars: 1, gleens: 1 }, // 収入：パワー2／特別：ガイア計画（即変換）

  // ===== ラウンド得点（9＋LF3、copies>1は枚数分加算） =====
  // **★2026-08-02: この RS 行はもう評価に使われない。** ラウンド得点の正本は
  // ROUND_SCORING_WEIGHTS_BASE / _LF（タイル×ラウンド×種族）へ移した。
  // ここを直しても評価は変わらないので、直すのは向こうの表のほう。
  // 残してあるのは雛形生成（gen_round_scoring_table.py --template）の入力と、
  // 「ラウンド差を付ける前はどの値だったか」の記録のため。
  RS01: { lantids: 2, spaceGiants: 2, darkanians: 2, xenos: 1, geodens: 1 }, // 鉱山建設 +2VP
  RS02: { firaks: 2, hadschHallas: 1, nevlas: 1, taklons: 1 }, // 交易所建設 +3VP
  RS03: { firaks: 2, hadschHallas: 1, nevlas: 1, taklons: 1 }, // 交易所建設 +4VP
  // RS04: 「建設したとき」の誘発なので、初期配置で首府を置いているティンカーロイドは
  // 首府ぶんを取り逃す（学院ぶんだけ）。×2タイルなので取り逃しも2枚ぶん。
  RS04: { ambas: 1, nevlas: 1, itars: 1, bescods: 1, tinkerroids: -1 }, // 学院・惑星首府建設 +5VP ×2
  RS05: { terrans: 2, gleens: 2, itars: 2, balTaks: 1, spaceGiants: -1, tinkerroids: -1, darkanians: -1 }, // ガイア惑星に鉱山建設 +3VP
  RS06: { terrans: 2, gleens: 2, itars: 2, balTaks: 1, spaceGiants: -1, tinkerroids: -1, darkanians: -1 }, // ガイア惑星に鉱山建設 +4VP
  RS07: { bescods: 2, firaks: 2, itars: 2, nevlas: 1, lantids: 1, gleens: -1 }, // 研究1レベル +2VP
  RS08: { ivits: 2, xenos: 2, moweyds: 1, ambas: 1, gleens: 1 }, // 同盟タイル獲得 +5VP
  RS09: { spaceGiants: 2, geodens: 2, moweyds: 1, tinkerroids: 1, xenos: 1, darkanians: -1 }, // 惑星改造1段階 +2VP
  // RS10: ダルカニア人のPIは「未入植の宙域で鉱山建設」で 2クレ+1知識。誘発条件が完全一致。
  RS10: { darkanians: 2, lantids: 1, ambas: 1, xenos: 1, taklons: 1, balTaks: -2 }, // 未入植の宙域で鉱山建設 +3VP
  // RS11: ジオデン人のPIは「新たな種類の惑星に初めて鉱山建設」で3知識。誘発条件が完全一致。
  RS11: { geodens: 2, spaceGiants: 2, darkanians: 2, tinkerroids: 1, gleens: 1 }, // 未入植の種類の惑星に鉱山建設 +3VP
  RS12: { firaks: 2, bescods: 1, lantids: 1, gleens: -1 }, // 研究所建設 +4VP

  // ===== 最終得点（6＋LF3） =====
  FS01: { ivits: 2, xenos: 2, ambas: 1, moweyds: 1 }, // 同盟内の建造物 最多
  FS02: { lantids: 2, xenos: 1, taklons: 1, spaceGiants: 1, darkanians: 1 }, // 建造物 最多
  FS03: { geodens: 2, spaceGiants: 2, darkanians: 2, tinkerroids: 1, xenos: 1, gleens: 1 }, // 惑星の種類 最多
  FS04: { terrans: 2, gleens: 2, itars: 2, balTaks: 1, spaceGiants: -1, tinkerroids: -1, darkanians: -1 }, // ガイア惑星 最多
  // FS05: ダー・シュワーム人の宇宙ステーションは外宇宙スペースなので宙域入植にならない。
  FS05: { darkanians: 2, lantids: 1, ambas: 1, taklons: 1, ivits: -1, balTaks: -2 }, // 入植宙域 最多
  FS06: { ivits: 2 }, // 衛星 最多（宇宙ステーションも衛星として数える）
  // FS07: ティンカーロイド／ダルカニア人は小惑星から開始するので1つ先行している。
  FS07: { tinkerroids: 1, darkanians: 1, balTaks: -1 }, // 小惑星 最多
  // FS08: アンバス人はPIと鉱山を入れ替えられるので、学院から最も遠い場所へPIを動かせる。
  FS08: { ambas: 2, darkanians: 1, tinkerroids: 1, balTaks: -1 }, // 首府⇔学院の距離 最長
  FS09: { darkanians: 2, lantids: 1, xenos: 1, taklons: 1, balTaks: -2 }, // 深宇宙宙域 最多

  // ===== 同盟タイル（惑星改造Lv5） =====
  // 改造Lv5に到達した1人だけが取る単発の賞。VP量は同じなので、
  // 付随資源の相性だけを弱め（1）に見る。12VP は純粋な点数＝相性なし。
  FED12: {}, // 同盟：12VP
  // FED8Q/RB02/FEDG5/ART09: グリーン人はQICを得られない（代わりに鉱石1）。
  // ダー・シュワーム人は衛星をパワートークンでなくQICで払うのでQICが直に効く。
  FED8Q: { ivits: 1, xenos: 1, spaceGiants: 1, tinkerroids: 1, darkanians: 1, gleens: -1 }, // 同盟：8VP＋QIC1
  FED8PT: { taklons: 1, nevlas: 1, itars: 1, moweyds: 1 }, // 同盟：8VP＋パワートークン2
  FED7O: { geodens: 1, gleens: 1, spaceGiants: 1, tinkerroids: 1 }, // 同盟：7VP＋鉱石2
  FED7C: { hadschHallas: 1, darkanians: 1 }, // 同盟：7VP＋クレジット6
  FED6K: { firaks: 1, bescods: 1, nevlas: 1, lantids: 1 }, // 同盟：6VP＋知識2

  // ===== LF 船の基本技術 =====
  // TSL1: 無料2段階はスペースジャイアントの通常惑星コストちょうど＝完全に無料の鉱山。
  // 鉱石を足せば3段階＝原始惑星（入植で6VP）にも届く。
  TSL1: { spaceGiants: 2, geodens: 1, moweyds: 1, tinkerroids: 1, darkanians: 1 }, // 即時：2段階無料改造＋鉱山建設
  TSL2: { balTaks: 2, darkanians: 2, gleens: 1, taklons: 1, xenos: 1, lantids: 1 }, // 基本到達距離＋1
  TSL3: { firaks: 1, bescods: 1, nevlas: 1, lantids: 1, tinkerroids: 1 }, // 即時：鉱石1＋知識3

  // ===== LF 金枠同盟 =====
  FEDG1: {}, // 金枠同盟：12VP（緑面あり）＝純粋な点数
  FEDG2: { firaks: 1, bescods: 1, itars: 1, spaceGiants: 1 }, // 金枠同盟：任意の技術タイル1枚
  FEDG3: { balTaks: 2, darkanians: 2, taklons: 1, lantids: 1 }, // 金枠同盟：距離無限の鉱山建設
  // FEDG4: 3段階無料はモウェイド人／ティンカーロイドの重い3種類ちょうど。
  // 誰にとっても原始惑星（3段階・入植で6VP）に無料で届く。
  FEDG4: { moweyds: 2, tinkerroids: 2, geodens: 2, spaceGiants: 1, gleens: 1, lantids: 1 }, // 金枠同盟：3段階無料改造＋鉱山建設
  FEDG5: { xenos: 1, geodens: 1, spaceGiants: 1, tinkerroids: 1, gleens: -1 }, // 金枠同盟：4VP＋鉱石2＋QIC1
  FEDG6: { firaks: 1, bescods: 1, nevlas: 1, lantids: 1, tinkerroids: 1 }, // 金枠同盟：4VP＋知識4
  // FEDG7/ART12: ネヴラ人のPIはエリアⅢのパワートークンを2パワーとして扱う。
  FEDG7: { nevlas: 2, taklons: 1, itars: 1, moweyds: 1 }, // 金枠同盟：7VP＋パワートークン2
  FEDG8: { hadschHallas: 2, darkanians: 1 }, // 金枠同盟：8VP＋クレジット8

  // ===== LF アーティファクト =====
  // 全員で取り合う共有物なので、明確なアーキタイプ相性のみ非ゼロ（原則1）。
  // ART01/ART02 は小惑星／原始惑星の鉱山として数えるが、原始惑星入植の6VPは対象外
  // （ルールブック15ページ）。小惑星最多への寄与は全勢力共通なので0のままにしてある。
  // ただし「入植している惑星の種類」は1つ増えるので、新たな種類で3知識のジオデン人だけ
  // 明確な追加利益がある（すでにその種類から始めている4勢力には増分がない）。
  ART01: { geodens: 1 }, // 7VP（小惑星鉱山扱い）
  ART02: { geodens: 1 }, // 7VP（原始惑星鉱山扱い）
  ART03: { bescods: 2, firaks: 1, nevlas: 1, tinkerroids: 1 }, // 科学レベル×3VP
  ART04: { terrans: 2, itars: 2, balTaks: 2, gleens: 1 }, // ガイア計画レベル×3VP
  // ART05: マッドアンドロイドは毎ラウンド「一番下のマーカー」を無料で進められるので、
  // 研究エリアが横に広がる＝レベル3以上の本数がいちばん増える。
  ART05: { bescods: 2, firaks: 1, nevlas: 1 }, // Lv3以上の研究×3VP
  ART06: { darkanians: 2, lantids: 1, xenos: 1, taklons: 1, balTaks: -2 }, // 深宇宙宙域×3VP
  ART07: { geodens: 2, spaceGiants: 1, darkanians: 1, tinkerroids: 1, gleens: 1 }, // 3VP＋惑星種類×1VP
  ART08: { ivits: 2, xenos: 1, ambas: 1, moweyds: 1 }, // 同盟タイル1枚の恩恵を再取得
  ART09: { firaks: 1, bescods: 1, nevlas: 1, ivits: 1, tinkerroids: 1, gleens: -1 }, // 即時：知識3＋QIC1
  ART10: { hadschHallas: 1, geodens: 1, spaceGiants: 1 }, // 即時：クレジット5＋鉱石2
  ART11: { geodens: 1, gleens: 1, spaceGiants: 1, tinkerroids: 1 }, // 即時：クレジット3＋鉱石3
  ART12: { nevlas: 2, taklons: 1, itars: 1, moweyds: 1 }, // 収入：パワー駒2個（エリアIII）
  ART13: { firaks: 1, bescods: 1, geodens: 1, spaceGiants: 1, tinkerroids: 1 }, // 収入：知識1＋鉱石1
};
