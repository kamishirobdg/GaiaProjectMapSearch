import { describe, expect, it } from "vitest";
import {
  applyColorToFactionPref,
  colorPrefFromFactionPref,
  colorValueOfFactionPref,
  factionsOfColor,
  sanitizeFactionPref,
} from "./searchProfiles";

describe("searchProfiles（種族優遇と色優遇の往復）", () => {
  it("色の種族: 赤はハッシュ・ホラ人とダー・シュワーム人、原始はモウェイド人とスペースジャイアント", () => {
    expect(factionsOfColor("RED")).toEqual(["hadschHallas", "ivits"]);
    expect(factionsOfColor("PROTO")).toEqual(["moweyds", "spaceGiants"]);
    expect(factionsOfColor("NOPE")).toEqual([]);
  });

  it("指定が無ければ基本 7 色は 0、原始・小惑星はキーごと無し（Map の検索キーを不変に保つ）", () => {
    expect(colorPrefFromFactionPref({})).toEqual({ BLACK: 0, BLUE: 0, BROWN: 0, ORANGE: 0, RED: 0, WHITE: 0, YELLOW: 0 });
  });

  it("同じ色の 2 種族のうち |値| が大きい方を採り、同じ大きさで符号が逆なら 0", () => {
    expect(colorPrefFromFactionPref({ hadschHallas: 1, ivits: 2 }).RED).toBe(2);
    expect(colorPrefFromFactionPref({ hadschHallas: -3, ivits: 2 }).RED).toBe(-3);
    expect(colorPrefFromFactionPref({ hadschHallas: -2, ivits: 2 }).RED).toBe(0);
    expect(colorPrefFromFactionPref({ moweyds: 1 })).toMatchObject({ PROTO: 1 });
    expect("ASTEROID" in colorPrefFromFactionPref({ moweyds: 1 })).toBe(false);
  });

  it("色で指定すると同じ色の 2 種族に同じ値が入り、0 で両方消える", () => {
    const p = applyColorToFactionPref({ terrans: 1 }, "RED", 2);
    expect(p).toEqual({ terrans: 1, hadschHallas: 2, ivits: 2 });
    expect(colorValueOfFactionPref(p, "RED")).toBe(2);
    expect(colorValueOfFactionPref({ hadschHallas: 2 }, "RED")).toBeNull();
    expect(applyColorToFactionPref(p, "RED", 0)).toEqual({ terrans: 1 });
  });

  it("sanitize は知らない種族・0・数でない値を落とす", () => {
    expect(sanitizeFactionPref({ terrans: 1, nope: 2, ivits: 0, xenos: "3", gleens: "x" })).toEqual({ terrans: 1, xenos: 3 });
    expect(sanitizeFactionPref(null)).toEqual({});
  });
});
