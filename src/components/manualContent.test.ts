import { describe, expect, it } from "vitest";
import { MANUAL } from "./manualContent";

// 日英で章の構成（id の並び）が一致し、各章に中身があることを固定する（2026-10-16）。
describe("manualContent", () => {
  it("has the same chapter ids in ja and en, in the same order", () => {
    expect(MANUAL.en.chapters.map((c) => c.id)).toEqual(MANUAL.ja.chapters.map((c) => c.id));
  });

  it("has 7 chapters, each with a title, blocks and a design-notes ref", () => {
    for (const lang of ["ja", "en"] as const) {
      const chapters = MANUAL[lang].chapters;
      expect(chapters).toHaveLength(7);
      const ids = new Set(chapters.map((c) => c.id));
      expect(ids.size).toBe(chapters.length);
      for (const c of chapters) {
        expect(c.title.length).toBeGreaterThan(0);
        expect(c.blocks.length).toBeGreaterThan(1);
        expect(c.blocks.some((b) => "ref" in b)).toBe(true);
        for (const b of c.blocks) {
          if ("table" in b) {
            for (const row of b.table.rows) expect(row).toHaveLength(b.table.head.length);
          }
        }
      }
    }
  });
});
