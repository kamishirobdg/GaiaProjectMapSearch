// src/gaia/setup/tileRules.test.ts
//
// 全スロット共通のタイル指定（固定/除外/候補）のテスト。
// 「どのシードでも指定が満たされる」「指定が無ければ出力が変わらない」の2点を固定する。

import { describe, expect, it } from "vitest";
import { buildSetupFromSeed, type BuildSetupInput } from "./buildSetup";
import { RESEARCH_TRACK_IDS } from "./types";
import { setTileRule, slotConstraint, type TileRules } from "./tileRules";
import { SETUP_CATALOG } from "./data";

const SEEDS = Array.from({ length: 30 }, (_, i) => String(1000 + i * 7));
const STD_IDS = SETUP_CATALOG.standardTech.map((t) => t.id);
const BOOSTER_IDS = SETUP_CATALOG.boosters.map((t) => t.id);

function build(seed: string, tileRules?: TileRules, extra?: Partial<BuildSetupInput>) {
  return buildSetupFromSeed({
    seed,
    playerCount: 4,
    ...(tileRules ? { tileRules } : {}),
    ...extra,
  } as BuildSetupInput);
}

describe("slotConstraint", () => {
  it("指定が無ければ null（呼び出し側は何もしない）", () => {
    expect(slotConstraint(undefined, "std:nav", STD_IDS)).toBeNull();
    expect(slotConstraint({}, "std:nav", STD_IDS)).toBeNull();
  });

  it("固定はそのタイルだけ、候補は候補群、除外はプールから引く", () => {
    expect(slotConstraint({ s: { TS1: "fix" } }, "s", STD_IDS)!.must).toEqual(["TS1"]);
    const cand = slotConstraint({ s: { TS1: "candidate", TS2: "candidate" } }, "s", STD_IDS)!;
    expect([...cand.allowed!].sort()).toEqual(["TS1", "TS2"]);
    const ex = slotConstraint({ s: { TS1: "exclude" } }, "s", STD_IDS)!;
    expect(ex.allowed!.has("TS1")).toBe(false);
    expect(ex.allowed!.size).toBe(STD_IDS.length - 1);
  });
});

describe("指定が無ければ出力は変わらない（互換の鉄則）", () => {
  it("tileRules を空で渡しても省略時と同じ", () => {
    for (const seed of SEEDS.slice(0, 8)) {
      expect(build(seed, {})).toEqual(build(seed));
    }
  });
});

describe("研究トラックの標準技術（位置あり）", () => {
  it("固定したタイルがどのシードでもそのトラックに入る", () => {
    const rules: TileRules = { "std:nav": { TS8: "fix" } };
    for (const seed of SEEDS) {
      expect(build(seed, rules).standardTech.byTrack.nav).toBe("TS8");
    }
  });

  it("除外したタイルはどのシードでもそのトラックに入らない", () => {
    const rules: TileRules = { "std:nav": { TS8: "exclude" } };
    for (const seed of SEEDS) {
      expect(build(seed, rules).standardTech.byTrack.nav).not.toBe("TS8");
    }
  });

  it("候補を指定するとその中から選ばれる", () => {
    const rules: TileRules = { "std:nav": { TS1: "candidate", TS2: "candidate" } };
    for (const seed of SEEDS) {
      expect(["TS1", "TS2"]).toContain(build(seed, rules).standardTech.byTrack.nav);
    }
  });

  it("複数トラックの固定を同時に満たす（互いを壊さない）", () => {
    const rules: TileRules = { "std:nav": { TS8: "fix" }, "std:sci": { TS3: "fix" } };
    for (const seed of SEEDS) {
      const r = build(seed, rules);
      expect(r.standardTech.byTrack.nav).toBe("TS8");
      expect(r.standardTech.byTrack.sci).toBe("TS3");
    }
  });

  it("9枚は重複せず全トラック＋フリー枠を埋める（入替で壊れない）", () => {
    const rules: TileRules = { "std:nav": { TS8: "fix" }, "std:sci": { TS3: "fix" } };
    for (const seed of SEEDS) {
      const r = build(seed, rules);
      const used = [...RESEARCH_TRACK_IDS.map((t) => r.standardTech.byTrack[t]), ...r.standardTech.free];
      expect(new Set(used).size).toBe(9);
    }
  });
});

