import { describe, expect, it } from "vitest";
import { buildMapPool, uniqueByBoard, type BoardLike } from "./mapCandidates";

const TID = { kA: "3p_lostFleet", kB: "3p_lostFleet", kC: "4p_lostFleet" };

function c(id: string, searchKey: string, placementHash: string, score = 0, pinned = false): BoardLike {
  return { id, searchKey, placementHash, score, pinned };
}

describe("uniqueByBoard", () => {
  it("同じ盤面が別の検索条件で保存されていても1件に潰す（重複提示の再現）", () => {
    // 実機報告: 候補に df37ce と 2e1710 が2回ずつ出た。searchKey 違いで id が別。
    const list = [
      c("1", "kA", "4002e1", -444),
      c("2", "kA", "df37ce", -191),
      c("3", "kB", "df37ce", -191), // 同じ盤面・別レコード
      c("4", "kA", "2e1710", -196),
      c("5", "kB", "2e1710", -196), // 同じ盤面・別レコード
    ];
    const out = uniqueByBoard(list, TID);
    expect(out.map((x) => x.placementHash)).toEqual(["4002e1", "df37ce", "2e1710"]);
    expect(out.map((x) => x.id)).toEqual(["1", "2", "4"]); // 先に出た方を残す
  });

  it("テンプレートが違えば同じハッシュでも別盤面として残す", () => {
    const out = uniqueByBoard([c("1", "kA", "same"), c("2", "kC", "same")], TID);
    expect(out).toHaveLength(2);
  });

  it("placementHash が無い古いレコードは id で区別して潰さない", () => {
    const list = [
      { id: "1", searchKey: "kA" },
      { id: "2", searchKey: "kA" },
      { id: "2", searchKey: "kA" }, // 同一 id は潰す
    ];
    expect(uniqueByBoard(list, TID)).toHaveLength(2);
  });
});

describe("buildMapPool", () => {
  it("ピン留めを先頭にスコア降順、その後ランキング。重複盤面はピン留め側を残す", () => {
    const pinned = [c("p1", "kA", "hash-x", 10, true), c("p2", "kA", "hash-y", 30, true)];
    const ranked = [
      c("r1", "kA", "hash-y", 30), // p2 と同じ盤面 → ピン留め側が残る
      c("r2", "kA", "hash-z", 20),
    ];
    const out = buildMapPool({ pinned, ranked, templateIdBySearchKey: TID });
    expect(out.map((x) => x.id)).toEqual(["p2", "p1", "r2"]);
  });

  it("候補が空なら全体最上位1件へフォールバックする", () => {
    const top = c("t", "kA", "hash-t", 5);
    expect(buildMapPool({ pinned: [], ranked: [], templateIdBySearchKey: TID, topOverall: top })).toEqual([top]);
    expect(buildMapPool({ pinned: [], ranked: [], templateIdBySearchKey: TID, topOverall: null })).toEqual([]);
  });
});
