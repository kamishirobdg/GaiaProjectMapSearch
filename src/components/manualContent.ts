// src/components/manualContent.ts
//
// アプリ内マニュアル（/manual）の本文（2026-10-16。章立てはユーザー確定、置き場所はアプリ内、日英）。
// 材料は docs/design-notes.md（節番号を各章末に示す）と docs/tuning-guide.md。
// 数字（既定値・係数・実測）は直書きなので、定数を変えたらここと helpText も直す。
//
// 構造: 章（id / title / blocks）。ブロックは 小見出し h3 / 段落 p / 箇条書き ul / 表 table / 参照 ref。

export type ManualBlock =
  | { h3: string }
  | { p: string }
  | { ul: string[] }
  | { table: { head: string[]; rows: string[][] } }
  | { ref: string };

export type ManualChapter = { id: string; title: string; blocks: ManualBlock[] };

export type ManualText = { title: string; intro: string; toc: string; refLabel: string; chapters: ManualChapter[] };

const ja: ManualText = {
  title: "マニュアル",
  intro:
    "評価の設計意図・方針・考慮点を章立てでまとめたものです。各画面の項目の横の「?」には同じ内容の要約があります。" +
    "章末の「設計ノート」は docs/design-notes.md の節番号です（経緯と実測の詳細）。",
  toc: "目次",
  refLabel: "設計ノート",
  chapters: [
    {
      id: "overview",
      title: "1. 目的と 4 つのタブ",
      blocks: [
        {
          p:
            "このツールは、ガイアプロジェクト（Lost Fleet 拡張対応）の盤面（Map）とタイル配置（Setup）をシードから大量に生成し、" +
            "評価して並べるためのものです。「どの色・どの種族にも同じくらいの価値がある盤面」と「種族ごとのタイルの噛み合い」を数で見ます。",
        },
        {
          table: {
            head: ["タブ", "何をするか", "評価の単位"],
            rows: [
              ["Map（/board）", "シードから盤面を大量に作り、制約条件で絞り、評価指数で並べて上位 K 件を保存する", "種族ごと（色の値はその色の 2 種族の大きい方）"],
              ["Setup（/setup）", "タイル配置をシードから作り、18 種族それぞれにとっての価値を出す", "種族ごと"],
              ["List（/list）", "ピン留めした Map と Setup の組み合わせを 4 つの基準で提案する", "種族ごとの Map ＋ Setup"],
              ["Total（/total）", "Map 1 枚と Setup 1 つを選び、種族ごとに Map ＋ Setup を合算して並べる", "種族ごと"],
            ],
          },
        },
        {
          p:
            "Map は全プレイヤーが同じ盤面を共有し、Setup のタイルは早い者勝ちで奪い合う、という性質の違いがあります。" +
            "同じ母星色の 2 種族は盤面上は似た立場で、差が付くのは主に Setup 側です（Map も eval_v5 から種族ごとに計算しています）。",
        },
        { h3: "評価の桁の約束" },
        {
          ul: [
            "Map の種族ごとの値も Setup の種族ごとの値も「100 前後」に揃え、足して 200 前後にする。ゲームの得点に近い桁にして Total で素直に足せるようにするため。",
            "Setup は VP 換算の合計を最後に 28 で割る。割り算は最後の 1 回だけなので、内訳の和と合計は一致する。",
            "Map の桁は評価値の調整が終わってから決め直す（Map : Setup の合算比は 1:1 のまま未決。7 章）。",
          ],
        },
        { h3: "結果バケツと版" },
        {
          ul: [
            "検索結果は「条件」ごとのバケツに貯まる。条件プロファイルのキーには評価指数まで含むが、Setup の結果バケツのキーは設定だけ（指数を変えても貯めた結果は消えない）。",
            "評価の意味が変わる変更では Map の評価バージョン（eval_vN）を上げ、検索結果は別バケツに貯まる。旧バージョンの候補は「コピー」で再評価して引き継げる。",
            "共通バー右端の「vX.Y.Z · eval_vN」がアプリの版と評価バージョン。本番のビルド完了はこの表示で判定できる。",
          ],
        },
        { ref: "1.1 / 1.2 / 1.3" },
      ],
    },
    {
      id: "map-search",
      title: "2. Map の検索",
      blocks: [
        { h3: "流れ" },
        {
          p:
            "シード → 盤面の生成 → 制約条件（満たさない盤面は却下） → 評価指数で採点 → 上位 K 件を条件ごとのバケツに保存。" +
            "評価は制約を通った盤面にしか走らないので、検索件数を増やしても評価の計算量はあまり増えません。",
        },
        { h3: "制約条件" },
        {
          table: {
            head: ["ID", "内容", "既定"],
            rows: [
              ["H0", "同種惑星（基本 7 色）の直接隣接禁止。基本版ルールの合法性", "基本版で常時"],
              ["H1", "同色の通常惑星どうしが距離 3 未満に近づかない", "3（固定）"],
              ["H2", "最外周にある同色の通常惑星が上限以下", "1"],
              ["H4", "中央スロットには大型セクターのみ（LF のみ）", "無効"],
              ["H5", "連結した惑星のかたまりの最大サイズ（探査船セルを含めるかは任意）", "無効"],
            ],
          },
        },
        {
          p:
            "既定条件での通過率は LF 4 人 0.2%、3 人 0.7%（2026-09-29 実測）。基本版は H2 上限 1 だとほぼ通らず、上限 3 で 2%。" +
            "端の惑星は広がり先が少ないので、同じ色が端に固まる盤面を H2 で落としています。",
        },
        { h3: "検索スコア（何を「良い盤面」とみなすか）" },
        {
          p: "検索スコア ＝ −100 × 7 色の値のばらつき（偏り項） ＋ 色優遇の強さ × Σ 優遇 × 色の値。",
        },
        {
          ul: [
            "スコアの本体は 7 色の値の「ばらつき」だけ。値の大きさそのものは順位に効かない。「良い盤面 ＝ どの色にも同じくらいの価値がある盤面」という定義。",
            "色の値はその色の 2 種族のうち大きい方（代表値）。原始・小惑星（LF の 4 種族の母星）は 7 色の軸に入らず、色優遇では最良の 1 惑星の値に掛ける。",
            "色優遇／冷遇の目盛りは実測で合わせてある（4 人 LF 300 盤面）: 0 効かない / 1 偏り項とほぼ互角 / 2 優遇が主導 / 3 さらに寄る / 5 実質その色だけで決まる。強さの既定 25 は「優遇 1 ＝ 互角」になる値。",
          ],
        },
        { h3: "検索の実行" },
        {
          ul: [
            "検索はワーカー（別スレッド）で走り、停止ボタンで即時に中断して途中結果を保存する。進捗の行の末尾に経路（[worker] が正常、[worker-nosab] は共有メモリ無しでワーカー、[main] は本体スレッドへ退避）。",
            "「検索中は画面を消さない」（Screen Wake Lock、既定オン）。他のアプリに切り替えると検索は止まるが、その瞬間に途中結果が保存される。",
            "検索中の定期保存はしない（入れると遅くなった）。連続検索は検索件数を小さくして回すと失う分が減る。",
            "候補の行の「ピン留め」で List に集まり、容量の整理からも守られる。「使用済み」は上位一覧から外す。",
          ],
        },
        { ref: "2.1 / 2.3 / 2.5" },
      ],
    },
    {
      id: "map-value",
      title: "3. Map の種族の値",
      blocks: [
        {
          p:
            "方針（2026-10-07）: 「惑星評価においては、最上位 2 個（種族により 1・3）の開始地点から、どれだけ到達しやすく入植しやすいかが全て」。" +
            "自分の色の惑星だけでなく、盤面の全惑星を同じ式で点数化して合計します（eval_v7）。",
        },
        { h3: "式" },
        {
          p: "種族の値 ＝ Σ 盤面の全惑星 係数（種別） × （固有値 10 ＋ 船接触 ＋ 船星系 ＋ 端の罰点） × 到達係数",
        },
        {
          ul: [
            "固有値 10: 惑星が 1 つあること自体の値。船接触 10 と同じ桁。固有値 0 だと基本版（船なし）の値が負になり評価が成立しない。",
            "船接触（LF のみ、既定 10、半径 3）: 船から距離 R 以内の惑星に足す。距離が 1 伸びるごとに 1 減る。船のそばの惑星はそうでない惑星の約 2 倍の価値。",
            "船星系（LF のみ、既定 3）: 船接触惑星から距離 1〜2 にあり、かつ距離 1〜2 に船接触惑星が 2 つ以上ある惑星に足す（距離 2 は値 −1）。船の星系の「中」にある惑星だけを拾う。",
            "端の罰点（既定 0.5、入力欄は 10 倍の 5）: 惑星から距離 2 以内の 18 マスのうち盤面に無いマス 1 つにつき引く。角 −5、辺 −3.5、外周（1 つ内側）−1.5 前後、内側 0。端の開始地点は将来の広がり先（鉱山・同盟の衛星・パワーの授受）を失う、という意図。影響は基本版 9.9% ≫ LF 1% でプレイ感どおり。",
          ],
        },
        { h3: "到達コストと到達係数" },
        {
          p: "到達係数 ＝ 0.5 の（到達コスト − 1）乗。コスト 1 ＝ 通常の到達範囲 ＝ 割引なし、以降 1 段ごとに半減。到達コスト ＝ 跳躍 ＋ 踏み台と到着した惑星の入植の歩数。",
        },
        {
          table: {
            head: ["跳躍の距離", "1", "2", "3", "4", "5", "6 以上"],
            rows: [["コスト", "0", "1（航行 Lv1 開始の種族は 0.5、バルタック人は 1.5）", "1.5", "2", "3", "不可"]],
          },
        },
        {
          table: {
            head: ["入植先", "歩数"],
            rows: [
              ["同色", "0"],
              ["他色", "改造の輪（テラ→酸化→火山→砂漠→沼沢→チタン→氷）で 隣 1 / 2 つ先 2 / 反対 3。ジオデン人は × 2/3"],
              ["ガイア", "1（グリーン人 0.5、LF の 3 種族 2）"],
              ["次元横断", "2（ガイア Lv1 開始の種族 1、イタル人 1.5）"],
              ["原始 / 小惑星", "3 / 2（LF の 4 種族は母星種別が無く、同じ種別にも払う）"],
            ],
          },
        },
        {
          p:
            "種族ごとのプロファイル（開始建物の数、航行・改造・ガイアの初期研究の差）はユーザーが決めた定数で、テストで固定しています。" +
            "LF の 4 種族は開始地点が 1 ヶ所なので値が基本種族より低く出ます（実態どおり）。",
        },
        { h3: "種別の係数（削る量。1 ＝ 削らない）" },
        {
          table: {
            head: ["種別", "係数", "根拠"],
            rows: [
              ["母星色", "1", "基準"],
              ["他色", "0.25（改造種族 ジオデン人・タクロン族・ネヴラ人は × 1.2）", "0.5 だと他色の寄与 44% で母星色を超えた。0.25 で母星色 50% / 他色 28%。倍率 1.5 はジオデン人が +68 と突出、1.2 で +6。分類は暫定で将来は種族ごとの倍率表"],
              ["ガイア", "0.5", "どの種族にも届く惑星。見直し候補"],
              ["次元横断", "0.25（ガイア種族 地球人・バルタック人・イタル人・モウェイド人は 0.5）", "ガイア計画を経る手間のぶん他色並み。ガイア種族は初期研究で届きやすい"],
              ["原始・小惑星", "0.1", "評価に占める割合 2% 前後。内訳表の列は既定オフ"],
            ],
          },
        },
        { h3: "開始地点" },
        {
          p:
            "母星色の惑星から、合計が最大になる組を総当たりで選びます（2 ヶ所。ゼノ族 3、ダー・シュワーム人と LF の種族 1）。" +
            "開始地点の到達係数は 1。ダー・シュワーム人は惑星首府 1 つから始めるので、その開始地点の値を × 1.5（eval_v8）。",
        },
        { h3: "内訳表とマーカーの読み方" },
        {
          ul: [
            "列は種別ごと（母星 / 他色 / 緑（ガイア）/ 紫（次元横断）/ 拡張星（原始・小惑星、既定オフ）/ 評価）。列は種別ごとに丸め、評価はその合計。",
            "種別のセルをタップすると、その種族が到達コスト 3 以内で届く惑星を種別の色で地図にマークする（Ctrl で複数）。評価のセルは開始地点。",
            "行名のホバーに固有値・船接触・船星系・端の内訳。評価指数の「欠けマス罰点」の入力欄をクリックすると最外周・外周の惑星がマークされる。",
            "列セレクタ（「列を選ぶ」）と内訳表の列見出しの「?」に各列の意味と係数の根拠。",
          ],
        },
        { ref: "2.6 / 2.7 / 2.8 / 2.10" },
      ],
    },
    {
      id: "setup",
      title: "4. Setup の評価",
      blocks: [
        { h3: "8 カテゴリと VP 換算" },
        {
          p:
            "標準技術（置かれた研究列／フリー枠）、上級技術（研究列）、追加上級（得点ボード拡張部の 7 枚目。面 vp25 / shuttle）、ブースター、" +
            "ラウンド得点（何ラウンド目か）、最終得点、同盟、LF 船（船の基本技術・金枠同盟・遺物。どの船に乗ったか）。",
        },
        {
          ul: [
            "値はすべて VP 換算（「そのタイルを適切なタイミングで取れたら何点分か」）を種族ごとに入れる。正本は data/weights の CSV で、2026-09-19 に全表の入力が一巡した。以後は /weights ページで差分を直す。",
            "ラウンド得点は曲線ではなく「タイル × ラウンド × 種族」の表（「同盟の R1 はダー・シュワーム人だけ取れる」のような差を表すため）。+4VP 版は +3VP 版の 4/3。",
            "上級技術は「タイル × 研究列 × 種族」の表（その列を登らない種族は取れない）。素点の中央値は 24 → 18（同盟タイル 1 枚の対価）→ 全タイル +4。",
            "LF 船のタイルは「乗せた船」ごとに値を上書きできる（船に到達しないと取れない。0 は基準値へフォールバック）。",
          ],
        },
        { h3: "評価指数（係数）の役割" },
        {
          p:
            "タイルの値 ＝ そのタイルと種族の噛み合い、係数 ＝ カテゴリ全体をどれだけ効かせるか（桁合わせ）。既定は 基準 9 / 標準技術 9 / 上級 6 / ラウンド 6 / 追加上級 2" +
            "（追加上級だけ通常の上級の 1/3。拡張部の 1 枚を 3〜4 人で奪い合うため）。合計は最後に 28 で割る。",
        },
        {
          p:
            "影響力の目安は 技術 > LF 船 > 上級 > ブースター > ラウンド > 最終 > 追加上級 > 同盟。実測（2026-09-27、4 人 LF 200 件の占有率）は " +
            "技術 26.8% > LF 船 17.5% > 上級 16.7% > ブースター 14.5% > 最終 8.9% > 同盟 7.0% > ラウンド 6.2% > 追加上級 2.4%。" +
            "この順を守るための微調整はしません（素点が実態に寄っているぶん前後するのは正常。最終得点は全員の順位で大きく差が付くので 4〜6 位のどこに来ても違和感はない）。",
        },
        { h3: "条件の指定と一括探索" },
        {
          ul: [
            "条件の指定はタイルや面のクリックに一本化（固定／除外／候補／既定）。満たし方は「シャッフル済み配列の入れ替え」で構成的。",
            "一括探索は、いまの条件で大量に生成して基準の良い順に並べる。結果は条件 × 基準ごとに保存され、次の探索は前回の上位とマージされる。",
            "色優遇／冷遇（母星色ごとの ±、係数 0.3）は一括探索と提案の並びに効き、評価表の値は変えない。目盛りは Map と同じ（1 ＝ 基準とほぼ互角）。",
          ],
        },
        { ref: "3.1 / 3.2 / 3.3 / 3.5" },
      ],
    },
    {
      id: "list-total",
      title: "5. List と Total",
      blocks: [
        { h3: "List（ピン留め一覧とセット提案）" },
        {
          ul: [
            "Map と Setup でピン留めしたものが集まる。セット提案は探索の向き（マップ → セットアップ／セットアップ → マップ）と基準を選ぶと、候補を基準の良い順に上位 5 件まで提示する。",
            "基準 1 逆優位 ＝ −（Map 上位 3 種族の Setup 値の和）− 0.2 × 全種族の散らばり。基準 2 上位バランス ＝ −（上位 K ＝ 人数＋2 の散らばり）＋ 0.3 ×（上位の平均 − 残りの平均）。基準 3 全体バランス ＝ −全種族の散らばり。基準 4 優位 ＝ Map 上位 K 種族の Setup 値の平均 − 0.2 × その散らばり。",
            "添え物の係数 0.2 / 0.3 は「主項が同じ候補の順番を決める」程度の目分量。基準 2・3 はマップに依存しないので、マップは条件に合う先頭のものになる。",
            "種族優遇／冷遇は種族ごとの ± で、掛け先は Map ＋ Setup の合計（200 前後）。同じ母星色の 2 種族は Map ぶんが同じで Setup ぶんで差がつく。",
            "「合計の上位」は Map ＋ Setup の合計が高い順に人数＋2 色、同じ色は強い方の種族だけ（同色の 2 種族は卓で 1 人しか選べない）。",
          ],
        },
        { h3: "船の相互作用（Map と Setup をまたぐ軸）" },
        {
          p:
            "List のセット提案の採点と Total の Setup 列では、船 s に乗るタイルの種族別の値を、その種族の船接触 C（船の近くの惑星の到達係数 × 船接触の和）の相対値で増減します（α 1 ＝ 掛け算）。" +
            "届かない船のタイルは 0 になります。検索には入れていません。加点は Setup の値の 2.5%、合計の上位の顔ぶれが変わる組は 23%。α と尺度は本番の体感で調整中です。",
        },
        { h3: "Total（種族別総合評価）" },
        {
          ul: [
            "選んだマップとセットアップで、種族ごとに Map の値（内訳表のその種族の行）と Setup の値（船の相互作用込み）を合算比で足す。",
            "合算比の既定 1:1 は未決。Map の最上位は LF 4 人 205 / 3 人 186 / 基本版 73 と版で桁が違い、一律の倍率では LF で Map が支配する。評価値の調整が終わってから決め直す。",
            "内訳を持たない古いマップ候補は Map ぶんが 0 になる（Map タブで検索し直すと付く）。",
          ],
        },
        { ref: "4" },
      ],
    },
    {
      id: "history",
      title: "6. 設計の経緯と教訓",
      blocks: [
        {
          ul: [
            "ガイア近接の軸（距離 1 / 2 / 3 で 5 / 8 / 3）は廃止した。「距離 2 が最大」は 2026-07-30 に各軸の割合を合わせた副産物で、価値判断ではなかった。由来の分からない値は調べて、根拠が無ければ捨てる。",
            "星系の軸も外した。隣接自体は到達コスト 0 で既に報われるので、固有値との二重計上になる。新しい軸を足すときは既存の式にもう含まれていないか確認する。",
            "eval_v5（種族ごとの計算）と eval_v6（ガイア・次元横断の計上）は本番に出さず、全惑星を同一の式で評価する eval_v7 に一本化した。途中で「大きく掛ける」＝「大きく削る」の取り違えが一度起きたので、係数は 0〜1 の「削る量」として数字で確認する。",
            "「基本版で端が有利」は測り方の誤りだった。全種族を混ぜて重心距離と相関を取ると開始地点の数の違いが交絡して符号が反転した。種族ごとに平均を引いて欠けマス数と相関を取ると端は一貫して不利（−0.41）。新しい傾向を見つけたら、まず測り方を疑う。",
            "船の相互作用は α を 0.5 → 1 にしても加点が 0.2% → 0.4% にしかならず、原因は船どうしの船接触の差が小さい尺度にあった。種族ごとの船接触に変えると α 1 で 2.5% になった。尺度が効かないときは係数を上げる前に尺度を疑う。",
            "「端寄りの開始地点が高い気がする」の原因は、欠けマス罰点 0 で検索していたことだった。体感と合わないときは、まず検索条件を確認する。",
            "500 件ごとの途中保存（v1.6.6）は検索を遅くしたので廃止した（v1.6.7）。背景に回った瞬間と停止時の保存だけ残す。",
            "回帰スナップショットは万能ではない（LF テンプレ 150 盤面だけで、基本版の変化と色の代表にならない種族の変化は差分に出ない）。種族の値は調査スクリプトで直接見る。",
          ],
        },
        { ref: "2.2 / 2.7 / 2.8 / 2.9 / 2.10、tuning-guide 3" },
      ],
    },
    {
      id: "tuning",
      title: "7. 調整中の定数",
      blocks: [
        {
          p: "本番の体感と合わせるために真っ先に触る値（docs/tuning-guide.md 1 節）。★ は Map の評価の意味が変わる（評価バージョンが上がる）。",
        },
        {
          table: {
            head: ["定数", "現在値", "意味"],
            rows: [
              ["船の相互作用の α", "1（掛け算）", "船に乗るタイルの種族別の値を、その種族の船接触の相対値でどれだけ増減するか。0 ＝ 無効"],
              ["船接触の尺度", "種族ごと（到達係数 × 船接触、半径 3）", "「その船へこの種族が届くか」。調整候補: 種別の係数も掛ける／半径／届かない船の扱い"],
              ["マーカーの到達コスト上限", "3", "内訳表のセルをタップしたときに光る惑星の範囲（表示だけ）"],
              ["ダー・シュワーム人の開始地点 ★", "× 1.5", "惑星首府 1 つの開始地点の値の倍率（倍率 1 でハッシュ・ホラ人との差 +53 / 1.5 で +36 / 2 で +18、LF 4 人）"],
              ["種別の係数 ★", "固有値 10 / 母星色 1 / 他色 0.25 / ガイア 0.5 / 次元横断 0.25（ガイア種族 0.5）/ 原始・小惑星 0.1 / 改造種族 × 1.2", "3 章の表"],
              ["ガイア種族・改造種族の分類 ★", "ガイア: 地球人・バルタック人・イタル人・モウェイド人／改造（暫定）: ジオデン人・タクロン族・ネヴラ人", "将来は種族ごとの倍率表にする"],
              ["欠けマス罰点 w", "0.5（入力欄 5）", "既定値を変えると式は同じでも既定条件の結果バケツが新しくなる"],
              ["Map : Setup の合算比", "1:1（未決）", "Total の合計列、List の種族優遇の掛け先、合計の上位が同じ比を使う"],
            ],
          },
        },
        { ref: "tuning-guide 1 / 2" },
      ],
    },
  ],
};

