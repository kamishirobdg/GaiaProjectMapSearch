// src/gaia/eval/setupWeights.test.ts
//
// 評価指数（カテゴリ別係数）のテスト。値そのものは DRAFT なので、
// ここで固定するのは機構だけ:
//   - 既定値では導入前と同じスコアになる（回帰防止）
//   - 内訳の合計が総合と一致する
//   - 係数がそのカテゴリだけに線形に効く
//   - 保存形式は「既定と異なるキーだけ」（全部既定ならキーごと消す）

import { describe, expect, it } from "vitest";
import { RESEARCH_TRACK_IDS, type ResearchTrackId, type SetupResult } from "@/gaia/setup/types";
import { scoreSetupFactions, setupFactionBreakdown, setupFactionTileHits } from "./factionEval";
import {
  ADV_EXTENSION_SCALE,
  ADVANCED_TECH_SCALE,
  DEFAULT_SETUP_WEIGHTS,
  SETUP_SCORE_DIVISOR,
  LF_ONLY_WEIGHT_KEYS,
  ROUND_SCORING_SCALE,
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
import {
  FACTION_IDS,
  LF_FACTION_IDS,
  STD_TECH_SCALE,
  type FactionId,
} from "./factionWeights";
import {
  ADVANCED_TECH_WEIGHTS_BASE,
  ADVANCED_TECH_WEIGHTS_LF,
  advancedTechCell,
  advancedTechExtensionCell,
} from "./advancedTechWeights";
import {
  ROUND_SCORING_WEIGHTS_BASE,
  ROUND_SCORING_WEIGHTS_LF,
  roundScoringCell,
} from "./roundScoringWeights";

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
  it("既定は基準どおり（技術は重く、ラウンド得点と上級技術は軽い）", () => {
    // 2026-08-01: カテゴリの「1枚あたりの効き具合」を係数で表すことにしたので、
    // 既定値が一律ではなくなった。2026-08-04 時点で基準から外れるのは4つ。
    expect(DEFAULT_SETUP_WEIGHTS.standardTech).toBe(STD_TECH_SCALE);
    expect(DEFAULT_SETUP_WEIGHTS.roundScoring).toBe(ROUND_SCORING_SCALE);
    expect(DEFAULT_SETUP_WEIGHTS.advanced).toBe(ADVANCED_TECH_SCALE);
    expect(DEFAULT_SETUP_WEIGHTS.advExtension).toBe(ADV_EXTENSION_SCALE);
    // 追加上級は通常の上級の 1/3（拡張部の1枚を3〜4人で奪い合うため。2026-08-04）。
    expect(ADVANCED_TECH_SCALE).toBe(ADV_EXTENSION_SCALE * 3);
    // VP 換算では係数は桁合わせの道具なので、「技術の係数は基準より大きい」と
    // いった大小関係はもう固定しない（値の幅が影響力を決める）。
    expect(ROUND_SCORING_SCALE).toBeLessThan(SETUP_WEIGHT_BASE);
    expect(ADVANCED_TECH_SCALE).toBeLessThan(SETUP_WEIGHT_BASE);
    for (const k of ["booster", "finalScoring", "federation", "lfShip"] as const) {
      expect(DEFAULT_SETUP_WEIGHTS[k]).toBe(SETUP_WEIGHT_BASE);
    }
    expect(isDefaultWeights(DEFAULT_SETUP_WEIGHTS)).toBe(true);
  });

  // 2026-08-04: 最終スケール（SETUP_SCORE_DIVISOR）で 100前後へ落とすようになり、
  // **評価値に小数が出るのが正常**になった（整数へ丸めると、1枚しか出ない
  // カテゴリで種族差が消えてしまう）。代わりに「割る前は整数」を固定する。
  it("最終スケールを戻すと整数になる（表の値も係数も整数なので）", () => {
    const b = setupFactionBreakdown(syntheticSetup({ mode: "lostFleet" }), DEFAULT_SETUP_WEIGHTS);
    for (const f of FACTION_IDS) {
      for (const k of SETUP_WEIGHT_KEYS) {
        const raw = b.byCategory[k][f] * SETUP_SCORE_DIVISOR;
        // 浮動小数の誤差ぶんだけ緩める（1e-6 は 1/40 の丸め誤差より十分小さい）。
        expect(Math.abs(raw - Math.round(raw))).toBeLessThan(1e-6);
      }
    }
  });

  it("表示順は全カテゴリを過不足なく並べたもの", () => {
    expect([...SETUP_WEIGHT_DISPLAY_ORDER].sort()).toEqual([...SETUP_WEIGHT_KEYS].sort());
    // 影響力の大きい順（横スクロールで最初に隠れるのが影響の小さい列になるように）。
    // 順番はユーザーの実プレイ感による（2026-07-31 更新）。
    expect(SETUP_WEIGHT_DISPLAY_ORDER[0]).toBe("standardTech");
    expect(SETUP_WEIGHT_DISPLAY_ORDER.slice(-2)).toEqual(["advExtension", "federation"]);
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

  it("係数はそのカテゴリだけに効き、他のカテゴリは動かない", () => {
    const s = syntheticSetup();
    const base = setupFactionBreakdown(s, DEFAULT_SETUP_WEIGHTS);
    const doubled = setupFactionBreakdown(s, withWeight("roundScoring", ROUND_SCORING_SCALE * 2));
    for (const f of FACTION_IDS) {
      // ラウンド得点だけはタイル1枚ごとに整数へ丸めるので、係数2倍でもぴったり
      // 2倍にはならない（ズレは1タイルあたり最大0.5、6タイルで±3）。
      expect(doubled.byCategory.roundScoring[f]).toBeCloseTo(
        base.byCategory.roundScoring[f] * 2,
        -0.5
      );
      for (const k of SETUP_WEIGHT_KEYS) {
        if (k === "roundScoring") continue;
        expect(doubled.byCategory[k][f]).toBeCloseTo(base.byCategory[k][f], 10);
      }
    }
    // RS07 は一定曲線（倍率10＝素通し）なので、firaks のぶんは丸め誤差なく2倍になる。
    const only07 = syntheticSetup({ roundScoring: ["RS07", "RS07"] });
    const a = setupFactionBreakdown(only07, DEFAULT_SETUP_WEIGHTS);
    const b = setupFactionBreakdown(only07, withWeight("roundScoring", ROUND_SCORING_SCALE * 2));
    expect(b.byCategory.roundScoring.firaks).toBe(a.byCategory.roundScoring.firaks * 2);
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
    // 期待値は表から組み立てる（値のレビューで動くのでベタ書きしない）。拡張部は
    // 研究列に紐付かないので6列の最大値（advancedTechExtensionCell）。
    const want = advancedTechExtensionCell("AT02", true)?.firaks ?? 0;
    expect(want).toBeGreaterThan(0);
    // 追加上級の係数だけが効き、通常の上級は動かない。
    expect(base.byCategory.advExtension.firaks).toBeCloseTo(
      (want * DEFAULT_SETUP_WEIGHTS.advExtension) / SETUP_SCORE_DIVISOR,
      6
    );
    expect(scaled.byCategory.advExtension.firaks).toBeCloseTo(
      (want * SETUP_WEIGHT_BASE * 2) / SETUP_SCORE_DIVISOR,
      6
    );
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

// ラウンド得点は「タイル×ラウンド×種族」の表で持つ（2026-08-02。曲線
// ROUND_SCORING_TIMING は廃止した）。表がラウンドごとの値を直に持つので、ここでは
// **表の構造と、表の値がそのまま評価へ出ること**だけを固定する。
// 「序盤向きは早いラウンドほど高い」といった中身の性質は固定しない —— 投入時の雛形は
// 全ラウンド同値（案1）で、これからユーザーが値を入れて変えていくため。
describe("ラウンド得点の表（タイル×ラウンド×種族）", () => {
  /** 指定タイルだけを6ラウンドに並べたセットアップ（他カテゴリは同じ）。 */
  const withRounds = (ids: string[]) => syntheticSetup({ roundScoring: ids });

  const BASE_IDS = ["RS01", "RS02", "RS03", "RS04", "RS05", "RS06", "RS07", "RS08", "RS09"];
  const LF_IDS = [...BASE_IDS, "RS10", "RS11", "RS12"];

  it("通常版9タイル・拡張版12タイルが、それぞれ6ラウンドぶんを持つ", () => {
    for (const [name, table, ids] of [
      ["BASE", ROUND_SCORING_WEIGHTS_BASE, BASE_IDS],
      ["LF", ROUND_SCORING_WEIGHTS_LF, LF_IDS],
    ] as const) {
      expect(`${name}:${Object.keys(table).sort().join(",")}`).toBe(`${name}:${ids.join(",")}`);
      for (const [id, rounds] of Object.entries(table)) {
        expect(`${name}/${id}:${rounds.length}`).toBe(`${name}/${id}:6`);
      }
    }
  });

  it("通常版の表に LF4種族は入れない（基本版では選べない）", () => {
    for (const [id, rounds] of Object.entries(ROUND_SCORING_WEIGHTS_BASE)) {
      rounds.forEach((cells, i) => {
        for (const f of Object.keys(cells)) {
          expect(`${id}/R${i + 1}/${f}:${LF_FACTION_IDS.has(f as FactionId)}`).toBe(
            `${id}/R${i + 1}/${f}:false`
          );
        }
      });
    }
  });

  it("表の値がそのまま評価へ出る（係数を掛けるだけ・丸めなし）", () => {
    const b = setupFactionBreakdown(withRounds(Array(6).fill("RS01")));
    const w = DEFAULT_SETUP_WEIGHTS.roundScoring;
    for (const f of FACTION_IDS) {
      const want =
        ([0, 1, 2, 3, 4, 5].reduce((a, i) => a + (roundScoringCell("RS01", i, false)?.[f] ?? 0), 0) *
          w) /
        SETUP_SCORE_DIVISOR;
      expect(b.byCategory.roundScoring[f]).toBeCloseTo(want, 6);
    }
  });

  it("表に無いタイルは寄与しない（RS10-12 は拡張版だけ）", () => {
    expect(roundScoringCell("RS10", 0, false)).toBeUndefined();
    expect(roundScoringCell("RS10", 0, true)).toBeDefined();
    // ラウンドが範囲外でも落ちない
    expect(roundScoringCell("RS01", 6, true)).toBeUndefined();
  });

  it("最終スケールを戻すと整数になる（曲線の割り算はもう無い）", () => {
    const b = setupFactionBreakdown(withRounds(["RS01", "RS08", "RS07", "RS04", "RS09", "RS02"]));
    for (const f of FACTION_IDS) {
      const raw = b.byCategory.roundScoring[f] * SETUP_SCORE_DIVISOR;
      expect(Math.abs(raw - Math.round(raw))).toBeLessThan(1e-6);
    }
  });
});

// 上級技術は「タイル×研究列×種族」の表で持つ（2026-08-03。値は VP 換算）。
// 標準技術と同じく、ここで固定するのは**表の構造と、値がそのまま評価へ出ること**
// だけ。「相性の良い列ほど高い」といった中身の性質は固定しない —— 投入時の雛形は
// 全列同値で、これからユーザーが列ごとの差を入れていくため。
describe("上級技術の表（タイル×研究列×種族）", () => {
  const BASE_IDS = [
    "AT01", "AT02", "AT03", "AT04", "AT05", "AT06", "AT07", "AT08",
    "AT09", "AT10", "AT11", "AT12", "AT13", "AT14", "AT15",
  ];
  const LF_ONLY = ["AT16", "AT17", "AT18", "AT19", "AT20", "AT21"];
  const TRACKS = RESEARCH_TRACK_IDS as readonly ResearchTrackId[];

  it("通常版15タイル・拡張版21タイルが、それぞれ6列ぶんを持つ", () => {
    expect(Object.keys(ADVANCED_TECH_WEIGHTS_BASE).sort().join(",")).toBe(BASE_IDS.join(","));
    expect(Object.keys(ADVANCED_TECH_WEIGHTS_LF).sort().join(",")).toBe(
      [...BASE_IDS, ...LF_ONLY].sort().join(",")
    );
    for (const [name, table] of [
      ["BASE", ADVANCED_TECH_WEIGHTS_BASE],
      ["LF", ADVANCED_TECH_WEIGHTS_LF],
    ] as const) {
      for (const [id, tile] of Object.entries(table)) {
        const n = TRACKS.filter((t) => tile[t]).length;
        expect(`${name}/${id}:${n}`).toBe(`${name}/${id}:6`);
      }
    }
  });

  it("通常版の表に LF4種族と LF6枚は入れない", () => {
    for (const [id, tile] of Object.entries(ADVANCED_TECH_WEIGHTS_BASE)) {
      expect(LF_ONLY).not.toContain(id);
      for (const trk of TRACKS) {
        for (const f of Object.keys(tile[trk] ?? {})) {
          expect(`${id}/${trk}/${f}:${LF_FACTION_IDS.has(f as FactionId)}`).toBe(
            `${id}/${trk}/${f}:false`
          );
        }
      }
    }
  });

  it("拡張部は研究列6つの最大値（どの列を登っていても取りに行けるため）", () => {
    for (const id of Object.keys(ADVANCED_TECH_WEIGHTS_LF)) {
      const cell = advancedTechExtensionCell(id, true) ?? {};
      for (const f of FACTION_IDS) {
        const best = Math.max(0, ...TRACKS.map((t) => advancedTechCell(id, t, true)?.[f] ?? 0));
        expect(`${id}/${f}:${cell[f] ?? 0}`).toBe(`${id}/${f}:${best}`);
      }
    }
  });

  it("表の値がそのまま評価へ出る（係数を掛けるだけ）", () => {
    const byTrack: Array<[ResearchTrackId, string]> = [
      ["terra", "AT02"], ["nav", "AT03"], ["ai", "AT13"],
      ["gaia", "AT06"], ["eco", "AT07"], ["sci", "AT09"],
    ];
    const s = syntheticSetup({
      advancedTech: { byTrack: Object.fromEntries(byTrack) as Record<ResearchTrackId, string> },
    });
    const b = setupFactionBreakdown(s);
    const w = DEFAULT_SETUP_WEIGHTS.advanced;
    for (const f of FACTION_IDS) {
      const want =
        (byTrack.reduce((a, [t, id]) => a + (advancedTechCell(id, t, false)?.[f] ?? 0), 0) * w) /
        SETUP_SCORE_DIVISOR;
      expect(b.byCategory.advanced[f]).toBeCloseTo(want, 6);
    }
  });

  it("通常版では LF6枚は寄与しない", () => {
    expect(advancedTechCell("AT16", "terra", false)).toBeUndefined();
    expect(advancedTechCell("AT16", "terra", true)).toBeDefined();
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
