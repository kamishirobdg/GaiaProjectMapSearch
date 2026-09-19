// src/components/TotalView.tsx
"use client";

// 種族別総合評価タブ（2026-08-04）。**マップ1枚 × セットアップ1つ**を選び、
// 種族ごとに「Map の評価値 ＋ Setup の評価値」を足して一覧にする。
//
// 足せるようになったのは 2026-08-03〜04 に Setup 側を VP 換算へ移し、最終スケール
// （SETUP_SCORE_DIVISOR）で 100 前後に落としたため。Map 側の評価値も色ごと100前後
// なので、同じ土俵に乗る。
//
// 合算比は**このタブの入力欄で変えられる**（2026-09-19、案C）。既定は 1:1 で、どちらを
// 重く見るのが妥当かは実データで試しながら決める（TODO.md「Map と Setup のバランス」）。
// 比は localStorage（gaia_score_blend、既定と違うフィールドだけ）に持ち、List の
// 種族優遇の掛け先と「合計の上位」も同じ比を読む（scoreBlend.ts / useScoreBlend）。

import React from "react";
import Link from "next/link";
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
import { deriveSetupSettings, setupSettingsOf } from "@/lib/pairPlan";
import { mapValueByFaction } from "@/gaia/eval/mapFaction";
import { scoreSetupFactions, type FactionScores } from "@/gaia/eval/factionEval";
import { buildSetupFromSeed, type BuildSetupInput } from "@/gaia/setup/buildSetup";
import { factionsForMode, type FactionId } from "@/gaia/eval/factionWeights";
import { factionHomeBg, useScoreBlend, useSetupWeights } from "@/components/FactionEvalPanel";
import {
  blendScores,
  isDefaultScoreBlend,
  SCORE_BLEND_MAX,
  SCORE_BLEND_MIN,
  SCORE_BLEND_STEP,
  type ScoreBlendKey,
} from "@/gaia/eval/scoreBlend";
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

/**
 * マップ／セットアップの選択は **List のペア選択と同じキーを共有する**（2026-08-04）。
 * List で組を選んでから Total を開けばそのまま出るし、逆も同じ。別々に持つと
 * 「List で選んだのに Total では選び直し」になって、シード値だけの選択肢を
 * もう一度探すはめになる。
 */
const LS_PAIR_MAP = "gaia_list_pair_map";
const LS_PAIR_SETUP = "gaia_list_pair_setup";

/**
 * List の「この組を Total で見る」から渡ってくる**提案そのもの**（2026-08-04）。
 *
 * 上の LS_PAIR_* は提案の**起点**（どのマップから探したか／どのセットアップから
 * 探したか）であって、**提案された結果ではない**。mapToSetup 方向で出てきた
 * セットアップは保存リストに無く id を持たないので、id では渡せない。
 * そこで「マップの id ＋ セットアップの入力そのもの」をここに置いて受け渡す。
 */
const LS_TOTAL_PENDING = "gaia_total_pending";
/** 保存リストに無い「List から渡ってきたセットアップ」を指す選択値。 */
const PENDING_ID = "__pending__";

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
    pinned: "★ ピン留め",
    others: "その他（スコア順／新しい順）",
    score: "スコア",
    used: "使用済み",
    fromList: "List の提案",
    proposal: "提案されたセットアップ",
    toList: "→ List でマップとセットアップの組を探す（選択はこのタブと共有）",
    blendTitle: "合算比",
    blendNote: "合計 ＝ Map × 倍率 ＋ Setup × 倍率。List の種族優遇の掛け先と「合計の上位」にも同じ比が効く。",
    blendReset: "1:1 に戻す",
    blendDefault: "1:1（既定）",
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
    pinned: "★ Pinned",
    others: "Others (by score / newest)",
    score: "Score",
    used: "used",
    fromList: "From the List tab",
    proposal: "proposed setup",
    toList: "→ Find a map/setup pair on the List tab (the selection is shared)",
    blendTitle: "Blend",
    blendNote: "Total = Map × weight + Setup × weight. List's faction preference and its top-by-total line use the same ratio.",
    blendReset: "Reset to 1:1",
    blendDefault: "1:1 (default)",
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

