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
import { encodePlacementToken } from "@/gaia/ssot/placementHash";
import {
  buildSectorImgById,
  getAllSectors,
  IMG_OFFSET_BY_SLOT,
  ROT_OFFSETS_BY_SLOT,
  TEMPLATE_BY_ID,
} from "@/gaia/board/viewerAssets";
import { buildSectorLookup } from "@/gaia/board/previewBoard";
import { listSavedSetups, setSetupPinned, type SavedSetup } from "@/lib/setupHistory";
import { copyText, encodeSetupToken } from "@/lib/setupShare";

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
  },
} as const;

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
