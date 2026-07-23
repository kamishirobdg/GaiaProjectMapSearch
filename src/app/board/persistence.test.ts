// src/app/board/persistence.test.ts
//
// mergeCandidates（純粋部分）のピン留め挙動テスト（TODO ③、2026-07-24）。
// IndexedDB を伴う関数はブラウザ専用のため対象外。

import { describe, expect, it } from "vitest";
import { mergeCandidates, type PersistedCandidate } from "./persistence";

const SK = "sk";

function cand(partial: Partial<PersistedCandidate> & { placementHash: string; score: number }): PersistedCandidate {
  return {
    id: `${SK}:${partial.placementHash}`,
    searchKey: SK,
    seed: partial.placementHash,
    rankValue: -partial.score,
    placement: [],
    evaluation: null,
    used: false,
    usedKey: 0,
    createdAt: 1,
    updatedAt: 1,
    ...partial,
  } as PersistedCandidate;
}

describe("mergeCandidates pinning", () => {
  it("keeps pinned active rows beyond capacityActive (used-like protection)", () => {
    const existing = [
      cand({ placementHash: "a", score: 100 }),
      cand({ placementHash: "b", score: 90 }),
      cand({ placementHash: "pin", score: 1, pinned: true, pinnedAt: 5 }),
    ];
    const merged = mergeCandidates(SK, existing, [], [], 2);
    const kept = merged.active.map((c) => c.placementHash);
    expect(kept).toEqual(["a", "b", "pin"]);
    expect(merged.deletedActiveIds).toEqual([]);
  });

  it("unpinned overflow rows are still trimmed and reported deleted", () => {
    const existing = [
      cand({ placementHash: "a", score: 100 }),
      cand({ placementHash: "b", score: 90 }),
      cand({ placementHash: "c", score: 1 }),
    ];
    const merged = mergeCandidates(SK, existing, [], [], 2);
    expect(merged.active.map((c) => c.placementHash)).toEqual(["a", "b"]);
    expect(merged.deletedActiveIds).toEqual([`${SK}:c`]);
  });

  it("preserves pinned/pinnedAt when merging duplicates (incoming unpinned copy)", () => {
    const existing = [cand({ placementHash: "x", score: 50, pinned: true, pinnedAt: 7 })];
    const incoming = [cand({ placementHash: "x", score: 60 })]; // better score, no pin
    const merged = mergeCandidates(SK, existing, [], incoming, 10);
    expect(merged.active).toHaveLength(1);
    expect(merged.active[0].score).toBe(60);
    expect(merged.active[0].pinned).toBe(true);
    expect(merged.active[0].pinnedAt).toBe(7);
  });

  it("used rows keep pin flags too", () => {
    const used = [cand({ placementHash: "u", score: 10, used: true, usedKey: 1, pinned: true, pinnedAt: 3 })];
    const merged = mergeCandidates(SK, [], used, [], 5);
    expect(merged.used[0].pinned).toBe(true);
    expect(merged.used[0].pinnedAt).toBe(3);
  });
});