describe("順不同の枠（ブースター・フリー枠）", () => {
  it("ブースターの固定は「必ず場に出ている」", () => {
    const rules: TileRules = { booster: { [BOOSTER_IDS[3]]: "fix" } };
    for (const seed of SEEDS) {
      expect(build(seed, rules).boosters.available).toContain(BOOSTER_IDS[3]);
    }
  });

  it("ブースターの除外は「場に出ない」", () => {
    const rules: TileRules = { booster: { [BOOSTER_IDS[3]]: "exclude" } };
    for (const seed of SEEDS) {
      expect(build(seed, rules).boosters.available).not.toContain(BOOSTER_IDS[3]);
    }
  });

  it("フリー枠の固定は必ずフリー枠に入る", () => {
    const rules: TileRules = { stdFree: { TS5: "fix" } };
    for (const seed of SEEDS) {
      expect(build(seed, rules).standardTech.free).toContain("TS5");
    }
  });

  it("ブースターの枚数は変わらない", () => {
    const rules: TileRules = { booster: { [BOOSTER_IDS[3]]: "fix" } };
    for (const seed of SEEDS) {
      const r = build(seed, rules);
      expect(r.boosters.available.length).toBe(7); // 4人 => players+3
      expect(new Set(r.boosters.available).size).toBe(7);
    }
  });
});

describe("ラウンド得点・最終得点・同盟", () => {
  it("R3 の固定がどのシードでも効く", () => {
    const id = SETUP_CATALOG.roundScoring[2].id;
    const rules: TileRules = { "rs:2": { [id]: "fix" } };
    for (const seed of SEEDS) expect(build(seed, rules).roundScoring[2]).toBe(id);
  });

  it("最終得点1枠目の候補指定が効く", () => {
    const ids = SETUP_CATALOG.finalScoring.slice(0, 2).map((t) => t.id);
    const rules: TileRules = { "fs:0": { [ids[0]]: "candidate", [ids[1]]: "candidate" } };
    for (const seed of SEEDS) expect(ids).toContain(build(seed, rules).finalScoring[0]);
  });

  it("同盟タイルの固定が効く", () => {
    const id = SETUP_CATALOG.federations[4].id;
    const rules: TileRules = { fed: { [id]: "fix" } };
    for (const seed of SEEDS) expect(build(seed, rules).federationLv5).toBe(id);
  });
});

describe("setTileRule", () => {
  it("デフォルトへ戻すとスロットのキーごと消える（キー不変の前提）", () => {
    const a = setTileRule(undefined, "std:nav", "TS8", "fix");
    expect(a).toEqual({ "std:nav": { TS8: "fix" } });
    expect(setTileRule(a, "std:nav", "TS8", null)).toEqual({});
  });

  it("位置スロットでは固定は1枚だけ（singleFix）", () => {
    let r = setTileRule(undefined, "std:nav", "TS1", "fix", { singleFix: true });
    r = setTileRule(r, "std:nav", "TS2", "fix", { singleFix: true });
    expect(r["std:nav"]).toEqual({ TS2: "fix" });
  });

  it("順不同の枠では固定を複数持てる（＝複数「含む」）", () => {
    let r = setTileRule(undefined, "booster", "RB01", "fix");
    r = setTileRule(r, "booster", "RB02", "fix");
    expect(r.booster).toEqual({ RB01: "fix", RB02: "fix" });
  });

  it("元のオブジェクトを壊さない", () => {
    const a: TileRules = { "std:nav": { TS1: "fix" } };
    setTileRule(a, "std:nav", "TS2", "exclude");
    expect(a).toEqual({ "std:nav": { TS1: "fix" } });
  });
});
