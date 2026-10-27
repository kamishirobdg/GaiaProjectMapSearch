// src/components/TotalTable.test.ts
//
// Setup のセルのホバー（種族ごとの船接触と船の相互作用の加点。2026-10-27）。

import { describe, expect, it } from "vitest";
import type { ShipInteraction } from "@/gaia/eval/shipInteraction";
import { shipInteractionTitles } from "./TotalTable";

const si = {
  alpha: 1,
  mode: "faction",
  ships: [
    { ship: "twilight", contact: 20, rel: 1 },
    { ship: "eclipse", contact: 0, rel: -1 },
  ],
  mean: 10,
  byFaction: {
    terrans: { contact: { twilight: 30, eclipse: 10 }, mean: 20, rel: { twilight: 0.5, eclipse: -0.5 } },
    lantids: { contact: { twilight: 0, eclipse: 0 }, mean: 0, rel: { twilight: 1, eclipse: -1 } },
  },
  bonus: { terrans: 1, lantids: -2 },
} as unknown as ShipInteraction;

describe("shipInteractionTitles", () => {
  it("種族ごとの船接触があれば船ごとに 接触・平均比・タイル・加点 を並べる", () => {
    const t = shipInteractionTitles(si, { twilight: { terrans: 4 } as never, eclipse: { terrans: 2 } as never }, "ja");
    expect(t.terrans).toBe(
      ["船の相互作用 +1（この種族の船接触、平均 20）", "トワイライト: 船接触 30（平均比 +50%）× タイル 4 → +2", "エクリプス: 船接触 10（平均比 −50%）× タイル 2 → −1"].join("\n")
    );
  });

  it("船に届かない種族（平均 0）は全種族共通の船接触で、相互作用が無ければ空", () => {
    const t = shipInteractionTitles(si, { twilight: { lantids: 2 } as never }, "en");
    expect(t.lantids?.split("\n")[0]).toBe("Ship interaction −2 (ship contact shared by all factions, mean 10)");
    expect(t.lantids?.split("\n")[1]).toBe("Twilight: contact 20 (+100% vs mean) × tiles 2 → +2");
    expect(shipInteractionTitles(null, {}, "ja")).toEqual({});
  });
});
