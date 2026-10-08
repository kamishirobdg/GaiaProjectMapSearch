# GaiaProjectMapSearch

ボードゲーム「ガイアプロジェクト」のマップ生成・検索ツール。
拡張 **Lost Fleet**（3人・4人）と**基本版**（3・4人共用 `base_34p`、
ルールブックp19の配置方法1/2/3）に対応。

シード値から盤面を決定論的に組み立て、ハード制約（満たさない盤面は却下）で絞り込み、
ソフト評価（重み付きスコア）で順位付けして上位 K 件を提示する。

Next.js 16 / React 19 / TypeScript strict。

本番は **https://gaia-project-map-search.vercel.app/board** （一般公開はしていない）。
`release/v1.01` を `main` へ push すると Vercel が自動でデプロイする
（`git push origin release/v1.01:main`）。

**版**（2026-10-05 から）: 正本は `package.json` の version。本番へ出すたびに同じ番号の git タグ
（`v1.2.1` など）を `main` に打ち、画面の共通バー右端に「v1.2.1 · eval_v4」（アプリの版と
Map 評価のバージョン）を出す。番号は、評価の意味が変わる変更（`EVAL_VERSION` が上がる）や
機能追加で2桁目、表示やドキュメントだけなら3桁目を上げる。ブランチ名 `release/v1.01` は
リリース用の線の名前で、版とは独立。

## セットアップ

```bash
npm install
npm run dev
```

開いた先は **http://localhost:3000/board**。`/` にページは無く 404 になる。

`next.config.ts` が COOP/COEP ヘッダを付けている。これは Worker の停止に使う
`Atomics` / `SharedArrayBuffer` に `crossOriginIsolated=true` が必要なため。

## 仕組み

検索は 1 シードにつき次のパイプラインを通す（`src/gaia/search.ts`）。

```
seed
  -> buildLogicalMap    セクタータイルを配置し、セル単位の論理マップを組む
  -> extractForEval     評価に使う形（惑星セル・outer/touch 集合など）へ抽出
  -> checkHardConstraints  H1/H2/H4/H5。1つでも違反したらこのシードは捨てる
  -> evaluateSoft       重み付きスコアを算出
  -> Top-K
```

検索本体は Web Worker で走り（`src/workers/boardSearch.worker.ts`）、
Worker の生成に失敗した場合はメインスレッドにフォールバックする。

### ソフト評価の集計（2026-10-07 eval_v7「全惑星を同一の式で」、2026-10-08 eval_v8。経緯は eval_v3〜v6）

惑星ごとの**状況の値**（船接触・船星系・端の罰点＝最外周・外周）を出したあと、**種族ごと**の評価値を
盤面の**全惑星**について同じ式で足す（`src/gaia/eval/reachCost.ts` / `evaluateSoft.ts`、`docs/design-notes.md` 2.10）:

```
種族の値 ＝ Σ_{盤面の全惑星 p} 係数(種別(p)) × (固有値 10 ＋ 状況の値(p)) × 到達係数(開始地点 → p)
```

- **開始地点**は母星色（LF は母星種別）の惑星から 2 ヶ所（ゼノ族 3、ダー・シュワーム人と Lost Fleet の
  4種族は 1）。残りの到達加重まで含めて合計が最大になる組を総当たりで選ぶ。
- **係数**（`UNIFIED_VALUE`。すべて調整必須のマジックナンバー。変えるときはユーザー判断＋実測＋`EVAL_VERSION`）:
  母星色 1 / 他色 0.25（改造種族 ジオデン人・タクロン族・ネヴラ人は × 1.2。分類は暫定）/ ガイア 0.5 /
  次元横断 0.25（ガイア種族 地球人・バルタック人・イタル人・モウェイド人は 0.5）/ 原始・小惑星 0.1。
  固有値 10 は「惑星が 1 つあること自体の値」で、船接触 10 と同じ桁。
- **到達コスト** ＝ 跳躍（距離1=0 / 2=1 / 3=1.5 / 4=2 / 5=3 / 6以上は不可）＋ 踏み台と到着した惑星の
  入植の歩数（同色0、改造の輪で隣1・2つ先2・反対3、ガイア1、次元横断2（ガイア Lv1 開始 1、イタル人 1.5）、
  原始3、小惑星2）。惑星を踏み台にした経路の最小値（Dijkstra）。改造の輪は テラ→酸化→火山→砂漠→沼沢→チタン→氷。
  **到達係数** ＝ 0.5 の（コスト−1）乗。コスト1＝通常の到達範囲＝割引なし、以降1段ごとに半減。
- **種族ごとの違い**（`BASIC_REACH_PROFILES` / `LF_REACH_PROFILES`）: 開始建物の数のほかに、航行 Lv1 開始
  （グリーン人・アンバス人・スペースジャイアント・ダルカニア人）は距離2の跳躍 0.5、航行を伸ばせない
  バルタック人は 1.5、改造 Lv1 開始のジオデン人は改造の歩数 × 2/3、ガイア Lv1 開始は次元横断 1、
  グリーン人はガイア惑星 0.5。LF4種族は母星種別が無く、同じ種別にも原始3・小惑星2を払う。
