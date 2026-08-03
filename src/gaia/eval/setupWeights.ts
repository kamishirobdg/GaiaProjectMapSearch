// src/gaia/eval/setupWeights.ts
//
// セットアップ評価の「評価指数」（カテゴリ別係数）。2026-07-30。
// Map の評価指数（軸ごとの重み）に対応する Setup/List 側の入力で、
// 種族スコアをカテゴリ単位でスケールする純データ。
//
// 2026-07-31: 標準技術を「どこに配置されたか」で1つの表にまとめたので、
// stdTrack / stdFree の2カテゴリを standardTech 1つへ統合した。

import { STD_TECH_SCALE } from "./factionWeights";

/**
 * 係数のカテゴリ。タイルの出どころで分けてある:
 * - advanced      上級技術（研究トラック下の6枚）
 * - advExtension  得点ボード拡張部の追加上級技術（取得条件が通常の上級と違うため別枠。
 *                 2026-07-30 ユーザー要望）
 * - booster       ラウンドブースター（使用分のみ）
 * - roundScoring  ラウンド得点（×2タイルは枚数分入る。何ラウンド目に出たかで値が変わる
 *                 ―― 2026-08-02 に曲線を廃止し、表がラウンドごとの値を直に持つ）
 * - finalScoring  最終得点計算
 * - federation    同盟タイル（惑星改造 研究レベル5）
 * - standardTech  標準技術9枚（TECH_POSITION_WEIGHTS 経由。トラック下もフリー枠も
 *                 「配置」の違いとして同じ表で評価する。2026-07-31）
 * - lfShip        LFの船関連（船の基本技術・金枠同盟・アーティファクト）
 */
export const SETUP_WEIGHT_KEYS = [
  "advanced",
  "advExtension",
  "booster",
  "roundScoring",
  "finalScoring",
  "federation",
  "standardTech",
  "lfShip",
] as const;

export type SetupWeightKey = (typeof SETUP_WEIGHT_KEYS)[number];
export type SetupWeights = Record<SetupWeightKey, number>;

/**
 * 画面での並び順（評価表の列・評価指数の入力欄で共用）。
 *
 * **影響力の大きい順**に左から並べる。横スクロールで最初に隠れるのが影響の小さい列に
 * なるようにするため（2026-07-30 の意図は同じ。順番だけ 2026-07-31 に更新した）。
 * 順番はユーザーの実プレイ感による:
 *   技術 > LF船 > 上級 > ブースター > ラウンド > 最終 > 追加上級 > 同盟
 * 以前は「ブースターとラウンド得点は影響が小さい」という想定で右端に置いていたが、
 * 実際には効いているという評価に変わったので入れ替えた。
 */
export const SETUP_WEIGHT_DISPLAY_ORDER: readonly SetupWeightKey[] = [
  "standardTech",
  "lfShip",
  "advanced",
  "booster",
  "roundScoring",
  "finalScoring",
  "advExtension",
  "federation",
];

