# 種族別評価の重みテーブル（CSV が正本）

セットアップ側の評価に使う重みは、**この CSV が正本**。
`src/gaia/eval/*.ts` の対応するファイルは**自動生成物なので手で編集しない**。

## 対応表

| CSV | 生成先（自動生成・手で触らない） | 生成スクリプト | 中央値 | 刻み | セル数 |
| --- | --- | --- | --- | --- | --- |
| `advanced_tech_base.csv` | `src/gaia/eval/advancedTechWeights.ts` | `gen_advanced_tech_table.py` | 18 | 3 | 1260 |
| `advanced_tech_lf.csv` | 同上 | 同上 | 18 | 3 | 3024（研究列6＋拡張部の面2） |
| `tech_position_base.csv` | `src/gaia/eval/techPositionWeights.ts` | `gen_tech_position_table.py` | 12 | 2 | 756 |
| `tech_position_lf.csv` | 同上 | 同上 | 12 | 2 | 972 |
| `round_scoring_base.csv` | `src/gaia/eval/roundScoringWeights.ts` | `gen_round_scoring_table.py` | 10 | 2 | 756 |
| `round_scoring_lf.csv` | 同上 | 同上 | 10 | 2 | 1296 |
| `tile_weights_base.csv` | `src/gaia/eval/tileWeights.ts` | `gen_tile_weights_table.py` | ※ | 2 | 308 |
| `tile_weights_lf.csv` | 同上 | 同上 | ※ | 2 | 954 |

※ `tile_weights_*.csv` はカテゴリごとに中央値が違う:
ブースター6 / 最終得点9 / 同盟タイル8 / LF船10。

`_base` は通常版（基本14種族）、`_lf` は拡張版（18種族）。拡張の有無で場に出る
タイルの母集団が変わり、同じタイルでも相対的な影響力が変わるので表を分けてある。

`advanced_tech_lf.csv` だけ研究列6つ（惑星/航法/人工知能/ガイア/経済/科学）に
加えて **`vp25`（25点）/ `shuttle`（3船）** の2軸を持つ（2026-08-08 追加）。これは
得点ボード拡張部（研究列に紐付かない7枚目の上級技術スロット）に置かれたときの
価値で、拡張部の面が2人=25VP面固定／3・4人=探査シャトル面（2ゲーム目以降は
ランダム選択も可）と分かれているため、面ごとに別々の値を入れる。値が入っていない
（0の）タイルは実行時に研究列6つの最大値へ自動フォールバックする
（`advancedTechExtensionCell`）。

## 値の意味

すべて **VP 換算**（2026-08-03 確定）。「そのタイルを適切なタイミングで取れたら
何点分の価値があるか」を種族ごとに入れる。0 はほぼ無く、5 以下も稀。

投入時の中身は**雛形**で、VP 換算前の相性値（-2..+2）を
`中央値 + 刻み × 相性値` で写像し、研究列やラウンドの差はゼロにしてある。
ここに「この列に置かれるとこの種族は取りに行けない」「このラウンドなら狙える」
といった差を入れていくのがレビュー作業。

評価値は最後に `SETUP_SCORE_DIVISOR`（= 40）で割られ、種族あたり100前後になる
（Map 側の評価値と同じ桁）。CSV の値はその前段の VP なので、40 で割った後の
見え方を気にせず「何点分か」だけを考えて入れてよい。

## 更新の手順

1. CSV を編集する（Excel で開ける。BOM 付き UTF-8 なので文字化けしない）。
2. TypeScript を生成し直す。通常版と拡張版の2本をまとめて渡す:

   ```
   python scripts/gen_advanced_tech_table.py --emit-file src/gaia/eval/advancedTechWeights.ts data/weights/advanced_tech_base.csv data/weights/advanced_tech_lf.csv
   python scripts/gen_tech_position_table.py --emit-file src/gaia/eval/techPositionWeights.ts data/weights/tech_position_base.csv data/weights/tech_position_lf.csv
   python scripts/gen_round_scoring_table.py --emit-file src/gaia/eval/roundScoringWeights.ts data/weights/round_scoring_base.csv data/weights/round_scoring_lf.csv
   python scripts/gen_tile_weights_table.py --emit-file src/gaia/eval/tileWeights.ts data/weights/tile_weights_base.csv data/weights/tile_weights_lf.csv
   ```

3. 全セル突き合わせで検算する（両方向。TS 側にだけある値も検出する）:

   ```
   python scripts/gen_advanced_tech_table.py data/weights/advanced_tech_lf.csv --check
   ```

4. `npm run typecheck` / `npm test` を通す。
5. 影響力が狙いの順（技術 > LF船 > 上級 > ブースター > ラウンド > 最終 >
   追加上級 > 同盟）から外れていないか測る:

   ```
   npx tsx scripts/_probe_category_influence.ts 200 4
   ```

   桁を見るなら `_probe_score_range.ts`（種族あたり100前後）、実プレイで取れる
   枚数ぶんの得点を見るなら `_probe_expected_score.ts`。

## スマホから編集する（`/weights`）

CSV を直接いじらずに、**アプリの編集ページ**から入れることもできる（2026-08-06 追加）。
Android で `https://gaia-project-map-search.vercel.app/weights` を開く
（開発中は `http://localhost:3000/weights`）。評価ツール本体の画面ではないので
タブには出していない —— URL を直接開くか、ホーム画面にショートカットを置く。

- 初期値は**アプリに焼き込まれた表**（＝生成済みの `.ts`）。CSV の貼り付けは要らない。
- 入力は2モード:
  - **一括** … 種族 × 研究列（またはラウンド）の倍率。100%＝素直に取れる、
    0%＝その列では取れない。**その表の全タイルに効く**ので、
    「バルタック人は航法を進められない」のような種族の性質は1回入れれば済む。
  - **タイル** … タイル1枚ごとに、基準値（＝取れたら何点か）と列ごとの倍率を上書きする。
    一括より優先され、上書きしたセルは下線が付く。ルール全文が同じ画面に出る。
- 編集はブラウザの localStorage に溜まるだけで、**CSV も `.ts` も書き換わらない**。
- 「差分を出す」で変わったセルだけのテキストが出る。それを PC へ持ち帰って反映する:

  ```
  python scripts/apply_weight_edits.py edits.txt            # CSV へ反映
  python scripts/apply_weight_edits.py edits.txt --dry-run  # 件数だけ見る
  ```

  未知のタイル・軸・種族があれば**何も書かずに止まる**（部分適用を残さないため）。
  反映したら上の「更新の手順」2以降（TS の生成 → 検算 → typecheck/test）を回す。
- 反映が済んだら編集ページの「全消去」を押す。生成し直した `.ts` が次の初期値になるので、
  消しておかないと同じ差分をもう一度出してしまう。

## 雛形を作り直したいとき

`--template [--lf]` で、いまのテーブルから CSV を書き出せる（中央値や刻みを
変えたときはスクリプト側の `TEMPLATE_BASE` / `TEMPLATE_STEP` を直してから）。

```
python scripts/gen_advanced_tech_table.py --template --lf > data/weights/advanced_tech_lf.csv
```

**注意**: 雛形の入力元は `TILE_FACTION_WEIGHTS`（VP 換算前の相性値）なので、
すでに CSV へ入れた値は上書きで消える。作り直すのは値をまだ入れていないときだけ。
