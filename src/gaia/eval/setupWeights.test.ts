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
import { scoreSetupFactions, setupFactionBreakdown, setupFactionTileHits } from "./factionEval";
import {
  DEFAULT_SETUP_WEIGHTS,
  LF_ONLY_WEIGHT_KEYS,
  SETUP_WEIGHT_BASE,
  SETUP_WEIGHT_DISPLAY_ORDER,
  SETUP_WEIGHT_KEYS,
  SETUP_WEIGHT_MAX,
  SETUP_WEIGHT_MIN,
  isDefaultWeights,
  sanitizeSetupWeights,
  serializeSetupWeights,
  type SetupWeights,
} from "./setupWeights";
import { FACTION_IDS, STD_TECH_SCALE } from "./factionWeights";

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
  it("既定は基準どおり（標準技術だけ専用の係数が入る）", () => {
    expect(DEFAULT_SETUP_WEIGHTS.standardTech).toBe(STD_TECH_SCALE);
    for (const k of [
      "advanced",
      "advExtension",
      "booster",
      "roundScoring",
      "finalScoring",
      "federation",
      "lfShip",
    ] as const) {
      expect(DEFAULT_SETUP_WEIGHTS[k]).toBe(SETUP_WEIGHT_BASE);
    }
    expect(isDefaultWeights(DEFAULT_SETUP_WEIGHTS)).toBe(true);
  });

  // 評価値から小数を消すのが基準100の目的（2026-07-31）。タイルの重みは整数なので、
  // 係数が 100 / 50 / 25 なら内訳も総合も必ず整数になる。
  it("既定の係数では評価値に小数が出ない", () => {
    const b = setupFactionBreakdown(syntheticSetup({ mode: "lostFleet" }), DEFAULT_SETUP_WEIGHTS);
    for (const f of FACTION_IDS) {
      expect(Number.isInteger(b.total[f])).toBe(true);
      for (const k of SETUP_WEIGHT_KEYS) expect(Number.isInteger(b.byCategory[k][f])).toBe(true);
    }
  });

  it("表示順は全カテゴリを過不足なく並べたもの", () => {
    expect([...SETUP_WEIGHT_DISPLAY_ORDER].sort()).toEqual([...SETUP_WEIGHT_KEYS].sort());
    // 影響の小さい2列は右端（横スクロールで最初に隠れる位置）。2026-07-30 要望。
    expect(SETUP_WEIGHT_DISPLAY_ORDER.slice(-2)).toEqual(["roundScoring", "booster"]);
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
    const doubled = setupFactionBreakdown(s, withWeight("roundScoring", SETUP_WEIGHT_BASE * 2));
    for (const f of FACTION_IDS) {
      expect(doubled.byCategory.roundScoring[f]).toBeCloseTo(base.byCategory.roundScoring[f] * 2, 10);
      // 他のカテゴリは動かない
      for (const k of SETUP_WEIGHT_KEYS) {
        if (k === "roundScoring") continue;
        expect(doubled.byCategory[k][f]).toBeCloseTo(base.byCategory[k][f], 10);
      }
    }
    // firaks は RS07（+2）が2枚で +4 効いているので、係数2倍で総合が +4×基準 されるはず
    expect(doubled.total.firaks).toBeCloseTo(base.total.firaks + 4 * SETUP_WEIGHT_BASE, 10);
  });

  it("係数0でそのカテゴリの寄与が消える", () => {
    const s = syntheticSetup();
    const zeroed = setupFactionBreakdown(s, withWeight("advanced", 0));
    // 負値×0 は -0 になるので Object.is ではなく数値比較で見る（表示は String(-0)="0"）。
    for (const f of FACTION_IDS) expect(zeroed.byCategory.advanced[f] === 0).toBe(true);
  });

  it("基本版では LF 専用カテゴリが常に0（LFのみ加算される）", () => {
    const base = setupFactionBreakdown(syntheticSetup(), {
      ...DEFAULT_SETUP_WEIGHTS,
      lfShip: 3,
      advExtension: 3,
    });
    for (const k of LF_ONLY_WEIGHT_KEYS) {
      for (const f of FACTION_IDS) expect(base.byCategory[k][f]).toBe(0);
    }
  });

  it("追加上級（拡張部）は通常の上級とは別カテゴリに入る", () => {
    // 拡張部の追加上級 AT02 を持つ LF セットアップ。通常の上級には AT02 を置かない。
    const s = syntheticSetup({
      mode: "lostFleet",
      advancedTech: {
        byTrack: { terra: "AT03", nav: "AT06", ai: "AT07", gaia: "AT09", eco: "AT10", sci: "AT11" },
        extension: "AT02",
      },
    });
    const base = setupFactionBreakdown(s, DEFAULT_SETUP_WEIGHTS);
    const scaled = setupFactionBreakdown(s, withWeight("advExtension", SETUP_WEIGHT_BASE * 2));
    // firaks は AT02 で +2。追加上級の係数だけが効き、通常の上級は動かない。
    expect(base.byCategory.advExtension.firaks).toBe(2 * SETUP_WEIGHT_BASE);
    expect(scaled.byCategory.advExtension.firaks).toBe(4 * SETUP_WEIGHT_BASE);
    expect(scaled.byCategory.advanced.firaks).toBe(base.byCategory.advanced.firaks);
  });
});