/** 保存日（シードだけでは見分けが付かないので選択肢に添える）。 */
function dateOf(ms: number | undefined): string {
  if (!ms) return "";
  const d = new Date(ms);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}/${p(d.getMonth() + 1)}/${p(d.getDate())}`;
}

export default function TotalView() {
  const [lang, setLang] = React.useState<Lang>("ja");
  const [players, setPlayers] = React.useState<number>(4);
  const [expansion, setExpansion] = React.useState<Expansion>("base");
  const [evalWeights] = useSetupWeights();
  // Map と Setup の合算比（2026-09-19、案C）。書き込みは入力のハンドラだけ。
  const [blend, changeBlend, resetBlend] = useScoreBlend();

  const [pinnedMaps, setPinnedMaps] = React.useState<PersistedCandidate[]>([]);
  const [rankedMaps, setRankedMaps] = React.useState<PersistedCandidate[]>([]);
  const [topOverallMap, setTopOverallMap] = React.useState<PersistedCandidate | null>(null);
  const [templateIdBySearchKey, setTemplateIdBySearchKey] = React.useState<Record<string, string>>({});
  const [setups, setSetups] = React.useState<SavedSetup[]>([]);
  const [mapId, setMapId] = React.useState<string>("");
  const [setupId, setSetupId] = React.useState<string>("");
  /** List の提案から渡ってきたセットアップ（保存リストに無いので入力ごと持つ）。 */
  const [pendingSetup, setPendingSetup] = React.useState<BuildSetupInput | null>(null);

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
      // List のペア選択（＝提案の起点）を引き継ぐ
      const m = localStorage.getItem(LS_PAIR_MAP);
      if (m) setMapId(m);
      const s = localStorage.getItem(LS_PAIR_SETUP);
      if (s) setSetupId(s);
      // 「この組を Total で見る」から来た場合は、そちらを優先する。
      // 提案されたセットアップは保存リストに無いので入力ごと受け取る。
      const raw = localStorage.getItem(LS_TOTAL_PENDING);
      if (raw) {
        const o = JSON.parse(raw) as { mapId?: string; setupInput?: BuildSetupInput };
        if (o?.mapId) setMapId(String(o.mapId));
        if (o?.setupInput?.seed) {
          setPendingSetup(o.setupInput);
          setSetupId(PENDING_ID);
        }
      }
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

  const lf = expansion === "lostFleet";

  // **上のバーで選んだ人数・拡張に合うものだけを出す**（2026-08-04 実機で指摘）。
  // 混ざっていると、基本版を選んでいるのに LF のセットアップが選べてしまい、
  // LF船ぶんが乗った Setup 値と基本版のマップ値を足すことになる。
  // 判定は List のペア提案と同じ（pairPlan の setupSettingsOf / deriveSetupSettings）。
  // 基本版のマップは 3人・4人で同じテンプレートなので人数では絞らない。
  const selectableMaps = React.useMemo<PersistedCandidate[]>(
    () =>
      buildMapPool({
        pinned: pinnedMaps,
        ranked: rankedMaps,
        templateIdBySearchKey,
        topOverall: topOverallMap,
      }).filter((c) => {
        const tid = templateIdBySearchKey[c.searchKey] ?? "";
        if (!tid) return false;
        const s = deriveSetupSettings(tid);
        return s.lf === lf && (s.lf ? s.players === players : true);
      }),
    [pinnedMaps, rankedMaps, topOverallMap, templateIdBySearchKey, lf, players]
  );

  // ピン留めを先に、続けて新しい順（List の保存リストと同じ並び）。
  const selectableSetups = React.useMemo<SavedSetup[]>(
    () =>
      setups
        .filter((r) => {
          const s = setupSettingsOf(r);
          return s.lf === lf && s.players === players;
        })
        .sort(
          (a, b) =>
            Number(b.pinned) - Number(a.pinned) || (b.updatedAt ?? 0) - (a.updatedAt ?? 0)
        ),
    [setups, lf, players]
  );

  // 人数・拡張を変えて選択が候補から外れたら解除する（古い選択のまま値だけ
  // 出し続けると、どの条件の組を見ているのか分からなくなる）。
  React.useEffect(() => {
    if (mapId && !selectableMaps.some((c) => c.id === mapId)) setMapId("");
  }, [selectableMaps, mapId]);
  // List から渡ってきたぶん（PENDING_ID）は保存リストに無いので、この判定から外す。
  React.useEffect(() => {
    if (setupId && setupId !== PENDING_ID && !selectableSetups.some((r) => r.id === setupId)) {
      setSetupId("");
    }
  }, [selectableSetups, setupId]);

  /** 選択は List のペア選択と共有する（書き込みはユーザー操作のときだけ）。 */
  const changeMapId = React.useCallback((v: string) => {
    setMapId(v);
    try {
      if (v) localStorage.setItem(LS_PAIR_MAP, v);
      else localStorage.removeItem(LS_PAIR_MAP);
    } catch {
      // ignore
    }
  }, []);
  const changeSetupId = React.useCallback((v: string) => {
    setSetupId(v);
    try {
      // PENDING（List の提案）は保存リストの id ではないので共有キーへは書かない。
      if (v && v !== PENDING_ID) localStorage.setItem(LS_PAIR_SETUP, v);
      else if (!v) localStorage.removeItem(LS_PAIR_SETUP);
    } catch {
      // ignore
    }
  }, []);

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

  // ピン留めを別グループにする（シード値だけの一覧では見分けが付かないため）。
  const mapGroups = React.useMemo(() => {
    const pin = selectableMaps.filter((c) => c.pinned);
    const rest = selectableMaps.filter((c) => !c.pinned);
    return [
      ...(pin.length ? [{ label: t.pinned, rows: pin }] : []),
      ...(rest.length ? [{ label: t.others, rows: rest }] : []),
    ];
  }, [selectableMaps, t]);
  const setupGroups = React.useMemo(() => {
    const pin = selectableSetups.filter((r) => r.pinned);
    const rest = selectableSetups.filter((r) => !r.pinned);
    return [
      ...(pin.length ? [{ label: t.pinned, rows: pin }] : []),
      ...(rest.length ? [{ label: t.others, rows: rest }] : []),
    ];
  }, [selectableSetups, t]);

  const selectedMap = selectableMaps.find((c) => c.id === mapId) ?? null;
  const selectedSetup = selectableSetups.find((r) => r.id === setupId) ?? null;

  /** List から渡ってきたセットアップが、いまの人数・拡張に合っているか。 */
  const pendingMatches =
    !!pendingSetup &&
    (pendingSetup.mode === "lostFleet") === lf &&
    (pendingSetup.playerCount ?? 4) === players;

  const setupInput: BuildSetupInput | null =
    setupId === PENDING_ID ? (pendingMatches ? pendingSetup : null) : (selectedSetup?.input ?? null);

  const rows = React.useMemo(() => {
    if (!selectedMap || !setupInput) return null;
    const bd = breakdownOf(selectedMap);
    const mapScores: FactionScores = mapValueByFaction(bd);
    const setupScores = scoreSetupFactions(buildSetupFromSeed(setupInput), evalWeights);
    return factionsForMode(lf)
      .map((f) => ({
        id: f.id as FactionId,
        name: lang === "ja" ? f.labelJa : f.labelEn,
        color: f.color,
        map: mapScores[f.id] ?? 0,
        setup: setupScores[f.id] ?? 0,
        total: blendScores(mapScores[f.id] ?? 0, setupScores[f.id] ?? 0, blend),
      }))
      .sort((a, b) => b.total - a.total);
  }, [selectedMap, setupInput, evalWeights, lf, lang, blend]);

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
                  onChange={(e) => changeMapId(e.target.value)}
                  style={{ minWidth: 300, fontSize: 12 }}
                >
                  <option value="">—</option>
                  {mapGroups.map((g) => (
                    <optgroup key={g.label} label={g.label}>
                      {g.rows.map((c) => (
                        <option key={c.id} value={c.id}>
                          {t.seed} {c.seed}｜{t.score} {fmt(Number(c.score))}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              )}
            </label>

            <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12 }}>
              <span style={{ fontWeight: 700 }}>{t.setup}</span>
              {selectableSetups.length === 0 && !pendingMatches ? (
                <span style={{ opacity: 0.6 }}>{t.noSetup}</span>
              ) : (
                <select
                  value={setupId}
                  onChange={(e) => changeSetupId(e.target.value)}
                  style={{ minWidth: 300, fontSize: 12 }}
                >
                  <option value="">—</option>
                  {/* List の「この組を Total で見る」で渡ってきたぶん。保存リストには
                      無いので、ここだけ入力から直に選択肢を作る。 */}
                  {pendingMatches && pendingSetup ? (
                    <optgroup label={t.fromList}>
                      <option value={PENDING_ID}>
                        {t.seed} {pendingSetup.seed}｜{t.proposal}
                      </option>
                    </optgroup>
                  ) : null}
                  {setupGroups.map((g) => (
                    <optgroup key={g.label} label={g.label}>
                      {g.rows.map((r) => (
                        <option key={r.id} value={r.id}>
                          {t.seed} {r.seed}｜{dateOf(r.updatedAt ?? r.createdAt)}
                          {r.used ? `｜${t.used}` : ""}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              )}
            </label>
          </div>

          {/* 選択は List のペア提案と共有している（どちらで選んでも両方に出る） */}
          <div style={{ fontSize: 11, marginTop: 8 }}>
            <Link href="/list" style={{ color: "#2733cc" }}>
              {t.toList}
            </Link>
          </div>

          {/* 合算比（2026-09-19、案C）。既定 1:1。書き込みは onChange のときだけ。 */}
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginTop: 10, fontSize: 12 }}>
            <span style={{ fontWeight: 700 }}>{t.blendTitle}</span>
            {(["map", "setup"] as ScoreBlendKey[]).map((k) => (
              <label
                key={k}
                style={{
                  display: "flex",
                  gap: 4,
                  alignItems: "center",
                  border: "1px solid #eee",
                  borderRadius: 6,
                  padding: "3px 6px",
                  background: blend[k] === 1 ? "#fafafa" : "#eef6ff",
                }}
              >
                <span>{k === "map" ? t.mapScore : t.setupScore} ×</span>
                <input
                  type="number"
                  step={SCORE_BLEND_STEP}
                  min={SCORE_BLEND_MIN}
                  max={SCORE_BLEND_MAX}
                  value={blend[k]}
                  onChange={(e) => changeBlend(k, Number(e.target.value))}
                  style={{ width: 60, padding: "2px 4px", fontSize: 12 }}
                />
              </label>
            ))}
            <button onClick={resetBlend} disabled={isDefaultScoreBlend(blend)} style={{ fontSize: 11 }}>
              {isDefaultScoreBlend(blend) ? t.blendDefault : t.blendReset}
            </button>
          </div>
          <div style={{ fontSize: 11, opacity: 0.6, marginTop: 6 }}>{t.blendNote}</div>
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
                    <th style={th}>
                      {t.mapScore}
                      {blend.map !== 1 ? ` ×${blend.map}` : ""}
                    </th>
                    <th style={th}>
                      {t.setupScore}
                      {blend.setup !== 1 ? ` ×${blend.setup}` : ""}
                    </th>
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
