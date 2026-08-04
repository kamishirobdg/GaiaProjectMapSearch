// src/components/TotalView.tsx
"use client";

// 種族別総合評価タブ（2026-08-04）。**マップ1枚 × セットアップ1つ**を選び、
// 種族ごとに「Map の評価値 ＋ Setup の評価値」を足して一覧にする。
//
// 足せるようになったのは 2026-08-03〜04 に Setup 側を VP 換算へ移し、最終スケール
// （SETUP_SCORE_DIVISOR）で 100 前後に落としたため。Map 側の評価値も色ごと100前後
// なので、同じ土俵に乗る。
//
// **いまの合算は 1:1 固定**。どちらを重く見るのが妥当かは検討中なので（TODO.md
// 「Map と Setup のバランス」）、倍率の入力欄はまだ出していない。

import React from "react";
import GlobalBar from "@/components/GlobalBar";
import { PageBody, Panel, T } from "@/components/ui/layout";
import {
  openDb,
  idbGetAllFromStore,
  loadProfilesFromDb,
  STORE_CANDIDATES,
  type PersistedCandidate,
} from "@/app/board/persistence";
import { listSavedSetups, type SavedSetup } from "@/lib/setupHistory";
import { buildMapPool } from "@/lib/mapCandidates";
import { mapValueByFaction } from "@/gaia/eval/mapFaction";
import { scoreSetupFactions, type FactionScores } from "@/gaia/eval/factionEval";
import { buildSetupFromSeed } from "@/gaia/setup/buildSetup";
import { factionsForMode, type FactionId } from "@/gaia/eval/factionWeights";
import { factionHomeBg, useSetupWeights } from "@/components/FactionEvalPanel";
import {
  readSharedExpansion,
  readSharedPlayers,
  writeSharedExpansion,
  writeSharedPlayers,
  type Expansion,
} from "@/lib/sharedSettings";

type Lang = "ja" | "en";

/** ランキングから候補に載せるマップの上限（List と同じ）。 */
const RANKED_MAP_CAP = 200;

const UI = {
  ja: {
    title: "種族別総合評価",
    note: "選んだマップとセットアップで、種族ごとの評価値を合算する",
    map: "マップ",
    setup: "セットアップ",
    noMap: "保存されたマップがありません（Map タブで検索して候補を貯めてください）",
    noSetup: "保存されたセットアップがありません（Setup タブで生成すると自動で記録されます）",
    pick: "マップとセットアップを選ぶと一覧が出ます",
    rank: "順",
    faction: "種族",
    mapScore: "Map",
    setupScore: "Setup",
    total: "合計",
    pinned: "ピン留め",
    balanceNote:
      "合算は 1:1（Map と Setup を同じ重みで足す）。どちらを重く見るかは検討中で、倍率の指定はまだ入れていない。",
    noBreakdown:
      "このマップは評価の内訳を持っていないため Map ぶんが 0 になる（古い候補。Map タブで検索し直すと付く）",
    seed: "シード",
  },
  en: {
    title: "Faction totals",
    note: "Adds the map score and the setup score per faction",
    map: "Map",
    setup: "Setup",
    noMap: "No saved maps (search on the Map tab first)",
    noSetup: "No saved setups (rolling one on the Setup tab records it)",
    pick: "Pick a map and a setup to see the table",
    rank: "#",
    faction: "Faction",
    mapScore: "Map",
    setupScore: "Setup",
    total: "Total",
    pinned: "Pinned",
    balanceNote:
      "Totals are 1:1 for now; the map/setup balance is still under review, so there is no weight input yet.",
    noBreakdown: "This map has no stored evaluation breakdown, so its map score is 0 (older candidate).",
    seed: "Seed",
  },
} as const;

