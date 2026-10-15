// src/app/board/helpText.ts
//
// /board（Map）の各項目のポップアップ文言（2026-10-15 ユーザー確定 2-(a)）。
// 「何を測るか」1 行＋「既定値の根拠」1〜2 行＋設計ノート（docs/design-notes.md）の節番号。
// 既定値や係数の数字はここに直書きしてある（定数から自動で埋めない。2-(b) は見送り）ので、
// 値を変えたら `docs/tuning-guide.md` と一緒にここも直す。
// 旧 title ツールチップ（uiText の tip*）はここへ移した。

import type { Lang } from "./uiText";
import type { HelpContent } from "@/components/ui/HelpPopover";

type Entry = { ja: HelpContent; en: HelpContent };

const ENTRIES = {
  // ---------- 検索の設定 ----------
  trials: {
    ja: {
      title: "試行回数",
      what: "1 回の検索で生成して評価する盤面の数。",
      why:
        "ハード制約を通る盤面は少ない（既定条件で LF 4人 0.2%、3人 0.7%。2026-09-29 実測）ので、上位を安定して得るには数万件が要る。" +
        "既定 30000。評価は通った盤面にしか走らないので、件数を増やしても評価の計算量はあまり増えない。",
      ref: "2.1",
    },
    en: {
      title: "Trials",
      what: "Boards generated and evaluated per search run.",
      why:
        "Few boards pass the hard constraints (LF 4p 0.2%, 3p 0.7% with the defaults), so tens of thousands are needed for a stable top list. " +
        "Default 30000. Soft evaluation only runs on boards that pass, so more trials cost little evaluation time.",
      ref: "2.1",
    },
  },
  topK: {
    ja: {
      title: "表示件数",
      what: "スコア上位から保持・表示する件数。",
      why: "既定 20。結果は条件ごとのバケツに貯まり、容量を超えた下位から整理される。ピン留めしたマップは整理の対象外。",
    },
    en: {
      title: "Top K",
      what: "How many top results are kept and shown.",
      why: "Default 20. Results accumulate per condition; the lowest are trimmed beyond capacity. Pinned maps are never trimmed.",
    },
  },
  keepAwake: {
    ja: {
      title: "検索中は画面を消さない",
      what: "検索中はブラウザに画面の自動消灯を抑止させる（Screen Wake Lock。このページが前面にある間だけ効く）。",
      why:
        "既定オン。他のアプリに切り替えると検索は止まるが、その瞬間に直前までの途中結果が保存される。" +
        "連続検索は検索件数を小さくして回すと失う分が減る。",
      ref: "2.5",
    },
    en: {
      title: "Keep screen on",
      what: "Asks the browser not to turn the screen off while a search runs (Screen Wake Lock; works while this page is in front).",
      why:
        "Default on. Switching to another app still pauses the search; the partial results so far are saved at that moment. " +
        "For continuous search, smaller trial counts lose less.",
      ref: "2.5",
    },
  },
  placementMethod: {
    ja: {
      title: "配置方法",
      what: "セクタータイルの並べ替え方。",
      why:
        "ルールブック p.19: 方法 1 は 01-04 を最初のゲームの位置に固定し 05-10 を入替。方法 2 は 01-04 も内側 4 スロット内で入替。" +
        "方法 3 は全 10 タイルを入替。回転はどの方法でも全タイル自由。",
    },
    en: {
      title: "Placement method",
      what: "How the sector tiles are shuffled.",
      why:
        "Rulebook p.19: Method 1 keeps sectors 01-04 in their first-game positions and shuffles 05-10; Method 2 also shuffles 01-04 within the inner slots; " +
        "Method 3 shuffles all 10 tiles. All tiles rotate freely in every method.",
    },
  },

  // ---------- 制約条件（ハード制約） ----------
  hard: {
    ja: {
      title: "制約条件",
      what: "満たさない盤面をその場で却下する条件。評価指数はこれを通った盤面にだけ掛かる。",
      why:
        "入力欄に無い常時の制約: 同種惑星の直接隣接禁止（基本版のルール。基本版で常時）、同色の通常惑星が距離 3 未満に近づかない（固定）。" +
        "既定条件での通過率は LF 4人 0.2% / 3人 0.7%。基本版は最外周の同色上限 1 だとほぼ通らず、上限 3 で 2%（2026-09-29 実測）。",
      ref: "2.1",
    },
    en: {
      title: "Hard constraints",
      what: "Conditions that reject a board immediately. The soft weights only apply to boards that pass.",
      why:
        "Always-on constraints without an input: no direct adjacency of same-type planets (base-game rule; always on for the base game), and same-colour planets never closer than distance 3 (fixed). " +
        "Pass rate with the defaults: LF 4p 0.2% / 3p 0.7%. The base game barely passes with outer same-colour max 1; 2% with max 3 (measured 2026-09-29).",
      ref: "2.1",
    },
  },
  outerSameColorMax: {
    ja: {
      title: "最外周の同色上限",
      what: "最外周（盤面の一番外の列）に置ける同色の通常惑星の上限。超える色が 1 つでもあれば却下。",
      why:
        "既定 1。端の惑星は広がり先が少なく、同じ色が端に固まると その色の価値が下がるため。" +
        "基本版では上限 1 だとほぼ通らないので 3 程度に緩める（上限 3 で通過率 2%）。",
      ref: "2.1",
    },
    en: {
      title: "Outer same-colour max",
      what: "Max planets of the same colour allowed on the outermost ring. Any colour above it rejects the board.",
      why:
        "Default 1. Edge planets have little room to expand, so a colour crowded on the edge loses value. " +
        "The base game barely passes with 1; relax to about 3 (2% pass rate).",
      ref: "2.1",
    },
  },
  maxConnectedPlanets: {
    ja: {
      title: "星系の最大サイズ",
      what: "隣接でつながった惑星のかたまりが N+1 個以上ある盤面を却下する（ガイア・次元横断も連結に含む）。0 で無効。",
      why: "既定 0（無効）。大きな星系を避けたいときだけ使う任意の制約で、既定の評価には入れていない。",
      ref: "2.1",
    },
    en: {
      title: "Max connected planets",
      what: "Rejects boards containing a connected planet cluster larger than N (gaia / transdim count as connected). 0 = off.",
      why: "Default 0 (off). An optional constraint for avoiding large clusters; not part of the default evaluation.",
      ref: "2.1",
    },
  },
  h5IncludeScouts: {
    ja: {
      title: "探査船セルも連結に含める",
      what: "上の星系の判定で、探査船（LF の船）のセルも惑星と同じように連結に数える。",
      why: "既定オフ。船のセルは惑星ではないが、同盟の経路としてはつながるので、必要なときだけ含められるようにしてある。",
      ref: "2.1",
    },
    en: {
      title: "Include scout cells",
      what: "Scout (Lost Fleet ship) cells also join clusters in the check above.",
      why: "Default off. Ship cells are not planets but do connect federations, so they can be included when needed.",
      ref: "2.1",
    },
  },
  centerMode: {
    ja: {
      title: "中央スロット",
      what: "中央スロットに入るタイルを制限する（LF のみ）。",
      why:
        "既定なし。基本版は配置方法 1 / 2 が内側の配置を保証し、方法 3 は自由が仕様なので欄を出さない。" +
        "LF は中央に大型セクターを置く組み方があるため、必要なときだけ制限できるようにしてある。",
      ref: "2.1",
    },
    en: {
      title: "Centre slot",
      what: "Restricts which tile may occupy the centre slot (Lost Fleet only).",
      why:
        "Default none. The base game needs no option: methods 1 / 2 fix the inner placement and method 3 is free by rule. " +
        "Lost Fleet layouts may put a large sector in the centre, so the restriction is available when wanted.",
      ref: "2.1",
    },
  },

  // ---------- 評価指数（ソフト評価） ----------
  soft: {
    ja: {
      title: "評価指数",
      what:
        "却下されなかった盤面を順位付けする重み。検索スコア ＝ −100 × 7 色の値のばらつき（偏り項）＋ 色優遇の強さ × Σ 優遇 × 色の値。",
      why:
        "「良い盤面 ＝ どの色にも同じくらいの価値がある盤面」という定義で、値の大きさそのものは順位に効かない。" +
        "色の値はその色の 2 種族のうち大きい方（代表値）。種族の値の式は内訳表の見出しの「?」。",
      ref: "2.3",
    },
    en: {
      title: "Soft weights",
      what:
        "Weights that rank the boards that passed. Search score = −100 × spread of the seven colour values (imbalance) + preference weight × Σ pref × colour value.",
      why:
        "A good board is one where every colour is worth about the same; the absolute size of the values does not affect the order. " +
        "A colour's value is the larger of its two factions. The faction formula is under the breakdown table's \"?\".",
      ref: "2.3",
    },
  },
  wRimGap: {
    ja: {
      title: "欠けマス罰点",
      what:
        "惑星から距離 2 以内の 18 マスのうち盤面に無いマス 1 つにつき、固有値から罰点を引く。入力は 10 倍の整数で、5 ＝ 最外周の角の惑星 1 つの罰点（欠け 10）。" +
        "辺 3.5、外周（1 つ内側）1.5 前後、内側 0。原始・小惑星にも掛かる。0 で無効。",
      why:
        "端の開始地点は、通常の到達範囲のうち盤面に無いマスのぶん将来の広がり先（鉱山を置く惑星・同盟の衛星・パワーの授受）を失う。" +
        "既定 0.5 は旧 −3 / −1 とほぼ同じ強さ（欠け 1 つ 0.4 相当）で、角を辺より重く数える。影響は基本版 9.9% ≫ LF 1% でプレイ感どおり。",
      ref: "2.8",
    },
    en: {
      title: "Rim gap penalty",
      what:
        "For each of the 18 cells within distance 2 that lies off the board, the planet loses this much from its base value. The input is ×10: 5 = the penalty of one corner planet (10 missing). " +
        "Edge 3.5, one ring inside about 1.5, inner 0. Applies to proto / asteroid planets too. 0 = off.",
      why:
        "An edge start loses future expansion (planets for mines, federation satellites, power trades) for every cell of its normal reach that is off the board. " +
        "Default 0.5 is about as strong as the old −3 / −1 (≈0.4 per missing cell) and weighs corners above sides. Effect: base game 9.9% ≫ Lost Fleet 1%, matching play experience.",
      ref: "2.8",
    },
  },
  scoutRadius: {
    ja: {
      title: "船接触半径",
      what: "船（探査船セル）から距離 R 以内の惑星を「船接触」とみなす。船接触の値は距離が 1 伸びるごとに 1 減る。",
      why: "既定 3。船接触 10 なら距離 1 / 2 / 3 で 10 / 9 / 8。半径を広げると船の価値が薄く広く配られる。",
      ref: "2.2",
    },
    en: {
      title: "Scout radius",
      what: "Planets within distance R of a ship (scout cell) count as touching it. The scout value drops by 1 per extra distance.",
      why: "Default 3. With scout 10 that is 10 / 9 / 8 at distance 1 / 2 / 3. A larger radius spreads the ship's value thinner and wider.",
      ref: "2.2",
    },
  },
  wScout: {
    ja: {
      title: "船接触",
      what: "この船の接触半径内にある惑星 1 つあたりの値。固有値 10 に足す「状況の値」で、到達係数を掛けて種族の値に入る。",
      why:
        "既定 10（船ごと）＝ 固有値と同じ桁。船のそばの惑星はそうでない惑星の約 2 倍の価値になる。" +
        "船の中身（タイル）の価値は Setup 側にあり、List / Total の船の相互作用で結びつける。",
      ref: "2.2 / 2.10",
    },
    en: {
      title: "Scout",
      what: "Value per planet within this ship's scout radius. A situational value added to the base 10, then multiplied by the reach factor.",
      why:
        "Default 10 per ship, the same order as the base value, so a planet next to a ship is worth about twice one that is not. " +
        "The value of the ship's tiles lives on the Setup side and is linked through the ship interaction in List / Total.",
      ref: "2.2 / 2.10",
    },
  },
  wScoutCore: {
    ja: {
      title: "船星系",
      what:
        "船接触惑星から距離 1〜2 にある惑星への値。距離 1〜2 に船接触惑星が 2 つ以上ある惑星だけが対象（距離 1 は値、距離 2 は値 −1、複数ぶんは合算）。" +
        "ガイア・次元横断は船接触惑星に数えない。",
      why: "既定 3（船ごと）。船接触より小さく、船の星系の「中」にある惑星だけを拾うよう 2026-07-30 に条件を 1 つ → 2 つにした。",
      ref: "2.2",
    },
    en: {
      title: "Scout core",
      what:
        "Value for planets within distance 1–2 of this ship's touched planets. Only planets with two or more touched planets in that range qualify (d=1: value, d=2: value −1; contributions add up). " +
        "Gaia and transdim planets never count as touched planets.",
      why: "Default 3 per ship, below scout. The condition went from one to two touched planets on 2026-07-30 so only planets inside the ship's cluster qualify.",
      ref: "2.2",
    },
  },
  scoutCoreAttribBest: {
    ja: {
      title: "船星系: 最大寄与に帰属",
      what: "複数の船の圏内にある惑星を、寄与が最大の船だけに数える。",
      why: "既定オフ（合算）。船どうしが近い盤面で船星系が二重に膨らむのを抑えたいときに使う。",
      ref: "2.2",
    },
    en: {
      title: "Scout core: best ship only",
      what: "A planet in several ships' range is credited only to the highest-contribution ship.",
      why: "Default off (contributions add up). Use it to stop scout core inflating on boards where ships sit close together.",
      ref: "2.2",
    },
  },
  colorPreference: {
    ja: {
      title: "色優遇/冷遇",
      what:
        "色ごとに ＋ で優遇、− で冷遇。検索スコアに 強さ × Σ 優遇 × 色の値 を足す。原始・小惑星は 7 色の軸に入らないので「最良の 1 惑星 × 補正値」に掛ける。",
      why:
        "目盛りは盤面の実測（300 盤面・4人 LF）で合わせてある: 0 効かない / 1 偏り項とほぼ互角（同程度ならこの色が強い方） / 2 優遇が主導 / 3 さらに寄る / " +
        "5 実質その色だけで決まる。マイナスは逆向きに同じだけ効く。",
      ref: "2.3",
    },
    en: {
      title: "Colour preference",
      what:
        "Per colour, + favours and − penalises. Adds weight × Σ pref × colour value to the search score. Proto / asteroid are outside the seven colours, so pref applies to the best single planet × its factor.",
      why:
        "The scale was calibrated on 300 boards (4p LF): 0 no effect / 1 about even with the imbalance term / 2 preference leads / 3 stronger / " +
        "5 effectively decides by that colour alone. Negative values work the same way in reverse.",
      ref: "2.3",
    },
  },
  wColorPref: {
    ja: {
      title: "色優遇/冷遇の強さ",
      what: "優遇／冷遇 1 あたりの強さ。検索スコアに足す項の係数。",
      why: "既定 25 は「優遇 1 ＝ 偏り項とほぼ互角」になるよう実測で合わせた（4人 LF 300 盤面: 偏り項の振れ幅 1747 に対し色の値の振れ幅 67）。2026-07-31 に 3 → 25。",
      ref: "2.3",
    },
    en: {
      title: "Preference weight",
      what: "Strength per unit of preference: the coefficient of the term added to the search score.",
      why: "Default 25 was calibrated so that pref 1 is about even with the imbalance term (300 boards, 4p LF: imbalance range 1747 vs colour value range 67). Changed 3 → 25 on 2026-07-31.",
      ref: "2.3",
    },
  },
} as const satisfies Record<string, Entry>;

export type HelpKey = keyof typeof ENTRIES;

export function helpContent(key: HelpKey, lang: Lang): HelpContent {
  return ENTRIES[key][lang];
}
