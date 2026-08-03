// src/gaia/eval/factionEval.test.ts
//
// 種族別評価（セットアップ側・マップ側）と推奨基準のテスト。
// 重み値そのものは DRAFT なので、ここでは「合算・基準式・決定論」という
// 機構だけを固定する（重みレビューで数値が変わっても壊れない書き方）。

import { describe, expect, it } from "vitest";
import type { SetupResult } from "@/gaia/setup/types";
import {
  colorValueOf,
  criterionScore,
  recommendSetup,
  recommendSetups,
  scoreSetupFactions,
  scoreStandardTech,
  setupFactionBreakdown,
  topFactions,
  type FactionScores,
} from "./factionEval";
import {
  FACTION_IDS,
  factionIdsForMode,
  LF_FACTION_IDS,
  STD_TECH_SCALE,
  type FactionId,
} from "./factionWeights";
import {
  techPositionCell,
  techPositionTable,
} from "./techPositionWeights";
import { advancedTechCell } from "./advancedTechWeights";
import { tileValueCell } from "./tileWeights";
import type { ResearchTrackId } from "@/gaia/setup/types";
import {
  DEFAULT_SETUP_WEIGHTS,
  SETUP_SCORE_DIVISOR,
  SETUP_WEIGHT_BASE,
} from "./setupWeights";
import { countMapPlanets, mapFactionScoresFromCounts } from "./mapFaction";
import { makeSearchPlacementFromSeed } from "@/gaia/ssot/searchPlacementConfig";

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