/**
 * 既定値。タイルの重みはすべて整数なので、係数を整数にすると評価値から小数が消える。
 * 桁はゲームの得点に揃える（種族ごとの評価値が100前後、Map の色ごとの評価値と
 * 足して200前後。2026-07-31 の設計）。
 *
 * 2026-08-01 に2つ変えた:
 * 1. **基準を 10 → 5**。全タイルの見直しで非ゼロのセルが増え、10 のままだと
 *    種族スコアが220前後まで膨らんで「ゲームの得点と同じ桁」から外れたため。
 * 2. **既定値が一律ではなくなった**。タイルの重み
 *    （TILE_FACTION_WEIGHTS / TECH_POSITION_WEIGHTS）は「そのタイルとその種族の
 *    噛み合い」だけを表し、**「そのカテゴリの1枚がゲーム全体にどれだけ効くか」は
 *    この係数で表す**、と役割を分けた。基準から外れるのは2つだけ:
 *      - standardTech = 6（STD_TECH_SCALE、基準の1.2倍）… 9枚が必ず出て最後まで残る
 *      - roundScoring = 4（ROUND_SCORING_SCALE、基準の0.8倍）… 効くのは1ラウンドだけ
 * これで実測の影響力が狙いの順（技術 > LF船 > 上級 > ブースター > ラウンド >
 * 最終 > 追加上級 > 同盟）になる。検算は scripts/_probe_category_influence.ts。
 *
 * 2026-08-03: **全カテゴリを VP 換算へ移した**。値そのものが「そのタイル1枚が
 * 何点分か」を表すようになったので、**係数の役割は桁合わせだけ**になり、基準を
 * 5 → 3 に下げた（VP 化で各カテゴリの値の幅がおよそ倍になったため）。この 3 で
 * 影響力が狙いの順にぴったり一致する。
 * **いずれ係数は原則1にしたい**（影響力は VP の幅だけで決めるのが本来の姿）が、
 * そうすると評価値がさらに膨らむので、桁の設計とセットで決める —— いまでも
 * 種族あたり1288〜1544（`_probe_score_range.ts`）で、従来の狙い「100前後」から
 * 大きく外れている。場に出ている全タイルを取れる前提で足しているため。
 */
export const SETUP_WEIGHT_BASE = 9;
/**
 * ラウンド得点の既定係数。そのタイルが効くのは6ラウンドのうち1ラウンドだけなので、
 * 1枚あたりの影響力は基準より軽い。何ラウンド目に出たかの差は
 * ROUND_SCORING_WEIGHTS_BASE / _LF がラウンドごとの値として直に持つ
 * （2026-08-02 に曲線を廃止した）。
 *
 * 2026-08-03: 値を **VP 換算**（中央値10・幅6〜14）へ移したので、幅が倍になった。
 * 4 のままだと種族間SD 13.2 で技術に次ぐ2位になるため 2 へ下げ、移行前と同じ
 * 6.6 に戻してある。**桁合わせのための暫定値**（全カテゴリの VP 化が終わったら
 * 係数は原則1にし、影響力は VP の幅そのもので決める）。
 */
export const ROUND_SCORING_SCALE = 6;
/**
 * 上級技術（と得点ボード拡張部の追加上級）の既定係数（2026-08-03）。
 *
 * このカテゴリだけ値が **VP 換算**（1枚あたり20〜30点）になったので、他カテゴリの
 * 「噛み合い ±2」と同じ係数では桁が合わない。雛形の状態で実測すると、係数5では
 * 種族間SD 26.7（占有率32%）で単独1位になり、狙いの順（技術 > LF船 > 上級）から
 * 大きく外れる。2 に下げると 10.7 で技術15.6 に次ぐ位置に収まる。
 *
 * **暫定値**。VP 換算の値はこれからユーザーが入れ直すので、値が固まったら
 * `scripts/_probe_category_influence.ts` で測り直して決める。全カテゴリを VP 換算へ
 * 移し終えたら、係数は原則1（値そのものが点数を表す）になる。
 */
export const ADVANCED_TECH_SCALE = 6;
/**
 * 得点ボード拡張部の追加上級（Lost Fleet）の既定係数（2026-08-04 ユーザー確定）。
 *
 * **通常の上級技術の 1/3**。拡張部に置かれるのは1枚だけで、それを3〜4人で
 * 奪い合うため、1人あたりの期待値は 1/3〜1/4 になる（3人戦基準で 1/3）。
 * 表の値は通常の上級と同じ（advancedTechWeights.ts の6列の最大値）なので、
 * 「取れる見込みの低さ」はこの係数で表す。
 */
export const ADV_EXTENSION_SCALE = 2;
export const DEFAULT_SETUP_WEIGHTS: SetupWeights = {
  advanced: ADVANCED_TECH_SCALE,
  advExtension: ADV_EXTENSION_SCALE,
  booster: SETUP_WEIGHT_BASE,
  roundScoring: ROUND_SCORING_SCALE,
  finalScoring: SETUP_WEIGHT_BASE,
  federation: SETUP_WEIGHT_BASE,
  standardTech: STD_TECH_SCALE,
  lfShip: SETUP_WEIGHT_BASE,
};

