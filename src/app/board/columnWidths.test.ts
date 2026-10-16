import { describe, expect, it } from "vitest";
import { distributeSurplus } from "./columnWidths";

const sum = (a: number[]) => a.reduce((x, y) => x + y, 0);

describe("distributeSurplus（狭い幅の内訳表の列幅）", () => {
  it("余りが無ければ null（内容幅のまま）", () => {
    expect(distributeSurplus([133, 40, 30, 30, 20, 20], 273)).toBeNull();
    expect(distributeSurplus([133, 40, 30, 30, 20, 20], 200)).toBeNull();
  });

  it("余りはまず狭い列に配り、数値列が等しくなるまで上げる（種族名の列は不変）", () => {
    // 数値列 40 / 30 / 30 / 20 / 20。余り 30 → 20 の 2 列を 30 まで（コスト 20）、残り 10 を 30 の 4 列に 2.5 ずつ
    const w = distributeSurplus([133, 40, 30, 30, 20, 20], 273 + 30)!;
    expect(w[0]).toBe(133);
    expect(w.slice(1)).toEqual([40, 32.5, 32.5, 32.5, 32.5]);
    expect(sum(w)).toBeCloseTo(303, 6);
  });

  it("余りが足りないときも狭い列から順に上げて均等に近づく", () => {
    // 余り 10 → 20 の 2 列に 5 ずつ（25 / 25）。30 の列には届かない
    const w = distributeSurplus([133, 40, 30, 30, 20, 20], 273 + 10)!;
    expect(w.slice(1)).toEqual([40, 30, 30, 25, 25]);
  });

  it("全数値列が等しくなってまだ余れば均等に足す", () => {
    // 等しくするコスト: 20→30 ×2 = 20、30→40 ×4 = 40、計 60。余り 110 → 残り 50 を 5 列に 10 ずつ
    const w = distributeSurplus([133, 40, 30, 30, 20, 20], 273 + 110)!;
    expect(w[0]).toBe(133);
    expect(w.slice(1)).toEqual([50, 50, 50, 50, 50]);
    expect(sum(w)).toBeCloseTo(383, 6);
  });

  it("数値列が 1 つなら余りは全部その列に", () => {
    expect(distributeSurplus([100, 40], 200)).toEqual([100, 100]);
  });

  it("列が種族名だけなら null", () => {
    expect(distributeSurplus([100], 200)).toBeNull();
  });
});
