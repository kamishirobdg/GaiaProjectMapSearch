// src/lib/setupShare.test.ts
//
// 共有トークンのエンコード/デコード（URL 復元）のテスト。
// setupShareUrl / copyText はブラウザ依存のため対象外。

import { describe, expect, it } from "vitest";
import type { BuildSetupInput } from "@/gaia/setup/buildSetup";
import { decodeSetupToken, encodeSetupToken } from "./setupShare";

describe("setup share token", () => {
  it("round-trips a full Lost Fleet input", () => {
    const input: BuildSetupInput = {
      seed: "2133305126",
      playerCount: 3,
      mode: "lostFleet",
      extensionFaceMode: "vp25",
      econFaceMode: "A",
      avoidRules: ["gaia-no-gaiaVp"],
      forceTileRules: { "eco-no-resourceAction": "AT13" },
      allowTileRules: { "terra-no-fedPass": "AT01" },
      shipDistanceAvoid: ["tfmars"],
      shipDistanceForce: ["eclipse"],
      rebellionGoldFed: "force",
    };
    const decoded = decodeSetupToken(encodeSetupToken(input));
    expect(decoded).toEqual(input);
  });

  it("round-trips a minimal base input (no optional fields reappear)", () => {
    const input: BuildSetupInput = { seed: "42", playerCount: 4 };
    expect(decodeSetupToken(encodeSetupToken(input))).toEqual(input);
  });

  it("token is URL-safe (no + / = characters)", () => {
    const tok = encodeSetupToken({ seed: "日本語シード>>?", playerCount: 2, mode: "lostFleet" });
    expect(tok).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it("rejects garbage and empty seeds", () => {
    expect(decodeSetupToken("not-a-token!!!")).toBeNull();
    expect(decodeSetupToken(encodeSetupToken({ seed: "" } as BuildSetupInput))).toBeNull();
  });

  it("drops unknown rule ids, out-of-set tiles and LF-only fields in base mode", () => {
    const dirty = {
      seed: "1",
      playerCount: 4,
      avoidRules: ["no-such-rule", "gaia-no-gaiaVp"],
      forceTileRules: { "eco-no-resourceAction": "AT99" },
      // base モードなので LF 専用フィールドは落ちる
      shipDistanceForce: ["eclipse"],
      rebellionGoldFed: "force",
    };
    const tok = encodeSetupToken(dirty as unknown as BuildSetupInput);
    expect(decodeSetupToken(tok)).toEqual({
      seed: "1",
      playerCount: 4,
      avoidRules: ["gaia-no-gaiaVp"],
    });
  });
});

describe("タイル指定の往復（2026-07-30）", () => {
  it("tileRules を落とさずに復元する", () => {
    const input = {
      seed: "42",
      playerCount: 4,
      tileRules: { "std:nav": { TS8: "fix" }, booster: { RB01: "fix", RB02: "exclude" } },
    } as any;
    const back = decodeSetupToken(encodeSetupToken(input));
    expect(back).toEqual(input);
  });

  it("知らないモードは捨てる（壊れたリンクで変な条件を作らない）", () => {
    const token = encodeSetupToken({
      seed: "42",
      playerCount: 4,
      tileRules: { "std:nav": { TS8: "fix", TS1: "bogus" } },
    } as any);
    expect((decodeSetupToken(token) as any).tileRules).toEqual({ "std:nav": { TS8: "fix" } });
  });

  it("空の指定はフィールドごと落ちる（キー不変の前提）", () => {
    const token = encodeSetupToken({ seed: "42", playerCount: 4, tileRules: {} } as any);
    expect("tileRules" in (decodeSetupToken(token) as any)).toBe(false);
  });
});
