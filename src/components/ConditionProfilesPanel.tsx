// src/components/ConditionProfilesPanel.tsx
//
// Setup / List の「保存済み条件」パネル。Map（/board）の同名パネルと同じ操作を
// 共通部品にしたもの（2026-07-30）。両タブで同じ見た目・同じ操作になるように、
// 実装はここ1か所だけにしてある。
//
// 操作は Map と揃える:
//   条件を適用 / 名前を付ける / メタ削除（条件だけ消す）/ 全削除（結果ごと消す）
//   ＋ 既定値で新規（条件を初期値に戻し、自動適用のポインタも消す）
"use client";

import React from "react";
import type { ConditionProfile } from "@/lib/conditionProfiles";
import { T } from "@/components/ui/layout";

type Lang = "ja" | "en";

const UI = {
  ja: {
    title: "保存済み条件",
    note: "条件ごとに結果が分かれて貯まります",
    empty: "まだ条件が保存されていません",
    current: "使用中",
    apply: "条件を適用",
    rename: "名前",
    save: "保存",
    cancel: "取消",
    unnamed: "(名前なし)",
    recommended: "推奨条件",
    recommendedTip: "評価指数もルールも既定値のままの条件です",
    blocked: "他のタブでこのアプリを開いたままだと保存領域を更新できません。他のタブを閉じて再読み込みしてください。",
    deleteMeta: "条件だけ削除",
    deleteAll: "結果ごと削除",
    reset: "既定値で新規",
    resetTip: "条件を初期値に戻します。保存済みの結果は消えません。",
    results: "結果",
    filter: "絞り込み",
    filterPlaceholder: "名前・条件で絞り込み",
    clear: "クリア",
    confirmDeleteMeta: "この条件（名前・設定）を削除します。結果は残ります。よろしいですか？",
    confirmDeleteAll: "この条件と、その条件で貯めた結果をすべて削除します。よろしいですか？",
    confirmReset: "条件を既定値に戻します。よろしいですか？",
  },
  en: {
    title: "Saved conditions",
    note: "Results are bucketed per condition",
    empty: "No conditions saved yet",
    current: "In use",
    apply: "Apply",
    rename: "Name",
    save: "Save",
    cancel: "Cancel",
    unnamed: "(unnamed)",
    recommended: "Recommended",
    recommendedTip: "Every rule and eval weight is still at its default",
    blocked: "Another tab has this app open, so the storage cannot be upgraded. Close the other tabs and reload.",
    deleteMeta: "Delete condition only",
    deleteAll: "Delete with results",
    reset: "Start fresh (defaults)",
    resetTip: "Reset the conditions to their defaults. Saved results are kept.",
    results: "results",
    filter: "Filter",
    filterPlaceholder: "Filter by name or condition",
    clear: "Clear",
    confirmDeleteMeta: "Delete this condition (name and settings)? Its results are kept.",
    confirmDeleteAll: "Delete this condition AND every result saved under it?",
    confirmReset: "Reset the conditions to their defaults?",
  },
} as const;

