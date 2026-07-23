// src/components/ListView.tsx
"use client";

// 一覧タブ（TODO ③、2026-07-24）: ピン留めしたマップとセットアップを
// 横断で並べ、共有リンク（マップ=/board?h= / セットアップ=/setup?s=）と
// ピン解除を提供する。並びはピン留めの新しい順。
// マップは MapBoardViewer のミニ描画（追加素材不要）。

import React from "react";
import Link from "next/link";
import { MapBoardViewer, type PlacementItem } from "@/components/MapBoardViewer";
import {
  openDb,
  idbGetAllFromStore,
  idbPutAll,
  loadProfilesFromDb,
  STORE_CANDIDATES,
  type PersistedCandidate,
} from "@/app/board/persistence";
import {
  buildSectorImgById,
  getAllSectors,
  IMG_OFFSET_BY_SLOT,
  ROT_OFFSETS_BY_SLOT,
  TEMPLATE_BY_ID,
} from "@/gaia/board/viewerAssets";
import { buildSectorLookup } from "@/gaia/board/previewBoard";
import { encodePlacementToken, decodePlacementToken } from "@/gaia/ssot/placementHash";
import { listSavedSetups, recordSetup, setSetupPinned, type SavedSetup } from "@/lib/setupHistory";
import { copyText, decodeSetupToken, encodeSetupToken } from "@/lib/setupShare";
import { readSharedExpansion, readSharedPlayers } from "@/lib/sharedSettings";
import {
  recommendSetup,
  scoreSetupFactions,
  topFactions,
  type FactionScores,
  type RecommendCriterion,
  type Recommendation,
} from "@/gaia/eval/factionEval";
import { mapFactionScores } from "@/gaia/eval/mapFaction";
import { FACTIONS, type FactionId } from "@/gaia/eval/factionWeights";
import { buildSetupFromSeed, type BuildSetupInput } from "@/gaia/setup/buildSetup";

type Lang = "ja" | "en";

const UI = {
  ja: {
    title: "ピン留め一覧",
    note: "マップ（/board）とセットアップ（/setup）でピン留めしたものが集まります",
    maps: "マップ",
    setups: "セットアップ",
    emptyMaps: "ピン留めしたマップはありません（Mapタブの結果行で「ピン留め」）",
    emptySetups: "ピン留めしたセットアップはありません（Setupタブの保存リストで「ピン留め」）",
    open: "開く",
    share: "共有",
    shareCopied: "コピーしました",
    unpin: "ピン解除",
    score: "スコア",
    seed: "シード",
    used: "使用済み",
    modeBase: "基本版",
    modeLF: "Lost Fleet",
    players: "人数",
    unknownTemplate: "テンプレート不明（プレビューなし）",
    pairTitle: "セット提案（マップ＋セットアップ）",
    pairNote: "ピン留めマップを選ぶと、基準に沿った推奨セットアップを1件提示します（種族重みはDRAFT）",
    pairMap: "マップ",
    pairNoMap: "（マップなし）",
    pairCriterion: "基準",
    crit1: "1: 逆優位（マップ上位種族が弱い）",
    crit2: "2: 上位バランス（人数+2種族が拮抗）",
    crit3: "3: マップ非依存の全体バランス",
    generate: "提案を生成",
    regenerate: "再生成",
    needMap: "基準1にはマップの選択が必要です",
    mapStrong: "マップ優位",
    setupStrong: "セットアップ優位（上位5）",
    trialsNote: "200シードから最良1件",
    openSetup: "Setupで開く",
    openBoard: "ボードで開く",
    sharePair: "セット共有URL",
    recordToList: "保存リストに記録",
    recorded: "記録しました",
    sharedPairTitle: "共有されたセット",
  },
  en: {
    title: "Pinned items",
    note: "Everything pinned on the Map (/board) and Setup (/setup) tabs gathers here",
    maps: "Maps",
    setups: "Setups",
    emptyMaps: "No pinned maps yet (use \"Pin\" on a result row in the Map tab)",
    emptySetups: "No pinned setups yet (use \"Pin\" in the Setup tab's saved list)",
    open: "Open",
    share: "Share",
    shareCopied: "Copied",
    unpin: "Unpin",
    score: "Score",
    seed: "Seed",
    used: "Used",
    modeBase: "Base game",
    modeLF: "Lost Fleet",
    players: "Players",
    unknownTemplate: "Unknown template (no preview)",
    pairTitle: "Pair proposal (map + setup)",
    pairNote: "Pick a pinned map to get one recommended setup per criterion (faction weights are DRAFT)",
    pairMap: "Map",
    pairNoMap: "(no map)",
    pairCriterion: "Criterion",
    crit1: "1: Oppose map (map's top factions weak)",
    crit2: "2: Top balance (players+2 factions close)",
    crit3: "3: Map-independent overall balance",
    generate: "Generate",
    regenerate: "Regenerate",
    needMap: "Criterion 1 requires a selected map",
    mapStrong: "Map favors",
    setupStrong: "Setup favors (top 5)",
    trialsNote: "best of 200 seeds",
    openSetup: "Open in Setup",
    openBoard: "Open board",
    sharePair: "Share pair URL",
    recordToList: "Record to saved list",
    recorded: "Recorded",
    sharedPairTitle: "Shared pair",
  },
} as const;

