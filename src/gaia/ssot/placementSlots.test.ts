// テンプレと placement のスロット集合が一致することを固定する。
//
// /board はこの一致を「表示中の盤面が選択中のテンプレのものか」の判定に使う
// （page.tsx の templateMismatch）。例外の有無では判定できない: 4p_lostFleet の
// スロットは base_34p / 3p_lostFleet の上位集合なので、base の placement を渡しても
// buildLogicalMapFromPlacement は素通りして"正しく見える"論理マップを作ってしまう。
// ここが崩れると、正常な盤面にまで警告が出る（または食い違いを見逃す）。
import { describe, it, expect } from "vitest";
import { makeSearchPlacementFromSeed } from "./searchPlacementConfig";
import { buildLogicalMapFromPlacement } from "../logicalMap/buildLogicalMap";
import { TEMPLATE_3P_LOSTFLEET } from "../data/templates/3p_lostFleet";
import { TEMPLATE_4P_LOSTFLEET } from "../data/templates/4p_lostFleet";
import { TEMPLATE_BASE_34P } from "../data/templates/base_34p";
import type { TemplateDef } from "../data/templates/types";

const TEMPLATES: Array<[string, TemplateDef]> = [
  ["base_34p", TEMPLATE_BASE_34P],
  ["3p_lostFleet", TEMPLATE_3P_LOSTFLEET],
  ["4p_lostFleet", TEMPLATE_4P_LOSTFLEET],
];

const SEEDS = [1, 42, 12345, 999999];

function slotIds(items: Array<{ slotId: string }>) {
  return [...new Set(items.map((x) => String(x.slotId)))].sort();
}

describe("placement slot sets", () => {
  it("正規の placement はテンプレのスロット集合と完全一致する", () => {
    for (const [templateId, tmpl] of TEMPLATES) {
      const want = slotIds(tmpl.slots);
      // base_34p は placementMethod 1/2/3 で出目が変わるので全部見る
      const methods = templateId === "base_34p" ? ([1, 2, 3] as const) : ([undefined] as const);
      for (const placementMethod of methods) {
        for (const seed of SEEDS) {
          const { placement } = makeSearchPlacementFromSeed({
            templateId,
            seed,
            ...(placementMethod ? { placementMethod } : {}),
          });
          expect(slotIds(placement), `${templateId} pm=${placementMethod ?? "-"} seed=${seed}`).toEqual(want);
        }
      }
    }
  });

  it("4p_lostFleet は他テンプレの placement を例外なく受けてしまう（集合比較が要る理由）", () => {
    const basePlacement = makeSearchPlacementFromSeed({ templateId: "base_34p", seed: 12345 }).placement;

    // 例外は出ない = try/catch では食い違いを検出できない
    expect(() =>
      buildLogicalMapFromPlacement({ templateId: "4p_lostFleet", placement: basePlacement })
    ).not.toThrow();

    // 一方、スロット集合は食い違う
    expect(slotIds(basePlacement)).not.toEqual(slotIds(TEMPLATE_4P_LOSTFLEET.slots));
  });

  it("スロット集合が狭いテンプレでは buildLogicalMapFromPlacement が落ちる", () => {
    const lfPlacement = makeSearchPlacementFromSeed({ templateId: "4p_lostFleet", seed: 12345 }).placement;
    expect(() =>
      buildLogicalMapFromPlacement({ templateId: "base_34p", placement: lfPlacement })
    ).toThrow(/slot center not found/);
  });
});