export default function ConditionProfilesPanel<P>({
  profiles,
  currentKey,
  lang,
  summarize,
  isDefaultParams,
  blocked,
  onApply,
  onRename,
  onDeleteMeta,
  onDeleteAll,
  onResetDefaults,
}: {
  profiles: Array<ConditionProfile<P>>;
  /** いま画面で使っている条件のキー（該当行に「使用中」を出す） */
  currentKey: string | null;
  lang: Lang;
  /** 1行ぶんの条件の要約テキスト */
  summarize: (params: P) => string;
  /**
   * その条件が「既定値のまま」かを返す。true の行は名前が無くても
   * 「推奨条件」と出す（既定値を変えても常に今の既定と比べる）。
   */
  isDefaultParams?: (params: P) => boolean;
  /** 別タブに阻まれて保存領域を更新できない状態か */
  blocked?: boolean;
  onApply: (p: ConditionProfile<P>) => void;
  onRename: (key: string, name: string | null) => void;
  onDeleteMeta: (key: string) => void;
  onDeleteAll: (key: string) => void;
  onResetDefaults: () => void;
}) {
  const t = UI[lang];
  const [editingKey, setEditingKey] = React.useState<string | null>(null);
  const [editingName, setEditingName] = React.useState("");
  const [query, setQuery] = React.useState("");

  const rows = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return profiles;
    return profiles.filter((p) => {
      const hay = `${p.name ?? ""} ${summarize(p.params)}`.toLowerCase();
      return hay.includes(q);
    });
  }, [profiles, query, summarize]);

  const btn: React.CSSProperties = { padding: "4px 8px", fontSize: 11 };

  return (
    <section style={{ border: T.border, borderRadius: T.radius, padding: T.pad, background: "white" }}>
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginBottom: 8 }}>
        <div style={{ fontWeight: 700, fontSize: T.fontHead }}>{t.title}</div>
        <div style={{ fontSize: T.fontNote, color: T.fgMuted }}>{t.note}</div>
        <button
          onClick={() => {
            if (!confirm(t.confirmReset)) return;
            onResetDefaults();
          }}
          title={t.resetTip}
          style={{ ...btn, fontWeight: 700 }}
        >
          {t.reset}
        </button>
        <div style={{ marginLeft: "auto", display: "flex", gap: 6, alignItems: "center" }}>
          <span style={{ fontSize: T.fontNote, color: T.fgMuted }}>{t.filter}</span>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t.filterPlaceholder}
            style={{ width: 220, maxWidth: "60vw", fontSize: 12, padding: "3px 6px" }}
          />
          <button onClick={() => setQuery("")} style={btn}>
            {t.clear}
          </button>
        </div>
      </div>

      {blocked ? (
        <div
          style={{
            fontSize: T.fontBody,
            color: "#b3261e",
            background: "#fff2f0",
            border: "1px solid #f3c8c2",
            borderRadius: 6,
            padding: "6px 8px",
            marginBottom: 8,
          }}
        >
          {t.blocked}
        </div>
      ) : null}

      {rows.length === 0 ? (
        <div style={{ fontSize: T.fontBody, color: T.fgMuted }}>{t.empty}</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {rows.map((p) => {
            const isCurrent = p.key === currentKey;
            const editing = editingKey === p.key;
            return (
              <div
                key={p.key}
                style={{
                  border: isCurrent ? "1px solid #7aa7e8" : T.border,
                  background: isCurrent ? "#f2f7ff" : T.bgPanel,
                  borderRadius: T.radius,
                  padding: "6px 8px",
                  display: "flex",
                  gap: 10,
                  alignItems: "center",
                  flexWrap: "wrap",
                }}
              >
                <div style={{ flex: "1 1 420px", minWidth: 240 }}>
                  <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                    {editing ? (
                      <>
                        <input
                          value={editingName}
                          onChange={(e) => setEditingName(e.target.value)}
                          style={{ width: 220, fontSize: 12, padding: "3px 6px" }}
                        />
                        <button
                          onClick={() => {
                            const n = editingName.trim();
                            onRename(p.key, n ? n : null);
                            setEditingKey(null);
                          }}
                          style={btn}
                        >
                          {t.save}
                        </button>
                        <button onClick={() => setEditingKey(null)} style={btn}>
                          {t.cancel}
                        </button>
                      </>
                    ) : (
                      <>
                        {p.name ? (
                          <span style={{ fontSize: 12, fontWeight: 700 }}>{p.name}</span>
                        ) : isDefaultParams?.(p.params) ? (
                          <span
                            title={t.recommendedTip}
                            style={{
                              fontSize: 12,
                              fontWeight: 700,
                              color: "#1b6b2f",
                              background: "#e7f6ea",
                              border: "1px solid #b8e0c2",
                              borderRadius: 5,
                              padding: "1px 6px",
                            }}
                          >
                            {t.recommended}
                          </span>
                        ) : (
                          <span style={{ fontSize: 12, fontWeight: 700 }}>{t.unnamed}</span>
                        )}
                        <button
                          onClick={() => {
                            setEditingKey(p.key);
                            setEditingName(p.name ?? "");
                          }}
                          style={btn}
                        >
                          {t.rename}
                        </button>
                        {isCurrent ? (
                          <span style={{ fontSize: 11, color: "#3467c4", fontWeight: 700 }}>{t.current}</span>
                        ) : null}
                      </>
                    )}
                  </div>
                  <div style={{ fontSize: 11, color: T.fgMuted, marginTop: 2 }} title={p.key}>
                    {summarize(p.params)}
                  </div>
                  <div style={{ fontSize: 11, color: T.fgMuted, marginTop: 2 }}>
                    {t.results}: {p.resultCount}
                  </div>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 4, marginLeft: "auto" }}>
                  <button onClick={() => onApply(p)} style={{ padding: "5px 10px", fontSize: 12 }}>
                    {t.apply}
                  </button>
                  <button
                    onClick={() => {
                      if (!confirm(t.confirmDeleteMeta)) return;
                      onDeleteMeta(p.key);
                    }}
                    style={btn}
                  >
                    {t.deleteMeta}
                  </button>
                  <button
                    onClick={() => {
                      if (!confirm(t.confirmDeleteAll)) return;
                      onDeleteAll(p.key);
                    }}
                    style={btn}
                  >
                    {t.deleteAll}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