/** 種族の表示名。 */
function factionLabel(id: FactionId, lang: Lang): string {
  const f = FACTIONS.find((x) => x.id === id);
  return f ? (lang === "ja" ? f.labelJa : f.labelEn) : id;
}

/** セットアップスコア上位N件を [ラベル +n] で並べる。 */
function topFactionText(scores: FactionScores, n: number, lang: Lang): string {
  const ids = topFactions(scores, n);
  return ids
    .map((f) => `${factionLabel(f, lang)} ${scores[f] >= 0 ? "+" : ""}${Math.round(scores[f] * 10) / 10}`)
    .join(" / ");
}

/**
 * ペア提案のセットアップ条件はマップのテンプレートから導出する
 * （マップと拡張・人数が食い違う提案を出さないため）。マップなしのときは
 * 共有設定（人数・拡張）に従う。
 */
function deriveSetupSettings(templateId: string | null): { players: number; lf: boolean } {
  if (templateId === "3p_lostFleet") return { players: 3, lf: true };
  if (templateId === "4p_lostFleet") return { players: 4, lf: true };
  const p = readSharedPlayers() ?? 4;
  if (templateId === "base_34p") return { players: Math.min(4, Math.max(3, p)), lf: false };
  return { players: p, lf: (readSharedExpansion() ?? "base") === "lostFleet" };
}

/** templateId -> 表示用の 拡張/人数 ラベル。 */
function templateMeta(templateId: string, t: (typeof UI)["ja" | "en"]): string {
  switch (templateId) {
    case "base_34p":
      return `${t.modeBase} 3-4p`;
    case "3p_lostFleet":
      return `${t.modeLF} 3p`;
    case "4p_lostFleet":
      return `${t.modeLF} 4p`;
    default:
      return templateId || "?";
  }
}

