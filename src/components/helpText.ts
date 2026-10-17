// src/components/helpText.ts
//
// Setup / Pair（旧 List ＋ Total）の各項目のポップアップ文言（第 2 弾。2026-10-15 ユーザー「進めてよい」）。
// 形は Map の `src/app/board/helpText.ts` と同じ: 「何を測るか」＋「既定値の根拠」＋設計ノート（docs/design-notes.md）の節。
// 既定値や係数の数字は直書き（定数から自動で埋めない）。値を変えたらここも直す。

import type { HelpContent } from "@/components/ui/HelpPopover";
import type { SetupWeightKey } from "@/gaia/eval/setupWeights";

type Lang = "ja" | "en";
type Entry = { ja: HelpContent; en: HelpContent };

const ENTRIES = {
  // ---------- Setup / Pair 共通（FactionEvalPanel） ----------
  setupEval: {
    ja: {
      title: "評価（種族別）",
      what:
        "表示中のセットアップを種族ごとに採点する。8 カテゴリ（標準技術・上級技術・追加上級・ブースター・ラウンド得点・最終得点・同盟・LF 船）の" +
        "タイルごとの値に評価指数（係数）を掛けて合計し、最後に 28 で割る（種族あたり 100 前後）。",
      why:
        "値はすべて VP 換算（「そのタイルを適切なタイミングで取れたら何点分か」）で、正本は data/weights の CSV（2026-09-19 に全表の入力が一巡）。" +
        "行の背景は母星色。列は係数を掛けた後の値で、列の合計が総合。",
      ref: "3.1",
    },
    en: {
      title: "Evaluation (by faction)",
      what:
        "Scores the displayed setup per faction. Tile values in 8 categories (standard tech, advanced tech, extra advanced, boosters, round scoring, final scoring, federation, LF ships) " +
        "are multiplied by the category weights, summed, and divided by 28 (about 100 per faction).",
      why:
        "Every value is in VP (what the tile is worth if taken at the right time); the source of truth is the CSV under data/weights (all tables filled by 2026-09-19). " +
        "Row background = home colour. Columns are post-weight values; their sum is the total.",
      ref: "3.1",
    },
  },
  setupSummary: {
    ja: {
      title: "総合スコア",
      what: "表の総合列のまとめ。平均 ＝ 全種族の平均、上位 K ＝ 上位 K（人数＋2）種族の平均、散らばり ＝ 全種族の標準偏差、最強 ＝ 最大の種族。",
      why: "Pair の基準 2〜4 が見ているのと同じ量（上位 K の拮抗、全体の散らばり、上位の強さ）を 1 行で読めるようにしたもの。",
      ref: "4",
    },
    en: {
      title: "Overall",
      what: "Summary of the total column. mean = all factions; top K = mean of the top K (players + 2); spread = standard deviation; best = the strongest faction.",
      why: "The same quantities the Pair criteria 2–4 look at (top-K balance, overall spread, strength of the top), readable in one line.",
      ref: "4",
    },
  },
  setupWeights: {
    ja: {
      title: "評価指数",
      what: "カテゴリ別の係数。タイルごとの値（CSV）に掛けてから合計する。Pair の「組の提案」の選定にも同じ係数が効く。",
      why:
        "役割分担: タイルの値 ＝ そのタイルと種族の噛み合い、係数 ＝ カテゴリ全体をどれだけ効かせるか（桁合わせ）。既定 基準 9 / 標準技術 9 / 上級 6 / ラウンド 6 / 追加上級 2。" +
        "影響力の目安は 技術 > LF船 > 上級 > ブースター > ラウンド > 最終 > 追加上級 > 同盟（2026-09-27 実測: 26.8 / 17.5 / 16.7 / 14.5 / 8.9（最終）/ 7.0（同盟）/ 6.2（ラウンド）/ 2.4%）。" +
        "この順を守るための微調整はしない（2026-08-04）。",
      ref: "3.1 / 3.3",
    },
    en: {
      title: "Eval weights",
      what: "Per-category coefficients applied to the tile values (CSV) before summing. The Pair tab's suggestions use the same weights.",
      why:
        "Division of labour: tile value = fit between tile and faction; weight = how much the whole category counts (scale only). Defaults: base 9 / standard tech 9 / advanced 6 / round 6 / extra advanced 2. " +
        "Intended influence order: tech > LF ships > advanced > boosters > round > final > extra advanced > federation (measured 2026-09-27: 26.8 / 17.5 / 16.7 / 14.5 / 8.9 (final) / 7.0 (fed) / 6.2 (round) / 2.4%). " +
        "The weights are not fine-tuned to enforce that order (2026-08-04).",
      ref: "3.1 / 3.3",
    },
  },
  cat_standardTech: {
    ja: {
      title: "技術（標準技術）",
      what: "標準技術タイル 9 枚。どこに置かれたか（研究列 6 つ／フリー枠 3 つ）で種族ごとの価値が変わる。フリー枠はどの列も登らずに取れるので、タイル自体の有用度だけで見る。",
      why: "既定 9（基準と同じ）。影響力の 1 位（26.8%）。表は通常版と拡張版で分ける（場に出るタイルの母集団が違う）。値の見直し例: TS1 3 → 11、TS3 4 → 12 / 14、TS9 7 → 12（2026-08-06）。",
      ref: "3.1 / 3.2",
    },
    en: {
      title: "Tech (standard tech)",
      what: "The 9 standard tech tiles. Value per faction depends on where each sits (6 research tracks / 3 free slots). Free slots need no track, so only the tile's own usefulness counts.",
      why: "Default 9 (same as base). Largest influence (26.8%). Separate tables for base and Lost Fleet (different tile pools). Revisions e.g. TS1 3 → 11, TS3 4 → 12 / 14, TS9 7 → 12 (2026-08-06).",
      ref: "3.1 / 3.2",
    },
  },
  cat_advanced: {
    ja: {
      title: "上級（上級技術）",
      what: "研究トラックの下に付く上級技術タイル 6 枚。タイル × 研究列 × 種族の表（その列を登らない種族は取れない）。",
      why: "既定 6。素点の中央値は 24 → 18（取得に同盟タイル 1 枚を払う対価を引く）→ 全タイル +4 で 22（どの列でも進められるぶん）。アクション 3 枚（AT03 / 07 / 13）は 4 回起動・資源レート倍で再計算。",
      ref: "3.2",
    },
    en: {
      title: "Advanced tech",
      what: "The 6 advanced tech tiles under the research tracks. Table of tile × track × faction (a faction that does not climb the track cannot take it).",
      why: "Default 6. Median raw value 24 → 18 (minus the federation tile paid to take it) → +4 for every tile = 22 (any track works). The 3 action tiles (AT03 / 07 / 13) were recomputed at 4 activations and doubled resource rates.",
      ref: "3.2",
    },
  },
  cat_advExtension: {
    ja: {
      title: "拡張（追加上級技術）",
      what: "得点ボード拡張部の 7 枚目の上級技術。取得条件が通常の上級と異なるため別枠。面（2 人 ＝ 25VP 面固定／3・4 人 ＝ 探査シャトル面）ごとに値を持つ。",
      why: "既定 2 ＝ 通常の上級の 1/3。拡張部の 1 枚を 3〜4 人で奪い合うため。影響力はいちばん小さい（2.4%）。",
      ref: "3.1",
    },
    en: {
      title: "Ext. (extra advanced tech)",
      what: "The 7th advanced tech on the scoring-board extension; a separate category because its acquisition rule differs. Valued per face (2p = fixed 25 VP face / 3–4p = shuttle face).",
      why: "Default 2 = one third of regular advanced tech, since 3–4 players compete for the single tile. Smallest influence (2.4%).",
      ref: "3.1",
    },
  },
  cat_booster: {
    ja: {
      title: "RB（ラウンドブースター）",
      what: "場に出るラウンドブースター（人数 ＋ 3 枚）。種族ごとの噛み合いの値。",
      why: "既定 9（基準）。影響力 14.5%（4 位）。",
      ref: "3.1 / 3.3",
    },
    en: {
      title: "RB (round boosters)",
      what: "The round boosters in play (players + 3). Per-faction fit.",
      why: "Default 9 (base). Influence 14.5% (4th).",
      ref: "3.1 / 3.3",
    },
  },
  cat_roundScoring: {
    ja: {
      title: "R点（ラウンド得点）",
      what: "ラウンド得点タイル 6 枚。タイル × ラウンド × 種族の表（何ラウンド目に出るかで価値が変わる。同じタイルが 2 枚出れば枚数分）。",
      why: "既定 6。曲線ではなく表にしたのは「同盟の R1 はダー・シュワーム人だけ取れる」のような種族差を表すため（2026-08-02）。+4VP 版は +3VP 版の 4/3 で導出。",
      ref: "3.2",
    },
    en: {
      title: "Round scoring",
      what: "The 6 round scoring tiles. Table of tile × round × faction (value depends on the round; duplicates count twice).",
      why: "Default 6. A table rather than a curve so faction differences like \"only Ivits can score the federation tile in round 1\" can be expressed (2026-08-02). The +4 VP versions are 4/3 of the +3 VP ones.",
      ref: "3.2",
    },
  },
  cat_finalScoring: {
    ja: {
      title: "最終（最終得点）",
      what: "最終得点計算タイル 2 枚。種族ごとの噛み合いの値。",
      why: "既定 9（基準）。全員の順位で大きく差が付くので、影響力が 4〜6 位（実測 8.9%）のどこに来ても違和感はない（2026-08-04）。",
      ref: "3.3",
    },
    en: {
      title: "Final scoring",
      what: "The two final scoring tiles. Per-faction fit.",
      why: "Default 9 (base). Final scoring is decided by everyone's ranking, so an influence anywhere from 4th to 6th (measured 8.9%) is fine (2026-08-04).",
      ref: "3.3",
    },
  },
  cat_federation: {
    ja: {
      title: "同盟（同盟タイル）",
      what: "惑星改造 研究レベル 5 の同盟タイル。種族ごとの噛み合いの値。",
      why: "既定 9（基準）。影響力 7.0%。",
      ref: "3.3",
    },
    en: {
      title: "Federation tile",
      what: "The federation tile at Terraforming level 5. Per-faction fit.",
      why: "Default 9 (base). Influence 7.0%.",
      ref: "3.3",
    },
  },
  cat_lfShip: {
    ja: {
      title: "LF船（失われた艦隊の船）",
      what: "船に乗る基本技術・金枠同盟・アーティファクトの値。どの船に乗ったかで値を上書きできる（船に到達しないと取れない。0 は基準値へフォールバック）。",
      why:
        "既定 9（基準）。影響力 17.5%（2 位）。Pair の組の提案と合計表の Setup 列では、船 s に乗るタイルの値をその種族の船接触（Map 側）の相対値で増減する" +
        "船の相互作用（α 1。加点は Setup の値の 2.5%、合計の上位の顔ぶれが変わる組 23%）。",
      ref: "3.1 / 2.10",
    },
    en: {
      title: "LF ships",
      what: "Values of the ship tech, gold federations and artifacts carried by the ships; can be overridden per ship (you must reach the ship; 0 falls back to the base value).",
      why:
        "Default 9 (base). Influence 17.5% (2nd). In the Pair suggestions and the totals table's Setup column, tiles on ship s are scaled by the faction's relative scout contact on the map " +
        "(ship interaction, α 1; adds 2.5% of the setup value and changes the top-by-total line in 23% of pairs).",
      ref: "3.1 / 2.10",
    },
  },

  // ---------- 探索条件の帯（ConditionBar。段階 1「条件の統一」2026-10-16） ----------
  searchProfile: {
    ja: {
      title: "探索プロファイル",
      what:
        "種族優遇と、Map の検索条件（テンプレート・制約・評価指数）・Setup の検索条件（タイル指定・面・評価指数）を 1 つの名前で束ねる。" +
        "Map / Setup の「一致・差分あり・未登録」は、この画面の条件がプロファイルに登録した条件と同じかどうか。",
      why:
        "検索を実行するとその側の条件が自動で登録される。Map で検索 → Setup へ移動して「一致」を確かめて検索、が基本の流れ。" +
        "貯めた結果は条件ごとのバケツのままで、プロファイルはそれを束ねる索引（結果は消えない）。",
      ref: "1.4",
    },
    en: {
      title: "Search profile",
      what:
        "Bundles the faction preference with the Map conditions (template, constraints, weights) and the Setup conditions (tile rules, faces, weights) under one name. " +
        "The Map / Setup badges say whether this page's conditions equal the ones registered in the profile.",
      why:
        "Running a search registers that side's conditions. Typical flow: search on Map, move to Setup, confirm 'match', search. " +
        "Results stay in their per-condition buckets; the profile is just an index over them.",
      ref: "1.4",
    },
  },
  factionPref: {
    ja: {
      title: "種族優遇/冷遇",
      what:
        "種族ごとの ±（1 つの表を Map / Setup / Pair が共有）。Map の検索ではその種族の盤面の値に（eval_v9）、Setup の検索ではその種族の配置の値に、" +
        "Pair の組の提案では両方の合計に、それぞれ種族ごとにそのまま掛ける。「色でまとめて」は同じ色の 2 種族に同じ値を入れる近道。",
      why:
        "目盛りは従来の色優遇と同じ: 0 効かない / 1 基準とほぼ互角 / 2 優遇が主導 / 5 実質その種族だけで決まる。マイナスは逆向きに同じだけ。" +
        "Setup 側の係数は色優遇の半分（0.15。同じ色の 2 種族に入れると従来の色優遇とほぼ同じ大きさ）。",
      ref: "1.4 / 4",
    },
    en: {
      title: "Faction preference",
      what:
        "Per faction, ± (one table shared by Map / Setup / Pair). Map search applies it to the faction's board value (eval_v9), Setup search to its layout value, " +
        "Pair suggestions to the sum, each per faction. 'By colour' sets both factions of a colour at once.",
      why:
        "Same scale as the old colour preference: 0 off / 1 about even / 2 preference leads / 5 decided by this faction alone. " +
        "On the Setup side the coefficient is half the colour one (0.15; setting both factions of a colour gives about the old colour bonus).",
      ref: "1.4 / 4",
    },
  },

  // ---------- Pair（旧 List ＋ Total。段階 2、2026-10-17） ----------
  pairSuggest: {
    ja: {
      title: "組の提案（マップ＋セットアップ）",
      what: "探索の向き（マップ → セットアップ／セットアップ → マップ）と基準を選ぶと、候補を基準の良い順に上位 5 件まで提示する。セットアップはランダム生成か保存済みから。候補一覧は提案・連続で探索の順位表・保存した組・共有された組を、いまの基準・評価指数・合算比で採点し直して基準値の降順に並べる（# ＝ 順位）。行を選ぶと「詳細」に盤面・配置・種族別の合計が出る。",
      why: "Setup の値には船の相互作用（船に乗るタイルの値 × その種族の船接触の相対値、α 1）を掛けてから採点する。評価指数・種族優遇（帯）は Map / Setup と共通。保存した組は条件ごとに貯まる。",
      ref: "4 / 1.5",
    },
    en: {
      title: "Pair suggestion (map + setup)",
      what: "Pick a direction (map → setup / setup → map) and a criterion to get up to 5 candidates ranked by the criterion. Setups come from random generation or the saved list. Selecting a candidate row shows the board, the layout and the faction totals in Detail.",
      why: "Setup values include the ship interaction (tiles on a ship × the faction's relative scout contact, α 1) before scoring. Weights and the faction preference (strip) are shared with Map / Setup. Saved pairs are kept per condition.",
      ref: "4 / 1.5",
    },
  },
  pairSearchBoth: {
    ja: {
      title: "両方を探索",
      what:
        "探索プロファイルに登録した Map の条件と Setup の条件で、Map の検索（件数は Map タブの設定）と Setup の検索（件数は Setup タブの設定）を順に実行し、" +
        "結果はそれぞれの候補に貯める。そのあと Map 上位 K × Setup 上位 L の総当たりを基準で採点し、上位 10 組を候補に並べる（K・L は「条件」で変更、既定 20、上限 50）。",
      why:
        "Map の検索は制約を満たす盤面が 0.1〜0.2%（4人 LF、既定の制約）しか無いので、件数を減らすと組の材料が足りなくなる（5000 件で 4 盤面ほど）。" +
        "Setup は 0.25ms/件 なので 5000 件でも 1 秒かからない。条件が未登録の側があるときは、そのタブで検索を 1 回実行すると登録される。",
      ref: "1.6",
    },
    en: {
      title: "Search both",
      what:
        "Runs the Map search (trial count from the Map tab) and the Setup search (trial count from the Setup tab) with the conditions registered in the search profile, storing results in their candidate buckets; " +
        "then scores top K maps × top L setups by the criterion and lists the best 10 pairs (K / L in Conditions, default 20, max 50).",
      why:
        "Only 0.1–0.2% of boards pass the default constraints (4p LF), so fewer Map trials leave too few boards to pair (about 4 at 5000). " +
        "Setup costs 0.25 ms per trial, so 5000 take under a second. If one side is not registered yet, run one search on that tab.",
      ref: "1.6",
    },
  },
  pairSearchContinuous: {
    ja: {
      title: "連続で探索",
      what:
        "停止するまで繰り返す。探索の向きが マップ → セットアップ: Map の候補（探索プロファイルの Map の条件の結果バケツ）の上位 K 枚のうち未探索のマップごとに、Setup を「1 マップあたりの件数」（条件、既定 100000）ぶん " +
        "**そのマップとの組として** 採点（船の相互作用、基準 2・3 は合計 T_f、1・4 はマップの上位種族、種族優遇）→ 上位 L 件を順位表へ → Map の検索（件数は Map タブの設定）→ 上位の更新 → 新たに上位 K に入った未探索のマップだけ探索。" +
        "セットアップ → マップ: 起点のセットアップを固定して Map の検索を繰り返し、制約を通った盤面ごとに組の基準値を計算して順位表へ。順位表は条件（人数・拡張・基準・評価指数）ごとに上位 50 組を端末に残す。",
      why:
        "Map は制約を通る盤面が 0.1〜0.2% なので周ごとに 30000 件、Setup は 0.5ms/件（マップに合わせた採点はマップ無しの 2 倍）なので 1 マップ 10 万件で 50 秒ほど。探索済みの件数はマップごとに記録し、同じマップを二度探索しない（件数を増やせば差分だけ）。" +
        "セットアップ → マップは制約を通る盤面だけ採点するので Map の検索とほぼ同じ時間。Setup の候補（マップに依らない順位）には入れない（組の基準値はマップごとに違う）。",
      ref: "1.7 / 1.8",
    },
    en: {
      title: "Search continuously",
      what:
        "Repeats until stopped. Direction Map → Setup: for each unexplored map among the top K Map candidates (the search profile's Map bucket), score setups (“setups per map” in Conditions, default 100000) " +
        "**as a pair with that map** (ship interaction, criteria 2 / 3 on the total T_f, 1 / 4 on the map's top factions, faction preference) → the top L into the ranking → Map search (trial count from the Map tab) → explore only maps newly entering the top K. " +
        "Setup → Map: keeps the chosen setup fixed, repeats the Map search and scores every board that passes the constraints as a pair. The ranking keeps the best 50 pairs per condition (players, expansion, criterion, weights) on this device.",
      why:
        "Only 0.1–0.2% of boards pass the constraints, so each round runs 30000 Map trials; map-aware Setup scoring costs 0.5 ms per trial (twice the plain search), so 100k per map takes about 50 s. Explored counts are kept per map so no map is searched twice (raise the count and only the shortfall runs). " +
        "Setup → Map scores only the boards that pass, so it costs about as much as the Map search alone. Nothing goes into the Setup candidates (pair scores depend on the map).",
      ref: "1.7 / 1.8",
    },
  },
  pairCriterion: {
    ja: {
      title: "基準",
      what:
        "2 上位バランス ＝ −(合計 T_f の上位 K ＝ 人数＋2 の散らばり) ＋ 0.3 × (上位の平均 − 残りの平均)。3 全体バランス ＝ −(合計 T_f の全種族の散らばり)。" +
        "1 逆優位 ＝ −(Map 上位 3 種族の Setup 値の和) − 0.2 × 全種族の散らばり。4 優位 ＝ Map 上位 K 種族の Setup 値の平均 − 0.2 × その散らばり。",
      why:
        "合計 T_f ＝ Map × 倍率 ＋ Setup × 倍率（合算比）。基準 2・3 は段階 2（2026-10-17）からマップの内訳があれば合計で測る（それまでは Setup の値だけ）。" +
        "添え物の係数 0.2 / 0.3 は「主項が同じ候補の順番を決める」程度の目分量（据え置き）。内訳を持たない古いマップでは従来どおり Setup の値だけで測る。",
      ref: "4 / 1.5",
    },
    en: {
      title: "Criterion",
      what:
        "2 top balance = −(spread of the top K = players + 2 by total T_f) + 0.3 × (mean of top − mean of rest). 3 overall balance = −(spread of all factions by total T_f). " +
        "1 oppose map = −(sum of setup values of the map's top 3) − 0.2 × spread of all. 4 align map = mean setup value of the map's top K − 0.2 × their spread.",
      why:
        "Total T_f = map × weight + setup × weight (blend). Since stage 2 (2026-10-17) criteria 2 / 3 use the total whenever the map has a breakdown (before: setup values only). " +
        "The 0.2 / 0.3 side terms only order candidates whose main term ties (kept as is). Old maps without a breakdown fall back to setup values.",
      ref: "4 / 1.5",
    },
  },
  pairTopColors: {
    ja: {
      title: "合計の上位",
      what: "Map ＋ Setup の合計（合算比を掛けたもの）が高い順に、人数＋2 色。同じ色は強い方の種族だけ。",
      why: "同色の 2 種族は卓で 1 人しか選べないため（2026-09-20）。Setup ぶんには船の相互作用が入る。",
      ref: "4",
    },
    en: {
      title: "Top by total",
      what: "Players + 2 colours ranked by map + setup (after the blend ratio); for each colour only the stronger faction.",
      why: "Two factions of one colour cannot both sit at the table (2026-09-20). The setup part includes the ship interaction.",
      ref: "4",
    },
  },
  pairTotal: {
    ja: {
      title: "種族別の合計",
      what:
        "選んだ組で、種族ごとに Map の評価値（Map タブの内訳表のその種族の行）と Setup の評価値（Setup タブと同じ種族スコア。船の相互作用込み）を合算比で足す。",
      why: "Map と Setup はどちらも種族あたり 100 前後の桁の約束（足して 200 前後）。Map の値は候補の条件でいまの評価に評価し直した値（Map タブで開いた値と同じ基準）。Setup ぶんは LF では船に乗るタイルの値をその種族の船接触の比で再配分するので Setup タブの総合と数点ずれる。",
      ref: "1.2 / 4",
    },
    en: {
      title: "Totals by faction",
      what:
        "For the selected pair, adds per faction the map value (that faction's row in the Map tab's breakdown) and the setup value (the same faction score as Setup, ship interaction included) using the blend ratio.",
      why: "Map and setup are both meant to be about 100 per faction (about 200 together). Map values are re-evaluated with the current evaluation under the candidate's conditions (same basis as the Map tab). In LF the setup part redistributes ship-tile values by the faction's ship-contact ratio, so it differs from the Setup tab total by a few points.",
      ref: "1.2 / 4",
    },
  },
  pairBlend: {
    ja: {
      title: "合算比",
      what: "合計 ＝ Map × 倍率 ＋ Setup × 倍率。基準 2・3 の採点、種族優遇の掛け先、「合計の上位」にも同じ比が効く。",
      why:
        "既定 1:1 は未決。Map の最上位は LF 4人 205 / 3人 186 / 基本版 73（eval_v7 の実測）と版で桁が違い、一律の倍率では LF で Map が支配する。評価値の調整が終わってから決め直す（tuning-guide 1-8）。",
      ref: "4",
    },
    en: {
      title: "Blend",
      what: "Total = map × weight + setup × weight. Criteria 2 / 3, the faction preference and the top-by-total line use the same ratio.",
      why:
        "The default 1:1 is still open. Top map values differ by mode (LF 4p 205 / 3p 186 / base 73 under eval_v7), so a single multiplier lets the map dominate in Lost Fleet. To be settled once the evaluation constants are tuned (tuning-guide 1-8).",
      ref: "4",
    },
  },
} as const satisfies Record<string, Entry>;

export type SharedHelpKey = keyof typeof ENTRIES;

export function sharedHelp(key: SharedHelpKey, lang: Lang): HelpContent {
  return ENTRIES[key][lang];
}

/** 評価指数のカテゴリ → 文言のキー */
export function categoryHelpKey(k: SetupWeightKey): SharedHelpKey {
  return `cat_${k}` as SharedHelpKey;
}
