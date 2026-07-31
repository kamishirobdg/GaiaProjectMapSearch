// src/lib/setupHistory.test.ts
//
// 保存リストの純粋ロジック（id 構築・並び・剪定）のテスト。
// IndexedDB を伴う CRUD はブラウザでのみ動くためここでは対象外。

import { describe, expect, it } from "vitest";
import type { BuildSetupInput } from "@/gaia/setup/buildSetup";
import {
  overflowIds,
  setupConditionKey,
  setupConditionOf,
  setupHistoryId,
  sortSaved,
  type SavedSetup,
} from "./setupHistory";

function row(partial: Partial<SavedSetup> & { id: string }): SavedSetup {
  return {
    conditionKey: "k",
    seed: partial.id,
    input: { seed: partial.id },
    algoVersion: "setup_v1",
    pinned: false,
    used: false,
    createdAt: 0,
    updatedAt: 0,
    ...partial,
  } as SavedSetup;
}

describe("setupHistoryId", () => {
  it("同一入力は同一 id（キー順に依らない）", () => {
    const a: BuildSetupInput = { seed: "42", playerCount: 4, mode: "lostFleet" };
    const b: BuildSetupInput = { mode: "lostFleet", playerCount: 4, seed: "42" };
    expect(setupHistoryId(a)).toBe(setupHistoryId(b));
  });

  it("無効時フィールド省略の入力どうしを区別しない（省略＝キー不変の前提）", () => {
    // UI 側はスプレッド構築で off/empty を省略する。省略済み入力と
    // 明示フィールド付き入力は別 id になる（だからこそ UI 側の省略が鉄則）。
    const omitted: BuildSetupInput = { seed: "1", playerCount: 4 };
    const explicit: BuildSetupInput = { seed: "1", playerCount: 4, avoidRules: [] };
    expect(setupHistoryId(omitted)).not.toBe(setupHistoryId(explicit));
  });
});

describe("sortSaved", () => {
  it("ピン留め最優先→生成の新しい順", () => {
    const rows = [
      row({ id: "old", createdAt: 1 }),
      row({ id: "pinnedOld", createdAt: 2, pinned: true }),
      row({ id: "new", createdAt: 3 }),
      row({ id: "pinnedNew", createdAt: 4, pinned: true }),
    ];
    expect(sortSaved(rows).map((r) => r.id)).toEqual(["pinnedNew", "pinnedOld", "new", "old"]);
  });

  it("元配列を破壊しない", () => {
    const rows = [row({ id: "a", createdAt: 1 }), row({ id: "b", createdAt: 2 })];
    sortSaved(rows);
    expect(rows.map((r) => r.id)).toEqual(["a", "b"]);
  });
});

describe("overflowIds", () => {
  it("未ピン・未使用のみ対象、古い createdAt から削除", () => {
    const rows = [
      row({ id: "n3", createdAt: 3 }),
      row({ id: "n2", createdAt: 2 }),
      row({ id: "n1", createdAt: 1 }),
    ];
    expect(overflowIds(rows, 2)).toEqual(["n1"]);
  });

  it("ピン留め・使用済みは対象外かつ上限にカウントしない", () => {
    const rows = [
      row({ id: "pin", createdAt: 1, pinned: true }),
      row({ id: "used", createdAt: 2, used: true }),
      row({ id: "n4", createdAt: 4 }),
      row({ id: "n3", createdAt: 3 }),
    ];
    // cap=2: pin/used を除いた通常枠は n4, n3 の2件でちょうど収まる
    expect(overflowIds(rows, 2)).toEqual([]);
    // cap=1: n3 だけ溢れる
    expect(overflowIds(rows, 1)).toEqual(["n3"]);
  });

  it("上限以内なら空", () => {
    expect(overflowIds([row({ id: "a", createdAt: 1 })], 100)).toEqual([]);
  });
});

describe("条件バケツ（2026-07-30）", () => {
  it("シードだけ違う入力は同じ条件キーになる", () => {
    const a: BuildSetupInput = { seed: "1", playerCount: 4, mode: "lostFleet" };
    const b: BuildSetupInput = { seed: "999", playerCount: 4, mode: "lostFleet" };
    expect(setupConditionKey(a)).toBe(setupConditionKey(b));
    // id はシードまで含むので別物
    expect(setupHistoryId(a)).not.toBe(setupHistoryId(b));
  });

  it("条件が違えば別の条件キーになる", () => {
    const a: BuildSetupInput = { seed: "1", playerCount: 4, mode: "lostFleet" };
    const b: BuildSetupInput = { seed: "1", playerCount: 3, mode: "lostFleet" };
    expect(setupConditionKey(a)).not.toBe(setupConditionKey(b));
  });

  it("条件からシードが取り除かれている", () => {
    const c = setupConditionOf({ seed: "1", playerCount: 4 } as BuildSetupInput);
    expect("seed" in (c as any)).toBe(false);
    expect((c as any).playerCount).toBe(4);
  });

  it("上限は条件バケツごとに効く（別条件の件数を巻き込まない）", () => {
    const rows: SavedSetup[] = [];
    for (let i = 0; i < 3; i += 1) rows.push(row({ id: `A${i}`, conditionKey: "A", createdAt: i }));
    for (let i = 0; i < 3; i += 1) rows.push(row({ id: `B${i}`, conditionKey: "B", createdAt: i }));
    // cap=2 なら各バケツで1件ずつ（最も古いもの）が溢れる
    expect(overflowIds(rows, 2).sort()).toEqual(["A0", "B0"]);
  });
});