describe("sanitizeSetupWeights", () => {
  it("欠けたキー・非数値は既定へ、範囲外はクランプ", () => {
    const w = sanitizeSetupWeights({ advanced: 20, booster: "x", roundScoring: 9999, finalScoring: -9999 });
    expect(w.advanced).toBe(20);
    expect(w.booster).toBe(DEFAULT_SETUP_WEIGHTS.booster);
    expect(w.roundScoring).toBe(SETUP_WEIGHT_MAX);
    expect(w.finalScoring).toBe(SETUP_WEIGHT_MIN);
    expect(w.standardTech).toBe(DEFAULT_SETUP_WEIGHTS.standardTech);
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
    const w = { ...DEFAULT_SETUP_WEIGHTS, advanced: 2, standardTech: 0 };
    expect(sanitizeSetupWeights(JSON.parse(serializeSetupWeights(w)!))).toEqual(w);
  });
});

// ラウンド得点の「何ラウンド目か」（2026-07-31 要望）。序盤向きのタイルは早い
// ラウンドほど、終盤向きのタイルは遅いラウンドほど高く評価する。
describe("ラウンド得点の並び順", () => {
  /** 指定タイルだけを6ラウンドに並べたセットアップ（他カテゴリは同じ）。 */
  const withRounds = (ids: string[]) => syntheticSetup({ roundScoring: ids });

  it("序盤向き（RS01 鉱山建設）は早いラウンドほど高い", () => {
    const early = setupFactionBreakdown(withRounds(["RS01", "TS4x", "TS4x", "TS4x", "TS4x", "TS4x"]));
    const late = setupFactionBreakdown(withRounds(["TS4x", "TS4x", "TS4x", "TS4x", "TS4x", "RS01"]));
    // RS01 は lantids/xenos/geodens に +1
    expect(early.byCategory.roundScoring.lantids).toBeGreaterThan(
      late.byCategory.roundScoring.lantids
    );
  });

  it("終盤向き（RS08 同盟タイル獲得）は遅いラウンドほど高い", () => {
    const early = setupFactionBreakdown(withRounds(["RS08", "TS4x", "TS4x", "TS4x", "TS4x", "TS4x"]));
    const late = setupFactionBreakdown(withRounds(["TS4x", "TS4x", "TS4x", "TS4x", "TS4x", "RS08"]));
    // RS08 は ivits に +2
    expect(late.byCategory.roundScoring.ivits).toBeGreaterThan(
      early.byCategory.roundScoring.ivits
    );
  });

  it("一定（RS07 研究1レベル）はどのラウンドでも同じ", () => {
    const a = setupFactionBreakdown(withRounds(["RS07", "TS4x", "TS4x", "TS4x", "TS4x", "TS4x"]));
    const b = setupFactionBreakdown(withRounds(["TS4x", "TS4x", "TS4x", "TS4x", "TS4x", "RS07"]));
    expect(a.byCategory.roundScoring.firaks).toBe(b.byCategory.roundScoring.firaks);
  });

  it("6ラウンド全部に同じタイルが出れば倍率の合計は素通しと同じ", () => {
    // どの曲線も6ラウンドの合計が60（＝平均10）になるよう作ってある。
    const early = setupFactionBreakdown(withRounds(Array(6).fill("RS01"))); // 序盤曲線
    const flat = setupFactionBreakdown(withRounds(Array(6).fill("RS07"))); // 一定
    // lantids は RS01・RS07 とも +1。曲線が違っても6ラウンド合計は同じになる。
    expect(early.byCategory.roundScoring.lantids).toBe(flat.byCategory.roundScoring.lantids);
  });

  it("評価値に小数を出さない（倍率は10分率で最後にまとめて割る）", () => {
    const b = setupFactionBreakdown(withRounds(["RS01", "RS08", "RS07", "RS04", "RS09", "RS02"]));
    for (const f of FACTION_IDS) {
      expect(Number.isInteger(b.byCategory.roundScoring[f])).toBe(true);
      expect(Number.isInteger(b.total[f])).toBe(true);
    }
  });
});

describe("setupFactionTileHits（マーカー用のタイル単位の寄与）", () => {
  it("タイル単位の合計が内訳表の合計と一致する", () => {
    const s = syntheticSetup();
    for (const w of [DEFAULT_SETUP_WEIGHTS, withWeight("roundScoring", 20), withWeight("standardTech", 10)]) {
      const total = scoreSetupFactions(s, w);
      const sum: Record<string, number> = {};
      for (const h of setupFactionTileHits(s, w)) {
        for (const [f, v] of Object.entries(h.byFaction)) sum[f] = (sum[f] ?? 0) + (v ?? 0);
      }
      for (const f of FACTION_IDS) expect(sum[f] ?? 0).toBeCloseTo(total[f], 9);
    }
  });

  it("カテゴリ別に足しても内訳表と一致する", () => {
    const s = syntheticSetup();
    const { byCategory } = setupFactionBreakdown(s, DEFAULT_SETUP_WEIGHTS);
    const hits = setupFactionTileHits(s, DEFAULT_SETUP_WEIGHTS);
    for (const k of SETUP_WEIGHT_KEYS) {
      const sum: Record<string, number> = {};
      for (const h of hits.filter((x) => x.category === k)) {
        for (const [f, v] of Object.entries(h.byFaction)) sum[f] = (sum[f] ?? 0) + (v ?? 0);
      }
      for (const f of FACTION_IDS) expect(sum[f] ?? 0).toBeCloseTo(byCategory[k][f], 9);
    }
  });

  it("寄与ゼロのタイルは出さない（光らせる対象にしない）", () => {
    for (const h of setupFactionTileHits(syntheticSetup())) {
      expect(Object.keys(h.byFaction).length).toBeGreaterThan(0);
      for (const v of Object.values(h.byFaction)) expect(v).not.toBe(0);
    }
  });
});