/**
 * 種族スコアの最終スケール（2026-08-04 ユーザー確定）。
 *
 * 表の値は VP 換算なので、場に出ている全タイルを足すと種族あたり2400〜3100になる。
 * これを **100前後へ落として Map 側の評価値（100前後）と同じ土俵に乗せる**ための除数。
 * 実測（`_probe_score_range.ts`、4人LF 300件）の中央値に合わせてある。
 * 2026-08-04 に 40 → 28（素点をタイルごとの実感ベースへ直して全体が下がったため）。
 *
 * 桁を揃えるためだけのもので、**Map と Setup のどちらを重く見るかとは役割が別**
 * （そちらは List の評価指数にある倍率で振る）。カテゴリ係数を全部いじるより、
 * ここ1つで桁を動かせるほうが後から追いやすい。
 *
 * 割り算なので**評価値に小数が出る**（追加上級のように1枚しか出ないカテゴリは
 * 0.6〜1.2 の範囲になる）。整数へ丸めると種族差が消えてしまうので、
 * 表示側で小数第1位まで出す（FactionEvalPanel の fmt1）。
 */
export const SETUP_SCORE_DIVISOR = 28;

/** 評価指数の入力範囲（基準10に合わせて -90..90）。 */
export const SETUP_WEIGHT_MIN = -90;
export const SETUP_WEIGHT_MAX = 90;
/** 入力欄の刻み。整数のまま動かせるように1。 */
export const SETUP_WEIGHT_STEP = 1;

/** LF でしか効かないカテゴリ（基本版では列も入力欄も出さない）。 */
export const LF_ONLY_WEIGHT_KEYS: ReadonlySet<SetupWeightKey> = new Set<SetupWeightKey>([
  "advExtension",
  "lfShip",
]);

export function isDefaultWeights(w: SetupWeights): boolean {
  return SETUP_WEIGHT_KEYS.every((k) => w[k] === DEFAULT_SETUP_WEIGHTS[k]);
}

/**
 * 任意の入力（localStorage の JSON など）を係数へ正規化する。
 * 数値でないキー・非有限値は既定値へフォールバックし、範囲へクランプする。
 */
export function sanitizeSetupWeights(raw: unknown): SetupWeights {
  const src = (raw ?? {}) as Record<string, unknown>;
  const out = {} as SetupWeights;
  for (const k of SETUP_WEIGHT_KEYS) {
    const n = Number(src[k]);
    out[k] = Number.isFinite(n)
      ? Math.max(SETUP_WEIGHT_MIN, Math.min(SETUP_WEIGHT_MAX, n))
      : DEFAULT_SETUP_WEIGHTS[k];
  }
  return out;
}

// --- localStorage（Setup タブと List タブで共有）-----------------------------
//
// 保存は「既定と異なるキーだけ」を書く（互換の鉄則と同じスプレッド構築）。
// 全部既定ならキー自体を消し、未設定の状態へ戻す。

export const LS_SETUP_EVAL_WEIGHTS = "gaia_setup_eval_weights";

export function readSetupWeights(): SetupWeights {
  try {
    const raw = localStorage.getItem(LS_SETUP_EVAL_WEIGHTS);
    if (!raw) return { ...DEFAULT_SETUP_WEIGHTS };
    return sanitizeSetupWeights(JSON.parse(raw));
  } catch {
    return { ...DEFAULT_SETUP_WEIGHTS };
  }
}

/** 既定と異なる値だけを JSON にする（全部既定なら null＝キー削除）。 */
export function serializeSetupWeights(w: SetupWeights): string | null {
  const diff: Partial<SetupWeights> = {};
  for (const k of SETUP_WEIGHT_KEYS) {
    if (w[k] !== DEFAULT_SETUP_WEIGHTS[k]) diff[k] = w[k];
  }
  return Object.keys(diff).length === 0 ? null : JSON.stringify(diff);
}