function fmtWhen(ts: number | undefined, lang: Lang): string {
  if (!ts) return "";
  return new Date(ts).toLocaleString(lang === "ja" ? "ja-JP" : "en-US", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function ListView() {
  const [lang, setLang] = React.useState<Lang>("ja");
  const [pinnedMaps, setPinnedMaps] = React.useState<PersistedCandidate[]>([]);
  const [templateIdBySearchKey, setTemplateIdBySearchKey] = React.useState<Record<string, string>>({});
  const [pinnedSetups, setPinnedSetups] = React.useState<SavedSetup[]>([]);
  const [copiedKey, setCopiedKey] = React.useState<string | null>(null);

  // --- セット提案（マップ＋セットアップ、2026-07-24） ---
  const [pairMapId, setPairMapId] = React.useState<string>("");
  const [criterion, setCriterion] = React.useState<RecommendCriterion>("opposeMap");
  const [rec, setRec] = React.useState<Recommendation | null>(null);
  const [recMapTop, setRecMapTop] = React.useState<Array<{ id: FactionId; score: number }> | null>(null);
  const [recSettings, setRecSettings] = React.useState<{ players: number; lf: boolean } | null>(null);
  const [pairMsg, setPairMsg] = React.useState<string | null>(null);
  const [recorded, setRecorded] = React.useState(false);
  // 共有されたセット（/list?h=&t=&s=）。捕捉は初回のみ（Strict Mode二重実行対応）。
  const pairCapturedRef = React.useRef(false);
  const [pairShared, setPairShared] = React.useState<{
    placement: any[];
    templateId: string;
    input: BuildSetupInput;
  } | null>(null);

  // 復元は読み取りのみ（書込みはユーザー操作ハンドラのみの規律）。
  React.useEffect(() => {
    const v = (() => {
      try {
        return localStorage.getItem("gaia_ui_lang");
      } catch {
        return null;
      }
    })();
    if (v === "ja" || v === "en") setLang(v);

    let alive = true;
    void (async () => {
      try {
        const db = await openDb();
        const all = await idbGetAllFromStore<PersistedCandidate>(db, STORE_CANDIDATES);
        const pins = all
          .filter((c) => c.pinned)
          .sort((a, b) => (b.pinnedAt ?? 0) - (a.pinnedAt ?? 0));
        const profiles = await loadProfilesFromDb(500);
        const tmap: Record<string, string> = {};
        for (const p of profiles) {
          const tid = String(p.templateId ?? (p.params as any)?.templateId ?? "");
          if (tid) tmap[p.searchKey] = tid;
        }
        if (alive) {
          setPinnedMaps(pins);
          setTemplateIdBySearchKey(tmap);
        }
      } catch {
        // ignore
      }
      try {
        const rows = await listSavedSetups();
        if (alive) setPinnedSetups(rows.filter((r) => r.pinned));
      } catch {
        // ignore
      }
    })();
    // 共有されたセット（?h=&t=&s=）を捕捉してURLを浄化（?h=/?s=と同じ作法）
    try {
      if (!pairCapturedRef.current) {
        pairCapturedRef.current = true;
        const sp = new URLSearchParams(window.location.search);
        const h = sp.get("h");
        const tid = sp.get("t");
        const s = sp.get("s");
        if (h !== null || s !== null || tid !== null) {
          sp.delete("h");
          sp.delete("t");
          sp.delete("s");
          const qs = sp.toString();
          window.history.replaceState(null, "", window.location.pathname + (qs ? `?${qs}` : ""));
          const placement = h ? decodePlacementToken(h) : null;
          const input = s ? decodeSetupToken(s) : null;
          if (placement && tid && input && TEMPLATE_BY_ID[tid]) {
            setPairShared({ placement, templateId: tid, input });
          }
        }
      }
    } catch {
      // ignore
    }

    return () => {
      alive = false;
    };
  }, []);

  const sectorById = React.useMemo(() => buildSectorLookup(getAllSectors() as any), []);
  const sectorImgById = React.useMemo(() => buildSectorImgById(), []);

  const t = UI[lang];

  const setLangPersist = React.useCallback((l: Lang) => {
    setLang(l);
    try {
      localStorage.setItem("gaia_ui_lang", l);
    } catch {
      // ignore
    }
  }, []);

  const flashCopied = React.useCallback((key: string, text: string) => {
    copyText(text);
    setCopiedKey(key);
    window.setTimeout(() => setCopiedKey((v) => (v === key ? null : v)), 2000);
  }, []);

  const unpinMap = React.useCallback(async (c: PersistedCandidate) => {
    try {
      const db = await openDb();
      await idbPutAll(db, STORE_CANDIDATES, [
        { ...c, pinned: false, pinnedAt: undefined, updatedAt: Date.now() },
      ]);
      setPinnedMaps((prev) => prev.filter((x) => x.id !== c.id));
    } catch {
      // ignore
    }
  }, []);

  const unpinSetup = React.useCallback(async (id: string) => {
    const rows = await setSetupPinned(id, false);
    setPinnedSetups(rows.filter((r) => r.pinned));
  }, []);

  const mapToken = React.useCallback((c: PersistedCandidate): string => {
    try {
      return encodePlacementToken(c.placement as any);
    } catch {
      return "";
    }
  }, []);

  // セット提案の生成（1件のみ提示。要望 2026-07-24）
  const handleGenerate = React.useCallback(() => {
    const selected = pinnedMaps.find((c) => c.id === pairMapId) ?? null;
    const tid = selected ? (templateIdBySearchKey[selected.searchKey] ?? null) : null;
    if (criterion === "opposeMap" && (!selected || !tid)) {
      setPairMsg(UI[lang].needMap);
      setRec(null);
      return;
    }
    setPairMsg(null);
    let mapTop3: FactionId[] | undefined;
    let mapTopDetail: Array<{ id: FactionId; score: number }> | null = null;
    if (selected && tid) {
      try {
        const ms = mapFactionScores(tid, selected.placement ?? []);
        mapTop3 = topFactions(ms, 3);
        mapTopDetail = mapTop3.map((f) => ({ id: f, score: ms[f] }));
      } catch {
        if (criterion === "opposeMap") {
          setPairMsg(UI[lang].needMap);
          setRec(null);
          return;
        }
      }
    }
    const settings = deriveSetupSettings(tid);
    const seeds = Array.from({ length: 200 }, () =>
      String(Math.floor(Math.random() * 2147483647) + 1)
    );
    const r = recommendSetup({
      criterion,
      seeds,
      playerCount: settings.players,
      lostFleet: settings.lf,
      ...(mapTop3 ? { mapTop3 } : {}),
    });
    setRec(r);
    setRecMapTop(mapTopDetail);
    setRecSettings(settings);
    setRecorded(false);
  }, [pinnedMaps, pairMapId, criterion, templateIdBySearchKey, lang]);

  const handleRecordRec = React.useCallback(() => {
    if (!rec) return;
    void recordSetup(rec.input).then((rows) => {
      setPinnedSetups(rows.filter((r) => r.pinned));
      setRecorded(true);
    });
  }, [rec]);

  return (
    <div style={{ padding: 12, display: "flex", flexDirection: "column", gap: 14, maxWidth: 1100 }}>
      <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
        <div style={{ fontWeight: 700, fontSize: 16 }}>{t.title}</div>
        <div style={{ fontSize: 11, opacity: 0.6 }}>{t.note}</div>
        <div style={{ display: "flex", gap: 6, alignItems: "center", marginLeft: "auto", fontSize: 12 }}>
          <label style={{ display: "flex", gap: 4, alignItems: "center" }}>
            <input type="radio" name="listLang" checked={lang === "en"} onChange={() => setLangPersist("en")} />
            EN
          </label>
          <label style={{ display: "flex", gap: 4, alignItems: "center" }}>
            <input type="radio" name="listLang" checked={lang === "ja"} onChange={() => setLangPersist("ja")} />
            日本語
          </label>
        </div>
      </div>

      {/* Shared pair (?h=&t=&s=) */}
      {pairShared
        ? (() => {
            const template = TEMPLATE_BY_ID[pairShared.templateId];
            const bToken = (() => {
              try {
                return encodePlacementToken(pairShared.placement as any);
              } catch {
                return "";
              }
            })();
            const sToken = encodeSetupToken(pairShared.input);
            const scores = scoreSetupFactions(buildSetupFromSeed(pairShared.input));
            const lfShared = pairShared.input.mode === "lostFleet";
            return (
              <section
                style={{ border: "1px solid #7aa7e8", background: "#f2f7ff", borderRadius: 8, padding: 10 }}
              >
                <div style={{ fontWeight: 700, marginBottom: 6 }}>{t.sharedPairTitle}</div>
                <div style={{ display: "flex", gap: 14, flexWrap: "wrap", alignItems: "flex-start" }}>
                  <div style={{ width: 300, display: "flex", flexDirection: "column", gap: 6 }}>
                    {template ? (
                      <div style={{ pointerEvents: "none" }}>
                        <MapBoardViewer
                          template={template as any}
                          placement={pairShared.placement as PlacementItem[]}
                          sectorById={sectorById as any}
                          sectorImgById={sectorImgById}
                          imgOffsetBySlotId={IMG_OFFSET_BY_SLOT as any}
                          rotOffsetsBySlotId={ROT_OFFSETS_BY_SLOT as any}
                          scaleByAccepts={{ LARGE: 1.02, MIDDLE: 0.93, SMALL: 1.1 }}
                          boundsPad={40}
                          zoom={1.0}
                          showToolbar={false}
                          disablePan
                        />
                      </div>
                    ) : (
                      <div style={{ fontSize: 12, opacity: 0.6 }}>{t.unknownTemplate}</div>
                    )}
                    {bToken ? (
                      <Link href={`/board?h=${bToken}`} style={{ fontSize: 12 }}>
                        {t.openBoard}
                      </Link>
                    ) : null}
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 12, minWidth: 260 }}>
                    <div>
                      <span style={{ opacity: 0.7 }}>{t.seed}:</span>{" "}
                      <span style={{ fontFamily: "monospace", fontWeight: 700 }}>{pairShared.input.seed}</span>
                      {" ・ "}
                      {lfShared ? t.modeLF : t.modeBase}
                      {" ・ "}
                      {t.players}: {pairShared.input.playerCount ?? 4}
                    </div>
                    <div>
                      <span style={{ opacity: 0.7 }}>{t.setupStrong}:</span> {topFactionText(scores, 5, lang)}
                    </div>
                    <Link href={`/setup?s=${sToken}`} style={{ fontSize: 12 }}>
                      {t.openSetup}
                    </Link>
                  </div>
                </div>
              </section>
            );
          })()
        : null}

      {/* Pair proposal (map -> recommended setup) */}
      <section>
        <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 6, flexWrap: "wrap" }}>
          <div style={{ fontWeight: 700 }}>{t.pairTitle}</div>
          <div style={{ fontSize: 11, opacity: 0.6 }}>{t.pairNote}</div>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", fontSize: 12 }}>
          <label style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <span>{t.pairMap}</span>
            <select
              value={pairMapId}
              onChange={(e) => {
                setPairMapId(e.target.value);
                setRec(null);
                setPairMsg(null);
              }}
              style={{ maxWidth: 260 }}
            >
              <option value="">{t.pairNoMap}</option>
              {pinnedMaps.map((c) => (
                <option key={c.id} value={c.id}>
                  {templateMeta(templateIdBySearchKey[c.searchKey] ?? "", t)} / {Math.round(Number(c.score))} /{" "}
                  {String(c.placementHash ?? "").slice(0, 8)}
                </option>
              ))}
            </select>
          </label>
          <label style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <span>{t.pairCriterion}</span>
            <select
              value={criterion}
              onChange={(e) => {
                setCriterion(e.target.value as RecommendCriterion);
                setRec(null);
                setPairMsg(null);
              }}
              style={{ maxWidth: 280 }}
            >
              <option value="opposeMap">{t.crit1}</option>
              <option value="topBalance">{t.crit2}</option>
              <option value="neutralBalance">{t.crit3}</option>
            </select>
          </label>
          <button onClick={handleGenerate} style={{ padding: "3px 12px", fontWeight: 700 }}>
            {rec ? t.regenerate : t.generate}
          </button>
          {pairMsg ? <span style={{ color: "#b3261e" }}>{pairMsg}</span> : null}
        </div>
        {rec && recSettings
          ? (() => {
              const selected = pinnedMaps.find((c) => c.id === pairMapId) ?? null;
              const tid = selected ? (templateIdBySearchKey[selected.searchKey] ?? null) : null;
              const sToken = encodeSetupToken(rec.input);
              const pairPath =
                selected && tid
                  ? `/list?h=${mapToken(selected)}&t=${tid}&s=${sToken}`
                  : `/setup?s=${sToken}`;
              return (
                <div
                  style={{
                    marginTop: 8,
                    border: "1px solid #ddd",
                    background: "#fafafa",
                    borderRadius: 8,
                    padding: "8px 10px",
                    display: "flex",
                    flexDirection: "column",
                    gap: 6,
                    fontSize: 12,
                  }}
                >
                  <div>
                    <span style={{ opacity: 0.7 }}>{t.seed}:</span>{" "}
                    <span style={{ fontFamily: "monospace", fontWeight: 700 }}>{rec.input.seed}</span>
                    {" ・ "}
                    {recSettings.lf ? t.modeLF : t.modeBase}
                    {" ・ "}
                    {t.players}: {recSettings.players}
                    {" ・ "}
                    <span style={{ opacity: 0.55 }}>{t.trialsNote}</span>
                  </div>
                  {recMapTop ? (
                    <div>
                      <span style={{ opacity: 0.7 }}>{t.mapStrong}:</span>{" "}
                      {recMapTop
                        .map((x) => `${factionLabel(x.id, lang)} ${Math.round(x.score * 10) / 10}`)
                        .join(" / ")}
                    </div>
                  ) : null}
                  <div>
                    <span style={{ opacity: 0.7 }}>{t.setupStrong}:</span>{" "}
                    {topFactionText(rec.setupScores, 5, lang)}
                  </div>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    <Link
                      href={`/setup?s=${sToken}`}
                      style={{
                        fontSize: 11,
                        padding: "2px 8px",
                        border: "1px solid #ccc",
                        borderRadius: 6,
                        background: "white",
                        textDecoration: "none",
                        color: "#333",
                      }}
                    >
                      {t.openSetup}
                    </Link>
                    <button
                      onClick={() => flashCopied("pair", `${window.location.origin}${pairPath}`)}
                      style={{ fontSize: 11 }}
                    >
                      {copiedKey === "pair" ? t.shareCopied : t.sharePair}
                    </button>
                    <button onClick={handleRecordRec} style={{ fontSize: 11 }} disabled={recorded}>
                      {recorded ? t.recorded : t.recordToList}
                    </button>
                  </div>
                </div>
              );
            })()
          : null}
      </section>

      {/* Pinned maps */}
      <section>
        <div style={{ fontWeight: 700, marginBottom: 6 }}>
          {t.maps} ({pinnedMaps.length})
        </div>
        {pinnedMaps.length === 0 ? (
          <div style={{ fontSize: 12, opacity: 0.6 }}>{t.emptyMaps}</div>
        ) : (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "flex-start" }}>
            {pinnedMaps.map((c) => {
              const tid = templateIdBySearchKey[c.searchKey] ?? "";
              const template = TEMPLATE_BY_ID[tid];
              const token = mapToken(c);
              const href = token ? `/board?h=${token}` : "/board";
              const key = `map:${c.id}`;
              return (
                <div
                  key={c.id}
                  style={{
                    border: "1px solid #ddd",
                    borderRadius: 8,
                    padding: 8,
                    width: 300,
                    display: "flex",
                    flexDirection: "column",
                    gap: 6,
                    background: "#fafafa",
                  }}
                >
                  {template ? (
                    <Link href={href} title={t.open} style={{ display: "block", pointerEvents: "auto" }}>
                      {/* ミニ描画: 操作不要のため pan 無効・ツールバー非表示 */}
                      <div style={{ width: "100%", pointerEvents: "none" }}>
                        <MapBoardViewer
                          template={template as any}
                          placement={(c.placement ?? []) as PlacementItem[]}
                          sectorById={sectorById as any}
                          sectorImgById={sectorImgById}
                          imgOffsetBySlotId={IMG_OFFSET_BY_SLOT as any}
                          rotOffsetsBySlotId={ROT_OFFSETS_BY_SLOT as any}
                          scaleByAccepts={{ LARGE: 1.02, MIDDLE: 0.93, SMALL: 1.1 }}
                          boundsPad={40}
                          zoom={1.0}
                          showToolbar={false}
                          disablePan
                        />
                      </div>
                    </Link>
                  ) : (
                    <div style={{ fontSize: 12, opacity: 0.6 }}>{t.unknownTemplate}</div>
                  )}
                  <div style={{ display: "flex", gap: 8, alignItems: "baseline", flexWrap: "wrap", fontSize: 12 }}>
                    <span>📌</span>
                    <span>{templateMeta(tid, t)}</span>
                    <span>
                      <span style={{ opacity: 0.7 }}>{t.score}:</span> {Math.round(Number(c.score))}
                    </span>
                    <span style={{ fontFamily: "monospace", opacity: 0.8 }}>
                      {String(c.placementHash ?? "").slice(0, 8)}
                    </span>
                    {c.used ? <span style={{ opacity: 0.7 }}>{t.used}</span> : null}
                    <span style={{ opacity: 0.55, marginLeft: "auto" }}>{fmtWhen(c.pinnedAt, lang)}</span>
                  </div>
                  <div style={{ display: "flex", gap: 4 }}>
                    <Link
                      href={href}
                      style={{
                        fontSize: 11,
                        padding: "2px 8px",
                        border: "1px solid #ccc",
                        borderRadius: 6,
                        background: "white",
                        textDecoration: "none",
                        color: "#333",
                      }}
                    >
                      {t.open}
                    </Link>
                    <button
                      onClick={() => flashCopied(key, `${window.location.origin}${href}`)}
                      style={{ fontSize: 11 }}
                      disabled={!token}
                    >
                      {copiedKey === key ? t.shareCopied : t.share}
                    </button>
                    <button onClick={() => void unpinMap(c)} style={{ fontSize: 11, marginLeft: "auto" }}>
                      {t.unpin}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Pinned setups */}
      <section>
        <div style={{ fontWeight: 700, marginBottom: 6 }}>
          {t.setups} ({pinnedSetups.length})
        </div>
        {pinnedSetups.length === 0 ? (
          <div style={{ fontSize: 12, opacity: 0.6 }}>{t.emptySetups}</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {pinnedSetups.map((r) => {
              const path = `/setup?s=${encodeSetupToken(r.input)}`;
              const key = `setup:${r.id}`;
              const nAvoid = r.input.avoidRules?.length ?? 0;
              const nForce =
                (r.input.forceRules?.length ?? 0) + Object.keys(r.input.forceTileRules ?? {}).length;
              return (
                <div
                  key={r.id}
                  style={{
                    display: "flex",
                    gap: 8,
                    alignItems: "center",
                    border: "1px solid #ddd",
                    background: "#fafafa",
                    borderRadius: 8,
                    padding: "4px 8px",
                    fontSize: 12,
                    flexWrap: "wrap",
                  }}
                >
                  <span>📌</span>
                  <span style={{ fontFamily: "monospace", fontWeight: 700 }}>{r.input.seed}</span>
                  <span>{r.input.mode === "lostFleet" ? t.modeLF : t.modeBase}</span>
                  <span>
                    {t.players}: {r.input.playerCount ?? 4}
                  </span>
                  {nAvoid + nForce > 0 ? (
                    <span style={{ opacity: 0.7 }}>⚙{nAvoid + nForce}</span>
                  ) : null}
                  {r.used ? <span style={{ opacity: 0.7 }}>{t.used}</span> : null}
                  <span style={{ opacity: 0.55 }}>{fmtWhen(r.createdAt, lang)}</span>
                  <div style={{ display: "flex", gap: 4, marginLeft: "auto" }}>
                    <Link
                      href={path}
                      style={{
                        fontSize: 11,
                        padding: "2px 8px",
                        border: "1px solid #ccc",
                        borderRadius: 6,
                        background: "white",
                        textDecoration: "none",
                        color: "#333",
                      }}
                    >
                      {t.open}
                    </Link>
                    <button
                      onClick={() => flashCopied(key, `${window.location.origin}${path}`)}
                      style={{ fontSize: 11 }}
                    >
                      {copiedKey === key ? t.shareCopied : t.share}
                    </button>
                    <button onClick={() => void unpinSetup(r.id)} style={{ fontSize: 11 }}>
                      {t.unpin}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