describe("scoreSetupFactions", () => {
  it("sums draft weights over drawn tiles (round scoring counts copies)", () => {
    const s = syntheticSetup();
    const scores = scoreSetupFactions(s);
    // 期待値は**テーブルから組み立てる**。重みの値は見直しで動くので、
    // ベタ書きすると値を直すたびにテストが落ちる（2026-08-01 に書き換え）。
    const sumOf = (ids: readonly string[], f: FactionId) =>
      ids.reduce((a, id) => a + (tileValueCell(id, false)?.[f] ?? 0), 0);
    // 上級技術は「どの研究列の下に置かれたか」で値が変わるので、列ごとに引く
    // （2026-08-03。syntheticSetup の advancedTech.byTrack と同じ組み合わせ）。
    const advByTrack: Record<ResearchTrackId, string> = {
      terra: "AT02", nav: "AT03", ai: "AT13", gaia: "AT06", eco: "AT07", sci: "AT09",
    };
    const advPart = (f: FactionId) =>
      (Object.entries(advByTrack) as Array<[ResearchTrackId, string]>).reduce(
        (a, [track, id]) => a + (advancedTechCell(id, track, false)?.[f] ?? 0),
        0
      );

    // ブースター2枚＋最終2枚＋同盟1枚は素の合計×基準係数。上級技術だけは係数が
    // 別なので分けて掛ける（2026-08-03。VP 換算で桁が違うため）。
    // 最後に SETUP_SCORE_DIVISOR で割るのは全カテゴリ共通（2026-08-04）。
    const flatPart = (f: FactionId) =>
      (advPart(f) * DEFAULT_SETUP_WEIGHTS.advanced +
        (sumOf(["RB01", "RB02"], f) + sumOf(["FS02", "FS06"], f) + sumOf(["FED12"], f)) *
          SETUP_WEIGHT_BASE) /
      SETUP_SCORE_DIVISOR;
    for (const f of ["firaks", "ivits", "terrans"] as const) {
      const rounds = setupFactionBreakdown(s).byCategory.roundScoring[f];
      // 最終スケールの割り算で浮動小数の誤差が出るので toBeCloseTo で見る。
      expect(scores[f]).toBeCloseTo(flatPart(f) + rounds + scoreStandardTech(s)[f], 6);
    }

    // ×2 タイルは枚数分入る: RS07 が2枚あるぶんと1枚のぶんの差が1枚ぶんに等しい。
    const twice = setupFactionBreakdown(syntheticSetup({ roundScoring: ["RS07", "RS07"] }));
    const once = setupFactionBreakdown(syntheticSetup({ roundScoring: ["RS07"] }));
    expect(twice.byCategory.roundScoring.firaks).toBe(2 * once.byCategory.roundScoring.firaks);
    expect(once.byCategory.roundScoring.firaks).toBeGreaterThan(0);
  });

  it("standard tech: 同じ9枚でもトラック配置が変われば評価が変わる", () => {
    // TS7（ガイア惑星に鉱山＋3VP）が ガイア(terrans aff2) の下にある場合と、
    // terrans が登らない eco の下にある場合で terrans のスコアが変わる。
    const onGaia = syntheticSetup({
      standardTech: {
        byTrack: { terra: "TS1", nav: "TS2", ai: "TS3", gaia: "TS7", eco: "TS5", sci: "TS6" },
        free: ["TS4", "TS8", "TS9"],
      },
    });
    const onEco = syntheticSetup({
      standardTech: {
        byTrack: { terra: "TS1", nav: "TS2", ai: "TS3", gaia: "TS5", eco: "TS7", sci: "TS6" },
        free: ["TS4", "TS8", "TS9"],
      },
    });
    // 差は TS7/TS5 の入れ替えぶんだけ。期待値はテーブルから組み立てる
    // （値の見直しでベタ書きが壊れるのを避ける。2026-08-01）。
    const t = techPositionTable(false); // syntheticSetup は mode 省略＝通常版
    const cell = (id: string, pos: "gaia" | "eco") => t[id]?.[pos]?.terrans ?? 0;
    const diff =
      cell("TS7", "gaia") + cell("TS5", "eco") - (cell("TS5", "gaia") + cell("TS7", "eco"));
    expect(diff).toBeGreaterThan(0); // ガイア列に置く方が terrans に効く
    expect(scoreStandardTech(onGaia).terrans - scoreStandardTech(onEco).terrans).toBeCloseTo(
      (diff * STD_TECH_SCALE) / SETUP_SCORE_DIVISOR,
      6
    );
  });

  it("standard tech: フリー枠は研究列6つの最大値になる", () => {
    // ルールブック p13: フリー枠の3枚は「任意の研究エリア1つ」を進められるので、
    // どのトラック配置に対しても完全な上位互換。だから最大値を取る（2026-08-01）。
    for (const lf of [false, true]) {
      const table = techPositionTable(lf);
      for (const id of Object.keys(table)) {
        const free = techPositionCell(id, "free", lf) ?? {};
        for (const f of FACTION_IDS) {
          const tracks = (["terra", "nav", "ai", "gaia", "eco", "sci"] as const).map(
            (pos) => table[id]?.[pos]?.[f] ?? 0
          );
          expect(`${id}/${f}: ${free[f] ?? 0}`).toBe(`${id}/${f}: ${Math.max(0, ...tracks)}`);
        }
      }
    }
  });

  it("standard tech: 通常版と拡張版で別のテーブルを引く", () => {
    // LF4種族は通常版のテーブルに入っていない（通常版では選べないため）。
    for (const id of Object.keys(techPositionTable(false))) {
      for (const pos of ["terra", "nav", "ai", "gaia", "eco", "sci"] as const) {
        const cell = techPositionCell(id, pos, false) ?? {};
        for (const f of LF_FACTION_IDS) expect(cell[f] ?? 0).toBe(0);
      }
    }
    // 同じ盤面でも mode が変われば標準技術の評価が変わりうる
    const base = syntheticSetup();
    const lf = syntheticSetup({ mode: "lostFleet" });
    expect(scoreStandardTech(base)).not.toEqual(scoreStandardTech(lf));
  });

  it("returns a finite score for every faction", () => {
    const scores = scoreSetupFactions(syntheticSetup());
    for (const f of FACTION_IDS) expect(Number.isFinite(scores[f])).toBe(true);
    expect(Object.keys(scores)).toHaveLength(18); // 基本14 + LF4
  });
});

