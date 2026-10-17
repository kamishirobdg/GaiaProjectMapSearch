import { describe, expect, it } from "vitest";
import {
  applyColorToFactionPref,
  factionPrefFromColorPref,
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

  it("色で指定すると同じ色の 2 種族に同じ値が入り、0 で両方消える", () => {
    const p = applyColorToFactionPref({ terrans: 1 }, "RED", 2);
    expect(p).toEqual({ terrans: 1, hadschHallas: 2, ivits: 2 });
    expect(colorValueOfFactionPref(p, "RED")).toBe(2);
    expect(colorValueOfFactionPref({ hadschHallas: 2 }, "RED")).toBeNull();
    expect(applyColorToFactionPref(p, "RED", 0)).toEqual({ terrans: 1 });
  });

  it("旧 Map 条件の色の値は同じ色の 2 種族へ同じ値で取り込む（0 と原始・小惑星の省略は落とす）", () => {
    expect(factionPrefFromColorPref({ BLACK: 0, RED: 2, PROTO: -1 })).toEqual({ hadschHallas: 2, ivits: 2, moweyds: -1, spaceGiants: -1 });
    expect(factionPrefFromColorPref(null)).toEqual({});
  });

  it("sanitize は知らない種族・0・数でない値を落とす", () => {
    expect(sanitizeFactionPref({ terrans: 1, nope: 2, ivits: 0, xenos: "3", gleens: "x" })).toEqual({ terrans: 1, xenos: 3 });
    expect(sanitizeFactionPref(null)).toEqual({});
  });
});
