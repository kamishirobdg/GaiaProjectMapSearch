// src/gaia/eval/setupWeights.test.ts
//
// 評価指数（カテゴリ別係数）のテスト。値そのものは DRAFT なので、
// ここで固定するのは機構だけ:
//   - 既定値では導入前と同じスコアになる（回帰防止）
//   - 内訳の合計が総合と一致する
//   - 係数がそのカテゴリだけに線形に効く
//   - 保存形式は「既定と異なるキーだけ」（全部既定ならキーごと消す）

import { describe, expect, it } from "vitest";
import type { SetupResult } from "@/gaia/setup/types";
import { scoreSetupFactions, setupFactionBreakdown } from "./factionEval";
import {
  DEFAULT_SETUP_WEIGHTS,
  SETUP_WEIGHT_KEYS,
  isDefaultWeights,
  sanitizeSetupWeights,
  serializeSetupWeights,
  type SetupWeights,
} from "./setupWeights";
import { FACTION_IDS, STD_TECH_FREE_SCALE, STD_TECH_TRACK_SCALE } from "./factionWeights";

function syntheticSetup(partial?: Partial<SetupResult>): SetupResult {
  return {
    seed: "t",
    playerCount: 4,
    standardTech: {
      byTrack: { terra: "TS1", nav: "TS2", ai: "TS3", gaia: "TS4", eco: "TS5", sci: "TS6" },
      free: ["TS7", "TS8", "TS9"],
    },
    advancedTech: {
      byTrack: { terra: "AT02", nav: "AT03", ai: "AT13", gaia: "AT06", eco: "AT07", sci: "AT09" },
    },
    boosters: { available: ["RB01", "RB02"], unused: [] },
    roundScoring: ["RS07", "RS07", "RS01", "RS02", "RS03", "RS04"],
    finalScoring: ["FS02", "FS06"],
    federationLv5: "FED12",
    planetSatellites: ["BLACK", "BLUE", "BROWN", "ORANGE", "RED", "WHITE", "YELLOW"],
    ...partial,
  };
}

function withWeight(k: keyof SetupWeights, v: number): SetupWeights {
  return { ...DEFAULT_SETUP_WEIGHTS, [k]: v };
}

describe("DEFAULT_SETUP_WEIGHTS", () => {
  it("既定は導入前の計算と同値（標準技術の2定数がそのまま入る）", () => {
    expect(DEFAULT_SETUP_WEIGHTS.stdTrack).toBe(STD_TECH_TRACK_SCALE);
    expect(DEFAULT_SETUP_WEIGHTS.stdFree).toBe(STD_TECH_FREE_SCALE);
    for (const k of ["advanced", "booster", "roundScoring", "finalScoring", "federation", "lfShip"] as const) {
      expect(DEFAULT_SETUP_WEIGHTS[k]).toBe(1);
    }
    expect(isDefaultWeights(DEFAULT_SETUP_WEIGHTS)).toBe(true);
  });

  it("既定を明示で渡しても省略時と同じスコアになる", () => {
    const s = syntheticSetup();
    const omitted = scoreSetupFactions(s);
    const explicit = scoreSetupFactions(s, DEFAULT_SETUP_WEIGHTS);
    for (const f of FACTION_IDS) expect(explicit[f]).toBe(omitted[f]);
  });
});

describe("setupFactionBreakdown", () => {
  it("内訳の合計は総合と一致する", () => {
    const s = syntheticSetup();
    const w = withWeight("roundScoring", 2);
    const { byCategory, total } = setupFactionBreakdown(s, w);
    for (const f of FACTION_IDS) {
      const sum = SETUP_WEIGHT_KEYS.reduce((a, k) => a + byCategory[k][f], 0);
      expect(sum).toBeCloseTo(total[f], 10);
    }
  });

  it("係数はそのカテゴリだけに線形に効く", () => {
    const s = syntheticSetup();
    const base = setupFactionBreakdown(s, DEFAULT_SETUP_WEIGHTS);
    const doubled = setupFactionBreakdown(s, withWeight("roundScoring", 2));
    for (const f of FACTION_IDS) {
      expect(doubled.byCategory.roundScoring[f]).toBeCloseTo(base.byCategory.roundScoring[f] * 2, 10);
      // 他のカテゴリは動かない
      for (const k of SETUP_WEIGHT_KEYS) {
        if (k === "roundScoring") continue;
        expect(doubled.byCategory[k][f]).toBeCloseTo(base.byCategory[k][f], 10);
      }
    }
    // firaks は RS07（+2）が2枚で +4 効いているので、係数2で総合が +4 されるはず
    expect(doubled.total.firaks).toBeCloseTo(base.total.firaks + 4, 10);
  });

  it("係数0でそのカテゴリの寄与が消える", () => {
    const s = syntheticSetup();
    const zeroed = setupFactionBreakdown(s, withWeight("advanced", 0));
    // 負値×0 は -0 になるので Object.is ではなく数値比較で見る（表示は String(-0)="0"）。
    for (const f of FACTION_IDS) expect(zeroed.byCategory.advanced[f] === 0).toBe(true);
  });

  it("基本版では LF 船カテゴリが常に0（LFのみ加算される）", () => {
    const base = setupFactionBreakdown(syntheticSetup(), withWeight("lfShip", 3));
    for (const f of FACTION_IDS) expect(base.byCategory.lfShip[f]).toBe(0);
  });
});

describe("sanitizeSetupWeights", () => {
  it("欠けたキー・非数値は既定へ、範囲外はクランプ", () => {
    const w = sanitizeSetupWeights({ advanced: 2, booster: "x", roundScoring: 99, finalScoring: -99 });
    expect(w.advanced).toBe(2);
    expect(w.booster).toBe(DEFAULT_SETUP_WEIGHTS.booster);
    expect(w.roundScoring).toBe(9);
    expect(w.finalScoring).toBe(-9);
    expect(w.stdTrack).toBe(DEFAULT_SETUP_WEIGHTS.stdTrack);
  });

  it("null/undefined でも既定一式になる", () => {
    expect(sanitizeSetupWeights(null)).toEqual(DEFAULT_SETUP_WEIGHTS);
    expect(sanitizeSetupWeights(undefined)).toEqual(DEFAULT_SETUP_WEIGHTS);
  });
});

describe("serializeSetupWeights", () => {
  it("全部既定なら null（＝localStorage のキーを消す）", () => {
    expect(serializeSetupWeights(DEFAULT_SETUP_WEIGHTS)).toBeNull();
  });

  it("既定と異なるキーだけを書く（互換の鉄則と同じ省略構築）", () => {
    const s = serializeSetupWeights(withWeight("booster", 1.5));
    expect(s).not.toBeNull();
    expect(JSON.parse(s!)).toEqual({ booster: 1.5 });
  });

  it("書いた内容を読み戻すと元へ戻る", () => {
    const w = { ...DEFAULT_SETUP_WEIGHTS, advanced: 2, stdFree: 0 };
    expect(sanitizeSetupWeights(JSON.parse(serializeSetupWeights(w)!))).toEqual(w);
  });
});