describe("criterionScore", () => {
  const flat = Object.fromEntries(FACTION_IDS.map((f) => [f, 1])) as FactionScores;
  const spiky = { ...flat, terrans: 9, gleens: 8, balTaks: 7 } as FactionScores;

  it("opposeMap: prefers setups where the map's top factions are weak", () => {
    const mapTop3 = ["terrans", "gleens", "balTaks"] as const;
    const a = criterionScore("opposeMap", flat, { playerCount: 4, mapTop3: [...mapTop3] });
    const b = criterionScore("opposeMap", spiky, { playerCount: 4, mapTop3: [...mapTop3] });
    expect(a).toBeGreaterThan(b);
  });

  it("alignMap: opposeMap と逆に、マップ上位K種族が強いセットアップを好む", () => {
    const mapTopK = ["terrans", "gleens", "balTaks", "ivits", "firaks"] as const;
    const opts = { playerCount: 3, mapTopK: [...mapTopK] };
    // spiky は上位K のうち3種族が高い → align では高評価、oppose では低評価
    const a = criterionScore("alignMap", spiky, opts);
    const b = criterionScore("alignMap", flat, opts);
    expect(a).toBeGreaterThan(b);
    // 同じ入力で opposeMap とは逆向きになること（順張り/逆張りの関係）
    const oppA = criterionScore("opposeMap", spiky, { playerCount: 3, mapTop3: [...mapTopK].slice(0, 3) });
    const oppB = criterionScore("opposeMap", flat, { playerCount: 3, mapTop3: [...mapTopK].slice(0, 3) });
    expect(oppA).toBeLessThan(oppB);
  });

  it("alignMap: K種族が均等に強い方が、1種族だけ突出より良い", () => {
    const mapTopK = ["terrans", "gleens", "balTaks"] as const;
    const opts = { playerCount: 1, mapTopK: [...mapTopK] };
    const even = { ...flat, terrans: 6, gleens: 6, balTaks: 6 } as FactionScores;
    const spike = { ...flat, terrans: 16, gleens: 1, balTaks: 1 } as FactionScores;
    expect(criterionScore("alignMap", even, opts)).toBeGreaterThan(criterionScore("alignMap", spike, opts));
  });

  it("alignMap: マップ上位が無ければ 0（マップ未選択でも壊れない）", () => {
    expect(criterionScore("alignMap", flat, { playerCount: 4 })).toBe(0);
  });

  it("neutralBalance: flat scores beat spiky scores", () => {
    const a = criterionScore("neutralBalance", flat, { playerCount: 4 });
    const b = criterionScore("neutralBalance", spiky, { playerCount: 4 });
    expect(a).toBeGreaterThan(b);
  });

  it("topBalance: a tight strong top group beats one runaway faction", () => {
    const tightTop = { ...flat, terrans: 5, gleens: 5, ivits: 5, firaks: 5, geodens: 5, lantids: 5 } as FactionScores;
    const runaway = { ...flat, terrans: 25 } as FactionScores;
    const a = criterionScore("topBalance", tightTop, { playerCount: 4 });
    const b = criterionScore("topBalance", runaway, { playerCount: 4 });
    expect(a).toBeGreaterThan(b);
  });
});

describe("recommendSetup", () => {
  const seeds = Array.from({ length: 30 }, (_, i) => `rec-${i}`);

  it("is deterministic for the same seed list and picks the argmax", () => {
    const a = recommendSetup({ criterion: "neutralBalance", seeds, playerCount: 4, lostFleet: false });
    const b = recommendSetup({ criterion: "neutralBalance", seeds, playerCount: 4, lostFleet: false });
    expect(a).not.toBeNull();
    expect(b?.input).toEqual(a?.input);
    // 全候補を再評価して argmax であることを確認
    for (const seed of seeds) {
      const r = recommendSetup({ criterion: "neutralBalance", seeds: [seed], playerCount: 4, lostFleet: false });
      expect(a!.score).toBeGreaterThanOrEqual(r!.score);
    }
  });

  it("recommendSetups returns topN in descending score, and recommendSetup is its head", () => {
    const top = recommendSetups({
      criterion: "neutralBalance",
      seeds,
      playerCount: 4,
      lostFleet: false,
      topN: 5,
    });
    expect(top).toHaveLength(5);
    for (let i = 1; i < top.length; i++) {
      expect(top[i - 1].score).toBeGreaterThanOrEqual(top[i].score);
    }
    // 候補は互いに異なるセットアップ（同一シードの重複が無い）
    expect(new Set(top.map((r) => r.input.seed)).size).toBe(5);
    const single = recommendSetup({ criterion: "neutralBalance", seeds, playerCount: 4, lostFleet: false });
    expect(single?.input).toEqual(top[0].input);
  });

  it("recommendSetups clamps topN to the seed count and handles topN<=0", () => {
    const few = recommendSetups({ criterion: "neutralBalance", seeds: seeds.slice(0, 2), playerCount: 4, lostFleet: false, topN: 5 });
    expect(few).toHaveLength(2);
    expect(recommendSetups({ criterion: "neutralBalance", seeds, playerCount: 4, lostFleet: false, topN: 0 })).toEqual([]);
  });

  it("returns null for an empty seed list", () => {
    expect(recommendSetup({ criterion: "neutralBalance", seeds: [], playerCount: 4, lostFleet: false })).toBeNull();
  });
});

