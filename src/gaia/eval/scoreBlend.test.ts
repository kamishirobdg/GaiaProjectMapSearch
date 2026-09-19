// src/gaia/eval/scoreBlend.test.ts
//
// Map と Setup の合算比（2026-09-19）。純粋な部分だけ（localStorage は使わない）。

import { describe, it, expect } from "vitest";
import {
  DEFAULT_SCORE_BLEND,
  blendScores,
  clampBlendValue,
  formatScoreBlend,
  isDefaultScoreBlend,
  sanitizeScoreBlend,
  serializeScoreBlend,
} from "./scoreBlend";

describe("scoreBlend（Map と Setup の合算比）", () => {
  it("既定は 1:1 で、省略時の合算は単純な足し算", () => {
    expect(DEFAULT_SCORE_BLEND).toEqual({ map: 1, setup: 1 });
    expect(blendScores(90, 10)).toBe(100);
    expect(blendScores(90, 10, { map: 1, setup: 1 })).toBe(100);
    expect(isDefaultScoreBlend({ map: 1, setup: 1 })).toBe(true);
    expect(isDefaultScoreBlend({ map: 1, setup: 1.5 })).toBe(false);
  });

  it("倍率は Map・Setup それぞれに掛かる", () => {
    expect(blendScores(90, 10, { map: 0.5, setup: 2 })).toBe(65);
    expect(blendScores(90, 10, { map: 0, setup: 1 })).toBe(10);
    expect(formatScoreBlend({ map: 1, setup: 1.5 })).toBe("1 : 1.5");
  });

  it("保存は既定と違うフィールドだけ（全部既定なら null＝キー削除）", () => {
    expect(serializeScoreBlend({ map: 1, setup: 1 })).toBeNull();
    expect(serializeScoreBlend({ map: 1, setup: 1.5 })).toBe('{"setup":1.5}');
    expect(serializeScoreBlend({ map: 2, setup: 1 })).toBe('{"map":2}');
    expect(serializeScoreBlend({ map: 2, setup: 0.5 })).toBe('{"map":2,"setup":0.5}');
  });

  it("読み戻しは欠けたフィールドを既定で埋め、範囲外・非数は直す", () => {
    expect(sanitizeScoreBlend({ setup: 1.5 })).toEqual({ map: 1, setup: 1.5 });
    expect(sanitizeScoreBlend({})).toEqual({ map: 1, setup: 1 });
    expect(sanitizeScoreBlend(null)).toEqual({ map: 1, setup: 1 });
    expect(sanitizeScoreBlend("x")).toEqual({ map: 1, setup: 1 });
    expect(sanitizeScoreBlend({ map: "abc", setup: 99 })).toEqual({ map: 1, setup: 5 });
    expect(sanitizeScoreBlend({ map: -3 })).toEqual({ map: 0, setup: 1 });
  });

  it("number 入力の丸め誤差は小数2桁で切る", () => {
    expect(clampBlendValue(1.2000000000000002, 1)).toBe(1.2);
    expect(clampBlendValue(Number.NaN, 1)).toBe(1);
    expect(clampBlendValue(7, 1)).toBe(5);
  });
});