/** 候補マップの評価内訳（Map ぶんの材料）。古い候補は持っていないことがある。 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function breakdownOf(c: PersistedCandidate | null): any {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (c as any)?.evaluation?.breakdown ?? null;
}

function fmt(n: number): string {
  const r = Math.round(n * 10) / 10;
  return Number.isInteger(r) ? String(r) : r.toFixed(1);
}

export default function TotalView() {
  const [lang, setLang] = React.useState<Lang>("ja");
  const [players, setPlayers] = React.useState<number>(4);
  const [expansion, setExpansion] = React.useState<Expansion>("base");
  const [evalWeights] = useSetupWeights();

  const [pinnedMaps, setPinnedMaps] = React.useState<PersistedCandidate[]>([]);
  const [rankedMaps, setRankedMaps] = React.useState<PersistedCandidate[]>([]);
  const [topOverallMap, setTopOverallMap] = React.useState<PersistedCandidate | null>(null);
  const [templateIdBySearchKey, setTemplateIdBySearchKey] = React.useState<Record<string, string>>({});
  const [setups, setSetups] = React.useState<SavedSetup[]>([]);
  const [mapId, setMapId] = React.useState<string>("");
  const [setupId, setSetupId] = React.useState<string>("");

  const t = UI[lang];

  // 復元は初回だけ。書き込みはユーザー操作のハンドラでのみ行う
  // （CLAUDE.md「localStorage は復元effectと書込みeffectを併用しない」）。
  React.useEffect(() => {
    try {
      const l = localStorage.getItem("gaia_ui_lang");
      if (l === "ja" || l === "en") setLang(l);
      // 共有設定は未保存だと null（他タブと同じく既定へフォールバックする）。
      const p = readSharedPlayers();
      if (p != null) setPlayers(p);
      const e = readSharedExpansion();
      if (e != null) setExpansion(e);
    } catch {
      // ignore
    }

    let alive = true;
    void (async () => {
      try {
        const db = await openDb();
        const all = await idbGetAllFromStore<PersistedCandidate>(db, STORE_CANDIDATES);
        const pins = all
          .filter((c) => c.pinned)
          .sort((a, b) => (b.pinnedAt ?? 0) - (a.pinnedAt ?? 0));
        const top = all.slice().sort((a, b) => Number(b.score) - Number(a.score))[0] ?? null;
        const profiles = await loadProfilesFromDb(500);
        const tmap: Record<string, string> = {};
        for (const p of profiles) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const tid = String(p.templateId ?? (p.params as any)?.templateId ?? "");
          if (tid) tmap[p.searchKey] = tid;
        }
        if (!alive) return;
        setPinnedMaps(pins);
        setTopOverallMap(top);
        setTemplateIdBySearchKey(tmap);
        setRankedMaps(
          all.slice().sort((a, b) => Number(b.score) - Number(a.score)).slice(0, RANKED_MAP_CAP)
        );
      } catch {
        // ignore
      }
      try {
        const rows = await listSavedSetups();
        if (alive) setSetups(rows);
      } catch {
        // ignore
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const selectableMaps = React.useMemo<PersistedCandidate[]>(
    () =>
      buildMapPool({
        pinned: pinnedMaps,
        ranked: rankedMaps,
        templateIdBySearchKey,
        topOverall: topOverallMap,
      }),
    [pinnedMaps, rankedMaps, topOverallMap, templateIdBySearchKey]
  );

  // ピン留めを先に、続けて新しい順（List の保存リストと同じ並び）。
  const selectableSetups = React.useMemo<SavedSetup[]>(
    () =>
      setups
        .slice()
        .sort(
          (a, b) =>
            Number(b.pinned) - Number(a.pinned) || (b.updatedAt ?? 0) - (a.updatedAt ?? 0)
        ),
    [setups]
  );

  const onGlobalSelect = React.useCallback((p: number, e: Expansion) => {
    setPlayers(p);
    setExpansion(e);
    writeSharedPlayers(p);
    writeSharedExpansion(e);
  }, []);

  const setLangPersist = React.useCallback((l: Lang) => {
    setLang(l);
    try {
      localStorage.setItem("gaia_ui_lang", l);
    } catch {
      // ignore
    }
  }, []);

  const selectedMap = selectableMaps.find((c) => c.id === mapId) ?? null;
  const selectedSetup = selectableSetups.find((r) => r.id === setupId) ?? null;

  const rows = React.useMemo(() => {
    if (!selectedMap || !selectedSetup) return null;
    const bd = breakdownOf(selectedMap);
    const mapScores: FactionScores = mapValueByFaction(bd);
    const setupScores = scoreSetupFactions(buildSetupFromSeed(selectedSetup.input), evalWeights);
    const lf = expansion === "lostFleet";
    return factionsForMode(lf)
      .map((f) => ({
        id: f.id as FactionId,
        name: lang === "ja" ? f.labelJa : f.labelEn,
        color: f.color,
        map: mapScores[f.id] ?? 0,
        setup: setupScores[f.id] ?? 0,
        total: (mapScores[f.id] ?? 0) + (setupScores[f.id] ?? 0),
      }))
      .sort((a, b) => b.total - a.total);
  }, [selectedMap, selectedSetup, evalWeights, expansion, lang]);

  const mapHasBreakdown = selectedMap ? !!breakdownOf(selectedMap) : true;

  const th: React.CSSProperties = {
    textAlign: "right",
    padding: "4px 8px",
    borderBottom: "2px solid #ddd",
    fontSize: 12,
    whiteSpace: "nowrap",
  };
  const td: React.CSSProperties = {
    textAlign: "right",
    padding: "3px 8px",
    borderBottom: "1px solid #eee",
    fontSize: 13,
    whiteSpace: "nowrap",
  };

  return (
    <>
      <GlobalBar
        active="total"
        players={players}
        expansion={expansion}
        onSelect={onGlobalSelect}
        lang={lang}
        onLang={setLangPersist}
      />
      <PageBody>
        <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          <div style={{ fontWeight: 700, fontSize: 16 }}>{t.title}</div>
          <div style={{ fontSize: 11, opacity: 0.6 }}>{t.note}</div>
        </div>

        <Panel>
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap", alignItems: "flex-end" }}>
            <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12 }}>
              <span style={{ fontWeight: 700 }}>{t.map}</span>
              {selectableMaps.length === 0 ? (
                <span style={{ opacity: 0.6 }}>{t.noMap}</span>
              ) : (
                <select
                  value={mapId}
                  onChange={(e) => setMapId(e.target.value)}
                  style={{ minWidth: 260, fontSize: 12 }}
                >
                  <option value="">—</option>
                  {selectableMaps.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.pinned ? "★ " : ""}
                      {t.seed} {c.seed} / {fmt(Number(c.score))}
                    </option>
                  ))}
                </select>
              )}
            </label>

            <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12 }}>
              <span style={{ fontWeight: 700 }}>{t.setup}</span>
              {selectableSetups.length === 0 ? (
                <span style={{ opacity: 0.6 }}>{t.noSetup}</span>
              ) : (
                <select
                  value={setupId}
                  onChange={(e) => setSetupId(e.target.value)}
                  style={{ minWidth: 260, fontSize: 12 }}
                >
                  <option value="">—</option>
                  {selectableSetups.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.pinned ? "★ " : ""}
                      {t.seed} {r.seed}
                      {r.input.mode === "lostFleet" ? " / LF" : ""}
                      {r.input.playerCount ? ` / ${r.input.playerCount}p` : ""}
                    </option>
                  ))}
                </select>
              )}
            </label>
          </div>

          <div style={{ fontSize: 11, opacity: 0.6, marginTop: 8 }}>{t.balanceNote}</div>
          {!mapHasBreakdown ? (
            <div style={{ fontSize: 11, color: "#a15", marginTop: 4 }}>{t.noBreakdown}</div>
          ) : null}
        </Panel>

        <Panel>
          {!rows ? (
            <div style={{ fontSize: 12, opacity: 0.6 }}>{t.pick}</div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ borderCollapse: "collapse", minWidth: 360 }}>
                <thead>
                  <tr>
                    <th style={{ ...th, textAlign: "right" }}>{t.rank}</th>
                    <th style={{ ...th, textAlign: "left" }}>{t.faction}</th>
                    <th style={th}>{t.mapScore}</th>
                    <th style={th}>{t.setupScore}</th>
                    <th style={{ ...th, borderLeft: "1px solid #ddd" }}>{t.total}</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr key={r.id} style={{ background: factionHomeBg(r.color) }}>
                      <td style={{ ...td, opacity: 0.6 }}>{i + 1}</td>
                      <td style={{ ...td, textAlign: "left" }}>{r.name}</td>
                      <td style={td}>{fmt(r.map)}</td>
                      <td style={td}>{fmt(r.setup)}</td>
                      <td style={{ ...td, fontWeight: 800, borderLeft: "1px solid #ddd" }}>
                        {fmt(r.total)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>

        <div style={{ fontSize: 11, opacity: 0.5, marginTop: T.gap }}>
          {lang === "ja"
            ? "Map ぶんは母星色の評価値（Map タブの内訳表と同じ）。Setup ぶんは評価指数を掛けた種族スコアで、Setup / List タブと同じ値。"
            : "The map part is the home-color score from the Map tab's breakdown; the setup part is the faction score used on the Setup / List tabs."}
        </div>
      </PageBody>
    </>
  );
}
