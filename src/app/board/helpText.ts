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
      title: "検索件数",
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
  capacity: {
    ja: {
      title: "保存数",
      what: "条件ごとの結果バケツに残す盤面の数（スコア上位から。ピン留めは整理の対象外）。検索のたびにマージして積み上がる。",
      why:
        "既定 1000（100〜5000）。v2.2.0 から保存するのは配置とスコアと小さな集計だけ（1 盤面 3KB 前後）で、内訳表・マーカー・Pair の種族ごとの値は" +
        "盤面から評価し直す（1 盤面 0.5ms）。以前の形（内訳込み 270KB）のままでは 1000 盤面で 270MB になるため。Pair の連続探索はこのバケツの上位 K 枚を使う。",
      ref: "1.8",
    },
    en: {
      title: "Stored",
      what: "How many boards the per-condition bucket keeps (best scores first; pinned boards are never trimmed). Each search merges into it.",
      why:
        "Default 1000 (100–5000). Since v2.2.0 only the placement, score and small totals are stored (about 3 KB per board); the breakdown table, markers and Pair's per-faction values are re-evaluated from the board (0.5 ms each). " +
        "The old form (270 KB with breakdown) would reach 270 MB at 1000 boards. Pair's continuous search takes the top K of this bucket.",
      ref: "1.8",
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
  factionPreference: {
    ja: {
      title: "種族優遇/冷遇",
      what:
        "種族ごとの ＋ で優遇、− で冷遇（値は上の「探索条件」の帯で編集。Map / Setup / List 共通）。" +
        "検索スコアに 強さ × Σ 優遇 × その種族の値（内訳表の行の合計）を足す。同じ色の 2 種族に別の値を付けられる。",
      why:
        "目盛りは盤面の実測（300 盤面・4人 LF、色ごとだった eval_v8 まで）で合わせてある: 0 効かない / 1 偏り項とほぼ互角 / 2 優遇が主導 / 3 さらに寄る / " +
        "5 実質その種族だけで決まる。マイナスは逆向きに同じだけ効く。種族ごとに掛けるので、同じ色の 2 種族に同じ値を入れると色 1 つに入れた旧来の約 2 倍。" +
        "種族優遇は検索キーに入るので、変えると結果は別のバケツに貯まる。",
      ref: "2.3 / 1.4",
    },
    en: {
      title: "Faction preference",
      what:
        "Per faction, + favours and − penalises (edited in the search-profile strip above; shared by Map / Setup / List). " +
        "Adds weight × Σ pref × that faction's value (the row total in the breakdown) to the search score. The two factions of a colour can differ.",
      why:
        "The scale was calibrated on 300 boards (4p LF, per colour up to eval_v8): 0 no effect / 1 about even with the imbalance term / 2 preference leads / 3 stronger / " +
        "5 effectively decides by that faction alone. Negative values work the same way in reverse. Setting both factions of a colour gives about twice the old per-colour effect. " +
        "The preference is part of the search key, so changing it starts a new result bucket.",
      ref: "2.3 / 1.4",
    },
  },
  wFactionPref: {
    ja: {
      title: "種族優遇/冷遇の強さ",
      what: "優遇／冷遇 1 あたりの強さ。検索スコアに足す項の係数。",
      why: "既定 25 は「優遇 1 ＝ 偏り項とほぼ互角」になるよう実測で合わせた（4人 LF 300 盤面: 偏り項の振れ幅 1747 に対し色の値の振れ幅 67。2026-07-31 に 3 → 25）。eval_v9 で掛け先が種族の値になったが係数は据え置き（再実測は評価値の調整後）。",
      ref: "2.3",
    },
    en: {
      title: "Preference weight",
      what: "Strength per unit of preference: the coefficient of the term added to the search score.",
      why: "Default 25 was calibrated so that pref 1 is about even with the imbalance term (300 boards, 4p LF: imbalance range 1747 vs colour value range 67; 3 → 25 on 2026-07-31). eval_v9 applies it per faction; the coefficient is kept until values are re-tuned.",
      ref: "2.3",
    },
  },

  // ---------- 内訳表（集計の仕組みと種別の列。eval_v7 / v8） ----------
  breakdown: {
    ja: {
      title: "種族別の内訳（集計の仕組み）",
      what:
        "種族の値 ＝ Σ 盤面の全惑星 係数（種別）× (固有値 10 ＋ 船接触 ＋ 船星系 ＋ 端の罰点) × 到達係数。" +
        "到達係数は 0.5 の（到達コスト −1）乗。到達コストは跳躍（距離 2=1 / 3=1.5 / 4=2 / 5=3。航行 Lv1 開始の種族は距離 2 が 0.5）＋" +
        "踏み台と到着した惑星の入植の歩数（改造の輪、ガイア 1、次元横断 2、原始 3、小惑星 2）。" +
        "開始地点は母星色から合計が最大になる組（到達係数 1）。列は種別ごとに丸め、評価はその合計。",
      why:
        "方針「最上位 2 個からどれだけ到達しやすく入植しやすいかが全て」（2026-10-07）。到達コストは種族ごとで、開始建物の数・航行・改造・ガイアの初期研究を反映する。" +
        "検索の偏り項で使う色の値は、その色の 2 種族のうち大きい方（種族優遇は種族ごとの値に掛ける）。行名のホバーに固有値・船接触・船星系・端の内訳。",
      ref: "2.10",
    },
    en: {
      title: "Breakdown by faction (how it adds up)",
      what:
        "Faction value = Σ over every planet of coefficient(kind) × (base 10 + scout + core + rim penalty) × reach factor. " +
        "Reach factor 0.5^(cost −1); cost = hop cost by distance (2=1 / 3=1.5 / 4=2 / 5=3; 0.5 at distance 2 for factions starting at navigation 1) + " +
        "settlement steps of stepping stones and of the destination (terraform wheel, gaia 1, transdim 2, proto 3, asteroid 2). " +
        "Starts are the home-colour planets with the largest total (factor 1). Columns are rounded per kind; the total is their sum.",
      why:
        "Policy (2026-10-07): what matters is how easily the best two starts reach and settle every planet. Reach cost is per faction: starting structures and navigation / terraforming / gaia research. " +
        "The colour value used by the balance term and colour preference is the larger of the colour's two factions. Hover a row name for the base / scout / core / rim parts.",
      ref: "2.10",
    },
  },
  colTotal: {
    ja: {
      title: "評価",
      what: "その種族の種別ごとの列の合計。全惑星を 係数（種別）× (固有値 10 ＋ 船接触 ＋ 船星系 ＋ 端の罰点) × 到達係数 で数える。",
      why:
        "固有値 10 は「惑星が 1 つあること自体の値」で、船接触 10 と同じ桁。固有値 0 だと基本版（船なし）の値が負になり評価が成立しない（2026-10-07 実測）。" +
        "ダー・シュワーム人は開始地点が惑星首府 1 つなので、その値を × 1.5（eval_v8）。",
      ref: "2.10",
    },
    en: {
      title: "Total",
      what: "Sum of the kind columns for that faction: every planet counted as coefficient(kind) × (base 10 + scout + core + rim penalty) × reach factor.",
      why:
        "Base 10 is the value of a planet simply existing, the same order as scout 10. With base 0 the base game (no ships) goes negative and the evaluation breaks (measured 2026-10-07). " +
        "Ivits start from a single planetary institute, so that start is × 1.5 (eval_v8).",
      ref: "2.10",
    },
  },
  colOwn: {
    ja: {
      title: "母星",
      what: "母星色の惑星（係数 1）。開始地点の値（到達係数 1）＋ 残りの同色惑星の値 × 到達係数。",
      why: "係数 1 が基準（削らない）。開始地点は母星色から合計が最大になる 2 ヶ所（ゼノ族 3、ダー・シュワーム人と LF の種族 1）を総当たりで選ぶ。",
      ref: "2.10",
    },
    en: {
      title: "Home",
      what: "Home-colour planets (coefficient 1): the starting planets (factor 1) plus the rest weighted by the reach factor.",
      why: "Coefficient 1 is the reference (no discount). Starts are the two home-colour planets with the largest total (Xenos 3, Ivits and Lost Fleet factions 1), chosen by brute force.",
      ref: "2.10",
    },
  },
  colOther: {
    ja: {
      title: "他色",
      what: "他の基本 6 色の惑星（係数 0.25。改造種族 ジオデン人・タクロン族・ネヴラ人は × 1.2）。改造の歩数は到達コストに入るので、1 歩の色は 3 歩の色よりずっと大きく数える。",
      why:
        "0.5 だと他色の寄与が 44% で母星色を超えた。0.25 で母星色 50% / 他色 28%（2026-10-07 実測）。改造種族の倍率 1.5 はジオデン人が +68 と突出、1.2 で +6。" +
        "改造種族の分類は暫定で、将来は種族ごとの倍率表にする。",
      ref: "2.10",
    },
    en: {
      title: "Other",
      what: "Planets of the other six basic colours (coefficient 0.25; terraforming factions Geodens / Taklons / Nevlas × 1.2). Terraform steps go into the reach cost, so one step away counts far more than three.",
      why:
        "At 0.5 the other colours contributed 44% and exceeded home; 0.25 gives home 50% / other 28% (measured 2026-10-07). Terraform boost 1.5 made Geodens stand out (+68); 1.2 gives +6. " +
        "The terraforming-faction list is provisional; a per-faction table is planned.",
      ref: "2.10",
    },
  },
  colGaia: {
    ja: {
      title: "緑（ガイア）",
      what: "ガイア惑星（係数 0.5）。入植コスト 1（グリーン人 0.5、LF の 3 種族 2）が到達コストに入る。",
      why: "どの種族にも届く惑星なので他色 0.25 より大きい。値は 2.7 の「入植先の係数」から引き継いだもので、見直し候補。",
      ref: "2.7 / 2.10",
    },
    en: {
      title: "Gaia",
      what: "Gaia planets (coefficient 0.5). Settlement cost 1 (Gleens 0.5, three Lost Fleet factions 2) goes into the reach cost.",
      why: "Reachable by every faction, hence above other 0.25. Carried over from the destination coefficients in 2.7; a candidate for review.",
      ref: "2.7 / 2.10",
    },
  },
  colTransdim: {
    ja: {
      title: "紫（次元横断）",
      what: "次元横断惑星（係数 0.25。ガイア種族 地球人・バルタック人・イタル人・モウェイド人は 0.5）。入植コスト 2（ガイア Lv1 開始 1、イタル人 1.5）が到達コストに入る。",
      why: "ガイア計画を経る手間のぶん他色と同じ 0.25。ガイア種族は初期研究で届きやすいので 0.5 に上げる。値は 2.7 から引き継ぎで、見直し候補。",
      ref: "2.7 / 2.10",
    },
    en: {
      title: "Transdim",
      what: "Transdimensional planets (coefficient 0.25; gaia factions Terrans / Baltaks / Itars / Moweids 0.5). Settlement cost 2 (gaia level 1 start 1, Itars 1.5) goes into the reach cost.",
      why: "Same 0.25 as other colours because of the gaia-project step; gaia factions reach them easily from their starting research, so 0.5. Carried over from 2.7; a candidate for review.",
      ref: "2.7 / 2.10",
    },
  },
  colExtra: {
    ja: {
      title: "拡張星（原始・小惑星）",
      what: "その種族から見た原始・小惑星（係数 0.1。入植コスト 原始 3 / 小惑星 2）。Lost Fleet の盤面だけ。",
      why: "評価に占める割合は 1.3〜2.2%（2026-10-10 実測）と小さいので、列は既定で出さない（評価からは外していない）。",
      ref: "2.5 / 2.10",
    },
    en: {
      title: "Ext. (proto / asteroid)",
      what: "Proto and asteroid planets as seen by that faction (coefficient 0.1; settlement cost proto 3 / asteroid 2). Lost Fleet boards only.",
      why: "Only 1.3–2.2% of the evaluation (measured 2026-10-10), so the column is off by default (it still counts in the total).",
      ref: "2.5 / 2.10",
    },
  },
} as const satisfies Record<string, Entry>;

export type HelpKey = keyof typeof ENTRIES;

export function helpContent(key: HelpKey, lang: Lang): HelpContent {
  return ENTRIES[key][lang];
}