describe("mapFaction", () => {
  it("counts planets from a real 3p LF placement", () => {
    const { placement } = makeSearchPlacementFromSeed({ templateId: "3p_lostFleet", seed: "1" }) as any;
    const counts = countMapPlanets("3p_lostFleet", placement);
    const colorTotal = Object.values(counts.byColor).reduce((a, b) => a + b, 0);
    expect(colorTotal).toBeGreaterThan(10);
    expect(counts.gaia).toBeGreaterThan(0);
    expect(counts.transdim).toBeGreaterThan(0);
    for (const k of Object.keys(counts.byColor)) {
      // LF4種族の母星（PROTO/ASTEROID）も母星色として数える（2026-07-30）
      expect(["BLACK", "BLUE", "BROWN", "ORANGE", "RED", "WHITE", "YELLOW", "PROTO", "ASTEROID"]).toContain(k);
    }
  });

  it("applies home color counts + gaia/transdim affinity (draft formula)", () => {
    const counts = { byColor: { BLUE: 4, RED: 5 }, gaia: 2, transdim: 4 };
    const scores = mapFactionScoresFromCounts(counts);
    // 2026-07-25 レビュー反映: ガイア惑星依存=グリーンのみ、
    // ガイアフォーマー(横断)依存= テラン(2) > イタル(1.5) > バルタック(1)。
    // terrans: BLUE4 + 0.5*(transdim 2 * 4) = 8（ガイア惑星依存なし）
    expect(scores.terrans).toBe(8);
    // lantids: BLUE4（親和なし）
    expect(scores.lantids).toBe(4);
    // gleens: 0.5*(gaia 2 * 2) = 2（ガイア惑星依存はグリーンのみ）
    expect(scores.gleens).toBe(2);
    // itars: 0.5*(transdim 1.5 * 4) = 3 / balTaks: 0.5*(transdim 1 * 4) = 2
    expect(scores.itars).toBe(3);
    expect(scores.balTaks).toBe(2);
    // hadschHallas/ivits: RED5（親和なし）
    expect(scores.hadschHallas).toBe(5);
    expect(scores.ivits).toBe(5);
    expect(topFactions(scores, 1)[0]).toBe("terrans");
  });
});

// 色優遇/冷遇（2026-07-31）。掛け先は「その母星色でいちばん強い種族のスコア」。
describe("色優遇/冷遇（Setup）", () => {
  const flat = () => Object.fromEntries(FACTION_IDS.map((f) => [f, 10])) as FactionScores;

  it("colorValueOf は色ごとにその色の最大スコアを返す", () => {
    const s = flat();
    s.terrans = 50; // BLUE
    s.lantids = 20; // BLUE
    s.xenos = 30; // YELLOW
    const v = colorValueOf(s, true);
    expect(v.BLUE).toBe(50); // 平均でも合計でもなく最大
    expect(v.YELLOW).toBe(30);
  });

  it("優遇した色が強いほど基準値が上がる／冷遇は逆", () => {
    const weak = flat();
    const strong = flat();
    strong.terrans = 40; // BLUE を強くする
    const opts = { playerCount: 4, lostFleet: true };
    const pref = { w: 1, byColor: { BLUE: 1 } };

    const dWithout =
      criterionScore("neutralBalance", strong, opts) - criterionScore("neutralBalance", weak, opts);
    const dWith =
      criterionScore("neutralBalance", strong, { ...opts, colorPref: pref }) -
      criterionScore("neutralBalance", weak, { ...opts, colorPref: pref });
    // BLUE の最大が 10 → 40 に上がったぶん（30）が w=1 で加算される
    expect(dWith - dWithout).toBeCloseTo(30, 9);

    const neg = { w: 1, byColor: { BLUE: -1 } };
    const dNeg =
      criterionScore("neutralBalance", strong, { ...opts, colorPref: neg }) -
      criterionScore("neutralBalance", weak, { ...opts, colorPref: neg });
    expect(dNeg - dWithout).toBeCloseTo(-30, 9);
  });

  it("指定なし・係数0では基準値が変わらない", () => {
    const s = flat();
    s.terrans = 40;
    const opts = { playerCount: 4, lostFleet: true };
    const bare = criterionScore("topBalance", s, opts);
    expect(criterionScore("topBalance", s, { ...opts, colorPref: { w: 0, byColor: { BLUE: 5 } } })).toBe(bare);
    expect(criterionScore("topBalance", s, { ...opts, colorPref: { w: 1, byColor: {} } })).toBe(bare);
  });

  it("基本版では LF4種族の色は掛け先を持たない", () => {
    const s = flat();
    s.moweyds = 99; // PROTO
    const opts = { playerCount: 4, lostFleet: false };
    const pref = { w: 1, byColor: { PROTO: 5 } };
    // 基本版では PROTO の種族が母集団に居ないので効かない
    expect(criterionScore("neutralBalance", s, { ...opts, colorPref: pref })).toBe(
      criterionScore("neutralBalance", s, opts)
    );
  });
});