- **内訳表**は種族の行（基本版 14 / LF 18、評価の降順）× **種別の列**（母星色 / 他色 / ガイア / 次元横断 /
  原始・小惑星）。各列は種別ごとに丸めてあり、評価はその合計。セルをクリックするとその種族が到達できる
  惑星が種別の色でマークされ、行名のホバーに固有値・船接触・船星系・端の内訳が出る。
- **色の値はその色の2種族のうち大きい方**（代表値）で、検索の偏り項（7色のばらつき）と色優遇はこの
  代表値で測る。原始・小惑星は LF4種族ごとに計算し、色優遇の掛け先は大きい方の種族の値。
- **端の罰点（最外周・外周）は「欠けマス × w」**（eval_v4）。惑星から距離2以内の18マス（通常の
  到達範囲）のうち盤面に無いマス1つにつき w 点（既定 0.5）を固有値から引く。評価指数「欠けマス罰点」の
  入力欄はその10倍の整数（既定 5 ＝ 最外周の角の惑星1つの罰点。内部値と保存キーは 0.5 のまま）。
  内側は 0、外周（最外周の1つ内側）は 3 前後、最外周は辺 7〜角 10。全種別の惑星に同じ罰点が掛かり、
  加算で下限は無い。**基本版の w は eval_v7 の実測で決め直す**（設計ノート 2.10 末尾）。
- **eval_v8（2026-10-08、v1.6.0）**: ダー・シュワーム人の開始地点（惑星首府 1 つ）の値を × 1.5
  （`BASIC_REACH_PROFILES.ivits.startValueScale`。開始地点が 1 つしか無いぶんの補正。ユーザー確定 案 (A)）。
  同時に、種別の列のセルをクリックしたときのマーカーは**到達コスト 2 以内（到達係数 0.5 以上）**の惑星に絞る
  （`MARKER_MAX_REACH_COST`。評価値は変えない）。List / Total では LF 船の中身とスカウトの位置の**相互作用・段階 1**
  （`src/gaia/eval/shipInteraction.ts`。船ごとの船接触の相対値 × その船のタイル価値 × α 0.5 を Setup の値に加算）を
  掛けてあるが、実測では効きが小さい（設計ノート 2.10 末尾）。Map の評価値そのものは変えていない。
- **経緯**: eval_v3（開始地点＋到達加重）→ eval_v4（欠けマス × w）→ eval_v5（種族ごと）→ eval_v6
  （ガイア・次元横断を入植先に、入植先の係数）→ eval_v7（全惑星を同一の式で。ガイア近接 5 / 8 / 3 と星系の軸、
  入植先の係数 `DESTINATION_VALUE_SCALE` を廃止）→ eval_v8（ダー・シュワーム人 × 1.5）。eval_v5 / v6 は本番に出していない。評価の意味が変わる変更なので
  `EVAL_VERSION` を上げてあり、旧バージョンの結果は「コピー」で現バージョンの評価に作り直して引き継げる。
  経緯と実測は `docs/design-notes.md` 2.6〜2.10。

### ハード制約

| ID | 内容 | 無効化 |
| --- | --- | --- |
| H0 | 同種惑星（基本7色のみ）の直接隣接禁止。基本版ルールの合法性制約 | 基本版では常時有効（LFは対象外） |
| H1 | 同色の通常惑星どうしが `minSameColorDist` 未満に近づかない | — |
| H2 | 外周(outer)にある同色の通常惑星が `outerSameColorMax` 以下 | — |
| H4 | 中央スロットには大型セクター(01〜04)のみ | `centerMode: "NONE"` |
| H5 | 連結した惑星クラスタの最大サイズが `maxConnectedPlanets` 以下 | 未指定 / 0 |

いずれも「上限ちょうどは許容、+1 から却下」。
H5 は `h5IncludeScouts` を立てると探査船セルも惑星の一種として連結に含める。

H5 と `h5IncludeScouts` は後から足した設定なので、**無効値のときは検索条件オブジェクトに
フィールドごと含めない**（`...(x > 0 ? { x } : {})`）。localStorage に保存済みの
searchKey / baseKeyRaw との互換を壊さないため、新しい設定を足すときも同じ形にすること。

### 座標系

盤面には表示側と評価側の 2 つの座標系があり、次の関係で固定されている。

```
display.pos[X] == rotate60(slotCenters[X], 3) + C_group
```

`C_group` はスロット ID の種別（LARGE / MIDDLE_LOW / MIDDLE_HIGH / SMALL）ごとの定数。
4p テンプレートの M2/M5 が 3p からのコピペで壊れ、表示は正しいのに評価側でセルが衝突する、
という事故が実際に起きたため、この関係は `scripts/check-coord-consistency.ts` が恒久的に検査する。

## テスト

```bash
npm test           # Vitest（1回実行）
npm run test:watch
npm run typecheck  # tsc --noEmit
npm run lint       # eslint
```

