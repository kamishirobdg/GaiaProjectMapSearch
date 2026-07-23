# GaiaProjectMapSearch

ボードゲーム「ガイアプロジェクト」のマップ生成・検索ツール。
拡張 **Lost Fleet**（3人・4人）と**基本版**（3・4人共用 `base_34p`、
ルールブックp19の配置方法1/2/3）に対応。

シード値から盤面を決定論的に組み立て、ハード制約（満たさない盤面は却下）で絞り込み、
ソフト評価（重み付きスコア）で順位付けして上位 K 件を提示する。

Next.js 16 / React 19 / TypeScript strict。Vercel にデプロイ済み。

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

## ディレクトリ

```
src/app/board/page.tsx        検索UI（条件パネル・結果一覧）
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
scripts/
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