// List の種族優遇（2026-07-31）。掛け先は「Map の評価値＋Setup の評価値」。
describe("種族優遇/冷遇（List）", () => {
  const flat = () => Object.fromEntries(FACTION_IDS.map((f) => [f, 10])) as FactionScores;
  const opts = { playerCount: 4, lostFleet: true };

  it("掛け先は Map ぶんと Setup ぶんの合計", () => {
    const s = flat();
    const mapVal = Object.fromEntries(FACTION_IDS.map((f) => [f, 0])) as FactionScores;
    mapVal.terrans = 90;
    const bare = criterionScore("neutralBalance", s, opts);
    // terrans: Map 90 + Setup 10 = 100 に w=1 × pref=1
    const withPref = criterionScore("neutralBalance", s, {
      ...opts,
      factionPref: { w: 1, byFaction: { terrans: 1 }, mapValueByFaction: mapVal },
    });
    expect(withPref - bare).toBeCloseTo(100, 9);
  });

  it("Map ぶんを渡さなければ Setup ぶんだけで効く", () => {
    const s = flat();
    const bare = criterionScore("neutralBalance", s, opts);
    const withPref = criterionScore("neutralBalance", s, {
      ...opts,
      factionPref: { w: 1, byFaction: { terrans: 2 } },
    });
    expect(withPref - bare).toBeCloseTo(20, 9); // 10 × 2
  });

  it("同じ母星色でも種族ごとに別々に効く", () => {
    const s = flat();
    s.terrans = 30; // BLUE
    s.lantids = 5; // BLUE
    const bare = criterionScore("neutralBalance", s, opts);
    const onTerrans = criterionScore("neutralBalance", s, {
      ...opts,
      factionPref: { w: 1, byFaction: { terrans: 1 } },
    });
    const onLantids = criterionScore("neutralBalance", s, {
      ...opts,
      factionPref: { w: 1, byFaction: { lantids: 1 } },
    });
    expect(onTerrans - bare).toBeCloseTo(30, 9);
    expect(onLantids - bare).toBeCloseTo(5, 9);
  });

  it("基本版では LF4種族の指定が効かない", () => {
    const s = flat();
    const bare = criterionScore("neutralBalance", s, { ...opts, lostFleet: false });
    const withPref = criterionScore("neutralBalance", s, {
      ...opts,
      lostFleet: false,
      factionPref: { w: 1, byFaction: { moweyds: 5 } },
    });
    expect(withPref).toBe(bare);
  });

  it("色優遇と種族優遇は併用できる", () => {
    const s = flat();
    const opt = {
      ...opts,
      colorPref: { w: 1, byColor: { BLUE: 1 } },
      factionPref: { w: 1, byFaction: { terrans: 1 } } as const,
    };
    const bare = criterionScore("neutralBalance", s, opts);
    // BLUE の最大10（色）＋ terrans 10（種族）
    expect(criterionScore("neutralBalance", s, opt) - bare).toBeCloseTo(20, 9);
  });
});