const en: ManualText = {
  title: "Manual",
  intro:
    "Design intent, policy and the reasoning behind the evaluation, chapter by chapter. The \"?\" next to each item on the screens carries a summary of the same material. " +
    "\"Design notes\" at the end of each chapter are section numbers of docs/design-notes.md (history and measurements).",
  toc: "Contents",
  refLabel: "Design notes",
  chapters: [
    {
      id: "overview",
      title: "1. Purpose and the four tabs",
      blocks: [
        {
          p:
            "This tool generates Gaia Project boards (Map) and tile layouts (Setup) from seeds in bulk, evaluates them and ranks them (Lost Fleet supported). " +
            "It measures, in numbers, how evenly a board serves every colour and faction, and how well a setup's tiles fit each faction.",
        },
        {
          table: {
            head: ["Tab", "What it does", "Unit of evaluation"],
            rows: [
              ["Map (/board)", "Generates many boards from seeds, filters by hard constraints, ranks by soft weights and keeps the top K", "Per faction (a colour's value is the larger of its two factions)"],
              ["Setup (/setup)", "Builds a tile layout from a seed and values it for each of the 18 factions", "Per faction"],
              ["List (/list)", "Suggests pairs of pinned maps and setups by four criteria", "Map + setup per faction"],
              ["Total (/total)", "Adds map and setup per faction for one chosen map and setup", "Per faction"],
            ],
          },
        },
        {
          p:
            "Every player shares the same map, while setup tiles are taken first come first served. Two factions of one home colour sit in similar positions on the board; " +
            "the difference comes mostly from the setup side (the map is also computed per faction since eval_v5).",
        },
        { h3: "Scale of the values" },
        {
          ul: [
            "Both the map value and the setup value are about 100 per faction, about 200 together, so Total can simply add them, close to real game scores.",
            "Setup divides the VP sum by 28 as the last step, so the parts add up to the total exactly.",
            "The map scale is settled after the evaluation constants are tuned (the map : setup blend stays 1:1 and undecided; chapter 7).",
          ],
        },
        { h3: "Result buckets and versions" },
        {
          ul: [
            "Results accumulate per condition. A condition profile key includes the weights, but Setup's result bucket key only includes the settings (changing weights does not hide stored results).",
            "A change that alters the meaning of the evaluation bumps the map evaluation version (eval_vN) and stores results in a new bucket; older candidates can be re-evaluated and carried over with \"Copy\".",
            "The right end of the top bar shows \"vX.Y.Z · eval_vN\": app version and evaluation version. Use it to confirm which build is live.",
          ],
        },
        { ref: "1.1 / 1.2 / 1.3" },
      ],
    },
    {
      id: "map-search",
      title: "2. Map search",
      blocks: [
        { h3: "Flow" },
        {
          p:
            "Seed → board → hard constraints (reject) → soft weights (score) → top K saved per condition. Soft evaluation only runs on boards that pass, so more trials cost little evaluation time.",
        },
        { h3: "Hard constraints" },
        {
          table: {
            head: ["ID", "Rule", "Default"],
            rows: [
              ["H0", "No direct adjacency of same-type planets (base-game rule)", "Always on for the base game"],
              ["H1", "Same-colour planets never closer than distance 3", "3 (fixed)"],
              ["H2", "Same-colour planets on the outermost ring at most N", "1"],
              ["H4", "Only a large sector in the centre slot (Lost Fleet only)", "Off"],
              ["H5", "Maximum size of a connected planet cluster (optionally counting scout cells)", "Off"],
            ],
          },
        },
        {
          p:
            "Pass rate with the defaults: LF 4p 0.2%, 3p 0.7% (measured 2026-09-29). The base game barely passes with H2 = 1; 2% with 3. Edge planets have little room to expand, so H2 drops boards where one colour crowds the edge.",
        },
        { h3: "Search score (what counts as a good board)" },
        { p: "Score = −100 × spread of the seven colour values (imbalance) + preference weight × Σ pref × colour value." },
        {
          ul: [
            "Only the spread matters; the absolute size of the values does not affect the order. A good board is one where every colour is worth about the same.",
            "A colour's value is the larger of its two factions. Proto / asteroid (home of the four Lost Fleet factions) are outside the seven colours; preference applies to their best single planet.",
            "The preference scale was calibrated on 300 boards (4p LF): 0 off / 1 about even with the imbalance term / 2 preference leads / 3 stronger / 5 decided by that colour alone. The default weight 25 makes pref 1 even.",
          ],
        },
        { h3: "Running a search" },
        {
          ul: [
            "Searches run in a worker; Stop interrupts at once and saves the partial results. The progress line ends with the path ([worker] normal, [worker-nosab] worker without shared memory, [main] fallback to the main thread).",
            "\"Keep screen on\" (Screen Wake Lock, default on). Switching to another app pauses the search; the partial results are saved at that moment.",
            "No periodic saving during a search (it slowed searches down). For continuous search, smaller trial counts lose less.",
            "\"Pin\" on a result row collects it on the List tab and protects it from capacity trimming; \"Used\" removes it from the top list.",
          ],
        },
        { ref: "2.1 / 2.3 / 2.5" },
      ],
    },
    {
      id: "map-value",
      title: "3. Map value per faction",
      blocks: [
        {
          p:
            "Policy (2026-10-07): what matters is how easily the best two starts (one or three for some factions) reach and settle every planet. " +
            "All planets on the board, not just the faction's own colour, are scored with one formula and summed (eval_v7).",
        },
        { h3: "Formula" },
        { p: "Faction value = Σ over every planet of coefficient(kind) × (base 10 + scout + core + rim penalty) × reach factor" },
        {
          ul: [
            "Base 10: the value of a planet simply existing, the same order as scout 10. With base 0 the base game (no ships) goes negative and the evaluation breaks.",
            "Scout (Lost Fleet only, default 10, radius 3): added to planets within R of a ship, dropping by 1 per extra distance. A planet next to a ship is worth about twice one that is not.",
            "Scout core (Lost Fleet only, default 3): added to planets within distance 1–2 of touched planets that have two or more touched planets in range (value −1 at distance 2). Only planets inside the ship's cluster qualify.",
            "Rim penalty (default 0.5; the input shows ×10 = 5): for each of the 18 cells within distance 2 that lies off the board. Corner −5, side −3.5, one ring inside about −1.5, inner 0. An edge start loses future expansion (mines, federation satellites, power trades). Effect: base game 9.9% ≫ LF 1%, matching play experience.",
          ],
        },
        { h3: "Reach cost and reach factor" },
        {
          p: "Reach factor = 0.5^(cost − 1): cost 1 is normal range with no discount, then halves per step. Cost = hop cost + settlement steps of stepping stones and of the destination.",
        },
        {
          table: {
            head: ["Hop distance", "1", "2", "3", "4", "5", "6+"],
            rows: [["Cost", "0", "1 (0.5 for factions starting at navigation 1; Baltaks 1.5)", "1.5", "2", "3", "impossible"]],
          },
        },
        {
          table: {
            head: ["Destination", "Steps"],
            rows: [
              ["Same colour", "0"],
              ["Other colour", "Terraform wheel (terra → oxide → volcanic → desert → swamp → titanium → ice): adjacent 1 / two away 2 / opposite 3. Geodens × 2/3"],
              ["Gaia", "1 (Gleens 0.5, three Lost Fleet factions 2)"],
              ["Transdim", "2 (factions starting at gaia level 1: 1; Itars 1.5)"],
              ["Proto / asteroid", "3 / 2 (the four Lost Fleet factions have no home kind and pay this even for their own kind)"],
            ],
          },
        },
        {
          p:
            "Per-faction profiles (number of starting structures, navigation / terraforming / gaia research) are constants the user decided and tests pin them. " +
            "The four Lost Fleet factions start from a single planet, so their values come out below the basic factions, as in play.",
        },
        { h3: "Coefficients by kind (how much to discount; 1 = none)" },
        {
          table: {
            head: ["Kind", "Coefficient", "Reason"],
            rows: [
              ["Home colour", "1", "Reference"],
              ["Other colour", "0.25 (terraforming factions Geodens / Taklons / Nevlas × 1.2)", "At 0.5 the other colours contributed 44% and exceeded home; 0.25 gives home 50% / other 28%. Boost 1.5 made Geodens +68, 1.2 gives +6. The list is provisional; a per-faction table is planned"],
              ["Gaia", "0.5", "Reachable by every faction; a candidate for review"],
              ["Transdim", "0.25 (gaia factions Terrans / Baltaks / Itars / Moweids 0.5)", "Same as other colours because of the gaia-project step; gaia factions reach them easily"],
              ["Proto / asteroid", "0.1", "About 2% of the evaluation; the breakdown column is off by default"],
            ],
          },
        },
        { h3: "Starting planets" },
        {
          p:
            "The home-colour planets with the largest total are chosen by brute force (two; Xenos three; Ivits and Lost Fleet factions one). Starts have reach factor 1. " +
            "Ivits start from a single planetary institute, so that start is × 1.5 (eval_v8).",
        },
        { h3: "Reading the breakdown table and markers" },
        {
          ul: [
            "Columns are per kind (home / other / gaia / transdim / ext. (proto / asteroid, off by default) / total). Columns are rounded per kind; the total is their sum.",
            "Tap a kind cell to mark the planets that faction reaches within cost 3 in the kind's colour (Ctrl for several). The total cell marks the starts.",
            "Hover a row name for the base / scout / core / rim parts. Clicking the rim-penalty input marks the edge planets.",
            "The column selector and the column headers carry a \"?\" with each column's meaning and the reasons for the coefficients.",
          ],
        },
        { ref: "2.6 / 2.7 / 2.8 / 2.10" },
      ],
    },
    {
      id: "setup",
      title: "4. Setup evaluation",
      blocks: [
        { h3: "Eight categories in VP" },
        {
          p:
            "Standard tech (by track / free slot), advanced tech (by track), extra advanced (the 7th tile on the scoring-board extension; face vp25 / shuttle), boosters, " +
            "round scoring (by round), final scoring, federation, LF ships (ship tech, gold federations, artifacts; by ship).",
        },
        {
          ul: [
            "Every value is in VP (what the tile is worth if taken at the right time), per faction. The source of truth is the CSV under data/weights; all tables were filled by 2026-09-19 and are edited through the /weights page.",
            "Round scoring is a tile × round × faction table rather than a curve, so differences like \"only Ivits can score the federation tile in round 1\" can be expressed. The +4 VP versions are 4/3 of the +3 VP ones.",
            "Advanced tech is a tile × track × faction table (a faction that does not climb the track cannot take it). Median raw value 24 → 18 (minus the federation tile) → +4 for every tile.",
            "LF ship tiles can be overridden per ship (you must reach the ship; 0 falls back to the base value).",
          ],
        },
        { h3: "Role of the weights" },
        {
          p:
            "Tile value = fit between tile and faction; weight = how much the whole category counts (scale only). Defaults: base 9 / standard tech 9 / advanced 6 / round 6 / extra advanced 2 " +
            "(one third of advanced, since 3–4 players compete for one tile). The sum is divided by 28 at the end.",
        },
        {
          p:
            "Intended influence order: tech > LF ships > advanced > boosters > round > final > extra advanced > federation. Measured (2026-09-27, 200 setups, 4p LF): " +
            "tech 26.8% > LF ships 17.5% > advanced 16.7% > boosters 14.5% > final 8.9% > federation 7.0% > round 6.2% > extra advanced 2.4%. " +
            "The weights are not fine-tuned to enforce the order (deviations reflect the raw values; final scoring varies with everyone's ranking, so 4th–6th is fine).",
        },
        { h3: "Conditions and bulk search" },
        {
          ul: [
            "Conditions are set by clicking tiles or faces (fix / exclude / candidate / default) and satisfied constructively by swapping within the shuffled array.",
            "Bulk search generates many setups under the current conditions and ranks them by a criterion; results are stored per condition × criterion and merged with the previous top.",
            "Colour preference (per home colour, coefficient 0.3) affects bulk-search and suggestion ranking, not the table values. Same scale as on the Map tab (1 = about even with the criterion).",
          ],
        },
        { ref: "3.1 / 3.2 / 3.3 / 3.5" },
      ],
    },
    {
      id: "list-total",
      title: "5. List and Total",
      blocks: [
        { h3: "List (pinned items and pair suggestions)" },
        {
          ul: [
            "Everything pinned on Map and Setup gathers here. Pick a direction (map → setup / setup → map) and a criterion to get up to 5 candidates ranked by the criterion.",
            "Criterion 1 oppose map = −(sum of setup values of the map's top 3) − 0.2 × spread of all. 2 top balance = −(spread of the top K = players + 2) + 0.3 × (mean of top − mean of rest). 3 overall balance = −spread of all. 4 align map = mean setup value of the map's top K − 0.2 × their spread.",
            "The 0.2 / 0.3 side terms only order candidates whose main term ties. Criteria 2 and 3 ignore the map, so the first matching map is used.",
            "Faction preference is per faction and applies to map + setup (about 200). Two factions of one colour share the map part and differ in the setup part.",
            "\"Top by total\" lists players + 2 colours by map + setup, keeping only the stronger faction per colour (two factions of one colour cannot both sit at the table).",
          ],
        },
        { h3: "Ship interaction (the first axis spanning map and setup)" },
        {
          p:
            "In List suggestions and the Total tab's Setup column, tiles on ship s are scaled by the faction's relative scout contact C (sum of reach factor × scout value of planets near the ship), α 1 = multiplication. " +
            "Tiles on a ship the faction cannot reach become 0. Not used in the search. It adds 2.5% of the setup value and changes the top-by-total line in 23% of pairs; α and the scale are being tuned against play.",
        },
        { h3: "Total (by faction)" },
        {
          ul: [
            "For the chosen map and setup, adds per faction the map value (that faction's row in the breakdown) and the setup value (ship interaction included) using the blend ratio.",
            "The default blend 1:1 is still open. Top map values differ by mode (LF 4p 205 / 3p 186 / base 73), so a single multiplier lets the map dominate in Lost Fleet; to be settled once the constants are tuned.",
            "Old map candidates without a breakdown get 0 for the map part (re-search on the Map tab to add it).",
          ],
        },
        { ref: "4" },
      ],
    },
    {
      id: "history",
      title: "6. History and lessons",
      blocks: [
        {
          ul: [
            "The gaia-proximity axis (5 / 8 / 3 at distance 1 / 2 / 3) was removed. \"Distance 2 is the largest\" was a by-product of balancing axis shares on 2026-07-30, not a value judgement. Values of unknown origin are investigated and dropped if unfounded.",
            "The cluster axis was removed too: adjacency is already rewarded by reach cost 0, so it double-counted the base value. Before adding an axis, check the formula does not already contain it.",
            "eval_v5 (per-faction) and eval_v6 (gaia / transdim) never went live; they were unified into eval_v7 (one formula for every planet). \"Scale it up\" was once misread as \"discount it more\", so coefficients are discussed as a discount in 0–1 and confirmed in numbers.",
            "\"The edge is favoured in the base game\" was a measurement error: mixing all factions confounded the number of starts and flipped the sign. Subtracting each faction's mean and correlating with missing cells, the edge is consistently worse (−0.41). When a new trend appears, question the measurement first.",
            "Raising the ship-interaction α from 0.5 to 1 only moved the bonus from 0.2% to 0.4%; the scale (little difference between ships) was the problem. Per-faction scout contact gives 2.5% at α 1. When a scale does nothing, question the scale before raising the coefficient.",
            "\"Edge starts seem too high\" turned out to be a search with rim penalty 0. When results disagree with experience, check the search conditions first.",
            "Saving every 500 trials (v1.6.6) slowed searches and was removed (v1.6.7); only saving on going to the background and on Stop remains.",
            "The regression snapshot is not a safety net for everything (150 Lost Fleet boards only; base-game changes and non-representative factions do not show). Faction values are inspected with probe scripts.",
          ],
        },
        { ref: "2.2 / 2.7 / 2.8 / 2.9 / 2.10, tuning-guide 3" },
      ],
    },
    {
      id: "tuning",
      title: "7. Constants under tuning",
      blocks: [
        { p: "The values to touch first to match play experience (docs/tuning-guide.md section 1). ★ changes the meaning of the map evaluation (bumps the evaluation version)." },
        {
          table: {
            head: ["Constant", "Current", "Meaning"],
            rows: [
              ["Ship interaction α", "1 (multiplication)", "How much a faction's tile values on ship s are scaled by its relative scout contact. 0 = off"],
              ["Scout-contact scale", "Per faction (reach factor × scout, radius 3)", "Whether this faction reaches that ship. Candidates: include kind coefficients / radius / unreachable ships"],
              ["Marker reach-cost limit", "3", "Which planets light up when a breakdown cell is tapped (display only)"],
              ["Ivits start ★", "× 1.5", "Multiplier of the single-institute start (gap to Hadsch Hallas +53 at 1 / +36 at 1.5 / +18 at 2, 4p LF)"],
              ["Kind coefficients ★", "base 10 / home 1 / other 0.25 / gaia 0.5 / transdim 0.25 (gaia factions 0.5) / proto・asteroid 0.1 / terraforming × 1.2", "Table in chapter 3"],
              ["Gaia / terraforming factions ★", "Gaia: Terrans, Baltaks, Itars, Moweids / terraforming (provisional): Geodens, Taklons, Nevlas", "A per-faction table is planned"],
              ["Rim penalty w", "0.5 (input 5)", "Changing the default starts a new result bucket for the default condition even though the formula is unchanged"],
              ["Map : setup blend", "1:1 (open)", "Shared by Total, List's faction preference and the top-by-total line"],
            ],
          },
        },
        { ref: "tuning-guide 1 / 2" },
      ],
    },
  ],
};

export const MANUAL: Record<"ja" | "en", ManualText> = { ja, en };