export function writeSetupWeights(w: SetupWeights): void {
  try {
    const s = serializeSetupWeights(w);
    if (s === null) localStorage.removeItem(LS_SETUP_EVAL_WEIGHTS);
    else localStorage.setItem(LS_SETUP_EVAL_WEIGHTS, s);
  } catch {
    // ignore
  }
}

// --- 色優遇/冷遇（母星色ごと。2026-07-31）------------------------------------
//
// Map の colorPrefByType と同じ形。0 のキーは持たない（＝未指定と同じ）ので、
// 使っていない条件のキーは従来とバイト不変。

/** 優遇/冷遇を付けられる母星色。基本7色＋LFの原始・小惑星。 */
export const COLOR_PREF_KEYS = [
  "BLACK",
  "BLUE",
  "BROWN",
  "ORANGE",
  "RED",
  "WHITE",
  "YELLOW",
  "PROTO",
  "ASTEROID",
] as const;
export type ColorPrefKey = (typeof COLOR_PREF_KEYS)[number];
export type ColorPrefByColor = Partial<Record<ColorPrefKey, number>>;

/** 入力範囲。Map の色優遇と同じ目盛り（1=互角 / 2=主導 / 5=ほぼ全て）。 */
export const COLOR_PREF_MIN = -20;
export const COLOR_PREF_MAX = 20;

export const LS_SETUP_COLOR_PREF = "gaia_setup_color_pref";

/** 0・非数値・範囲外を落として正規化する（0 はキーごと落とす）。 */
export function sanitizeColorPref(raw: unknown): ColorPrefByColor {
  const src = (raw ?? {}) as Record<string, unknown>;
  const out: ColorPrefByColor = {};
  for (const k of COLOR_PREF_KEYS) {
    const n = Number(src[k]);
    if (!Number.isFinite(n) || n === 0) continue;
    out[k] = Math.max(COLOR_PREF_MIN, Math.min(COLOR_PREF_MAX, n));
  }
  return out;
}

export function readColorPref(): ColorPrefByColor {
  try {
    const raw = localStorage.getItem(LS_SETUP_COLOR_PREF);
    if (!raw) return {};
    return sanitizeColorPref(JSON.parse(raw));
  } catch {
    return {};
  }
}

export function writeColorPref(p: ColorPrefByColor): void {
  try {
    const clean = sanitizeColorPref(p);
    if (Object.keys(clean).length === 0) localStorage.removeItem(LS_SETUP_COLOR_PREF);
    else localStorage.setItem(LS_SETUP_COLOR_PREF, JSON.stringify(clean));
  } catch {
    // ignore
  }
}

// --- 種族優遇/冷遇（List 専用。2026-07-31）------------------------------------
//
// List は色ではなく種族ごとに ± を付ける（ユーザー確定）。掛け先は
// 「Map の評価値（母星色ぶん）＋ Setup の評価値」。色優遇と同じく 0 は持たない。

export type FactionPrefByFaction = Record<string, number>;
export const LS_LIST_FACTION_PREF = "gaia_list_faction_pref";

export function sanitizeFactionPref(raw: unknown): FactionPrefByFaction {
  const src = (raw ?? {}) as Record<string, unknown>;
  const out: FactionPrefByFaction = {};
  for (const [k, v] of Object.entries(src)) {
    const n = Number(v);
    if (!Number.isFinite(n) || n === 0) continue;
    out[k] = Math.max(COLOR_PREF_MIN, Math.min(COLOR_PREF_MAX, n));
  }
  return out;
}

export function readFactionPref(): FactionPrefByFaction {
  try {
    const raw = localStorage.getItem(LS_LIST_FACTION_PREF);
    if (!raw) return {};
    return sanitizeFactionPref(JSON.parse(raw));
  } catch {
    return {};
  }
}

export function writeFactionPref(p: FactionPrefByFaction): void {
  try {
    const clean = sanitizeFactionPref(p);
    if (Object.keys(clean).length === 0) localStorage.removeItem(LS_LIST_FACTION_PREF);
    else localStorage.setItem(LS_LIST_FACTION_PREF, JSON.stringify(clean));
  } catch {
    // ignore
  }
}