// Setup タブの一括探索（2026-07-31）。「いまの条件で」大量生成するのが要件なので、
// baseInput のタイル指定が探索結果の全件で守られていることを固定する。
describe("recommendSetups の baseInput", () => {
  const seeds = Array.from({ length: 60 }, (_, i) => String(2000 + i * 3));

  it("baseInput のタイル指定が上位の全件で守られる", () => {
    const rs = recommendSetups({
      criterion: "topBalance",
      seeds,
      playerCount: 4,
      lostFleet: false,
      topN: 10,
      baseInput: { playerCount: 4, tileRules: { "std:nav": { TS7: "fix" } } } as any,
    });
    expect(rs).toHaveLength(10);
    for (const r of rs) {
      expect(r.result.standardTech.byTrack.nav).toBe("TS7");
      expect((r.input as any).tileRules).toEqual({ "std:nav": { TS7: "fix" } });
    }
  });

  it("baseInput 省略時は従来どおり人数・拡張だけの素のセットアップ", () => {
    const rs = recommendSetups({
      criterion: "topBalance",
      seeds: seeds.slice(0, 5),
      playerCount: 3,
      lostFleet: true,
      topN: 5,
    });
    for (const r of rs) {
      expect(r.input).toEqual({ seed: r.input.seed, playerCount: 3, mode: "lostFleet" });
    }
  });

  it("チャンク分割して畳み込んでも全件一括と同じ上位になる（UIの分割実行と一致）", () => {
    const args = {
      criterion: "topBalance" as const,
      playerCount: 4,
      lostFleet: false,
      topN: 5,
    };
    const whole = recommendSetups({ ...args, seeds });
    const chunked: typeof whole = [];
    for (let i = 0; i < seeds.length; i += 25) {
      chunked.push(...recommendSetups({ ...args, seeds: seeds.slice(i, i + 25) }));
    }
    const merged = chunked.sort((a, b) => b.score - a.score).slice(0, 5);
    expect(merged.map((r) => r.input.seed)).toEqual(whole.map((r) => r.input.seed));
  });
});

// 基本版では Lost Fleet の4種族は選べないので、上位K種族にも散らばりにも入れない
// （2026-07-31 ユーザー確定）。重みテーブル自体は共通のまま、参照側で絞る。
describe("基本版では LF4種族を候補に入れない", () => {
  const LF: FactionId[] = ["moweyds", "spaceGiants", "tinkerroids", "darkanians"];

  it("factionIdsForMode: 基本版14 / LF18", () => {
    expect(factionIdsForMode(true)).toHaveLength(18);
    expect(factionIdsForMode(false)).toHaveLength(14);
    for (const f of LF) {
      expect(factionIdsForMode(true)).toContain(f);
      expect(factionIdsForMode(false)).not.toContain(f);
    }
  });

  it("topFactions: LF種族が最高スコアでも基本版では選ばれない", () => {
    const scores = Object.fromEntries(FACTION_IDS.map((f) => [f, 0])) as FactionScores;
    for (const f of LF) scores[f] = 100;
    scores.terrans = 1;

    expect(topFactions(scores, 1, true)[0]).toBe(LF[0]);
    expect(topFactions(scores, 1, false)[0]).toBe("terrans");
    expect(topFactions(scores, 4, false).some((f) => LF.includes(f))).toBe(false);
    // 既定は従来どおり全18種族
    expect(topFactions(scores, 1)[0]).toBe(LF[0]);
  });

  it("neutralBalance: 基本版の散らばりに LF種族のスコアが混ざらない", () => {
    const flat = Object.fromEntries(FACTION_IDS.map((f) => [f, 5])) as FactionScores;
    const skewed = { ...flat };
    for (const f of LF) skewed[f] = -50; // 基本14種族は完全に平坦のまま

    const opts = { playerCount: 4 };
    // 基本版から見れば14種族は平坦なので散らばり0＝満点。
    // 符号付きゼロ（-0）になりうるので Object.is ではなく数値比較で見る
    // （色優遇ぶんの 0 を足すと -0 が +0 になるため。2026-07-31）。
    expect(criterionScore("neutralBalance", skewed, { ...opts, lostFleet: false }) === 0).toBe(true);
    // LF から見ると LF4種族の外れ値で散らばりが出る
    expect(criterionScore("neutralBalance", skewed, { ...opts, lostFleet: true })).toBeLessThan(-1);
  });
});