対象は純粋ロジックに絞っている（`environment: "node"`）。UI コンポーネントは対象外。

- `src/gaia/board/rng.test.ts` — シード付き乱数。ゴールデン値を固定してある。ここが変わると
  記録済みスナップショットと、ユーザーが保存したシード値の意味が全部ずれる。
- `src/gaia/board/axial.test.ts`, `src/gaia/hex.test.ts` — 六角座標。距離の実装が
  `hex.ts`（H1 が使用）と `board/axial.ts`（連結判定・表示側が使用）に 2 つあるので、
  両者が一致することを相互検証している。
- `src/gaia/constraints.test.ts` — H0/H1/H2/H4/H5 の境界。
- `src/gaia/board/basePlacementFromSeed.test.ts` — 基本版の配置生成（方法1/2/3）と、
  実盤面での H0 総当たり照合。
- `scripts/regression-snapshot.test.ts` — 座標整合性チェックと、後述の回帰スナップショット照合。

### 回帰スナップショット

`scripts/__snapshots__/baseline.json` に、5 ラン（LF 2 テンプレート＋基本版 base_34p の
配置方法 1/2/3）× 固定 30 シードをパイプラインへ通した
結果（placement / placementHash / ハード判定 / ソフトスコアの内訳）を記録してある。
`npm test` がこれと突き合わせるので、意図しない挙動変化はテストの失敗として出る。

**挙動を意図的に変えたとき**は、差分が意図した箇所だけであることを確認してから、
同じコミットでベースラインを更新する。

```bash
npm run snapshot:update
git diff scripts/__snapshots__/baseline.json   # 差分が意図どおりか必ず目視
```

比較はバイト列ではなくパース後の JSON で行う。生成側は常に LF で書くが、Windows では
`core.autocrlf` によりチェックアウト時に CRLF になるため、バイト比較だと毎行差分になってしまう。
`.gitattributes` でこのファイルを `eol=lf` に固定してあるのはそのため。

## 開発の進めかた

1. 機能ブランチを切り、1 修正 = 1 コミットで、`release/v1.01` へ FF マージする。
2. コミットごとに `npm run typecheck`（0 件）、`npm run lint`（エラー 0）、`npm test`（全緑）を通す。
3. 挙動が変わる仕様は、実装前に選択肢を出して決めてから着手する。
4. `git push` は Vercel デプロイを意味するので、指示があるまでしない。
5. 本番へ出すときは `package.json` の version を上げ（表示だけなら3桁目、評価や機能なら2桁目）、
   FF push 後に同じ番号のタグを `main` に打つ（`git tag v1.2.1 <main のハッシュ> && git push origin v1.2.1`）。

## ディレクトリ

```
src/app/board/page.tsx        検索UI本体（条件パネル・結果一覧）
src/app/board/uiText.ts       UI文言辞書（ja/en）
src/app/board/persistence.ts  検索結果・保存条件のIndexedDB層
src/app/board/searchRunner.ts Worker検索＋メインスレッドfallback
src/app/board/BreakdownTable.tsx 色別内訳/詳細表・惑星色定数
src/components/MapBoardViewer.tsx  盤面描画
src/gaia/
  search.ts                   パイプラインのオーケストレーション
  logicalMap/buildLogicalMap.ts  シード -> 論理マップ
  eval/extractForEval.ts      論理マップ -> 評価入力（SSOT）
  eval/evaluateSoft.ts        ソフト評価
  constraints.ts              ハード制約 H0(基本版のみ)/H1/H2/H4/H5
  board/                      座標・乱数などの基礎
  ssot/                       placementHash・検索設定のSSOT
  templates/, data/templates/ 評価側 slotCenters / 表示側 TemplateDef
  sectorTiles_*.ts            セクタータイル定義
src/workers/boardSearch.worker.ts  検索の実行先
data/weights/                 種族別評価の重み CSV（**正本**。src/gaia/eval の
                              *Weights.ts はここから自動生成する。README.md 参照）
scripts/
  gen_*_table.py              CSV -> 重みテーブル(.ts) の生成と検算
  regression-snapshot.ts      ベースライン生成 CLI
  check-coord-consistency.ts  座標整合性チェック CLI
  _probe_*.ts                 過去の調査に使った使い捨てスクリプト
```

## 既知の未整備・保留

- `C_group` に 1〜2 ヘックスの差がある（LARGE=(19,14) / MIDDLE_LOW=(17,14) /
  MIDDLE_HIGH・SMALL=(18,14)）。現状値で整合が取れているので触らない方針。
  `check-coord-consistency.ts` が現状値を監視している。
- `MapBoardViewer.tsx` など描画側に Axial / parseKey の重複実装が残っている。
- 固定シード値やパネルの開閉状態は永続化していない（意図的）。検索件数と seedMode は
  localStorage に保存する。
- `rotate60` は原点に対し `q: -0` を返す。`keyOf` が `"0"` に潰すので実害は無い。
