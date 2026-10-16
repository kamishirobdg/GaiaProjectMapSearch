// src/components/ManualView.tsx
//
// アプリ内マニュアル（/manual。2026-10-16 ユーザー決定: 置き場所はアプリ内、入口は共通バーのタブ、日英）。
// 本文は manualContent.ts（同日の指示で「使い方と設定項目」だけに。設計の経緯や設計ノートの参照は載せない）。共通バー（人数・拡張・言語）は他のタブと同じ位置に出し、人数・拡張は共有設定に書く。
// 目次は章へのページ内リンク。狭い幅でも 1 カラムで読めるよう、表は横スクロールの内包にする。

"use client";

import React from "react";
import GlobalBar from "@/components/GlobalBar";
import { PageBody, T } from "@/components/ui/layout";
import { MANUAL, type ManualBlock } from "@/components/manualContent";
import {
  readSharedExpansion,
  readSharedPlayers,
  writeSharedExpansion,
  writeSharedPlayers,
  type Expansion,
} from "@/lib/sharedSettings";

type Lang = "ja" | "en";

function Block({ b }: { b: ManualBlock }) {
  if ("h3" in b) {
    return <h3 style={{ fontSize: 14, fontWeight: 700, margin: "14px 0 4px" }}>{b.h3}</h3>;
  }
  if ("p" in b) {
    return <p style={{ margin: "6px 0", lineHeight: 1.65 }}>{b.p}</p>;
  }
  if ("ul" in b) {
    return (
      <ul style={{ margin: "6px 0", paddingLeft: 20, lineHeight: 1.65 }}>
        {b.ul.map((s, i) => (
          <li key={i} style={{ marginBottom: 3 }}>
            {s}
          </li>
        ))}
      </ul>
    );
  }
  if ("table" in b) {
    const cell: React.CSSProperties = { border: "1px solid #ddd", padding: "4px 6px", verticalAlign: "top", lineHeight: 1.5 };
    return (
      <div style={{ overflowX: "auto", margin: "6px 0" }}>
        <table style={{ borderCollapse: "collapse", fontSize: 12 }}>
          <thead>
            <tr>
              {b.table.head.map((h, i) => (
                <th key={i} style={{ ...cell, background: "#fafafa", textAlign: "left", whiteSpace: "nowrap" }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {b.table.rows.map((row, ri) => (
              <tr key={ri}>
                {row.map((c, ci) => (
                  <td key={ci} style={cell}>
                    {c}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }
  return null;
}

export default function ManualView() {
  const [lang, setLang] = React.useState<Lang>("ja");
  const [players, setPlayers] = React.useState(4);
  const [expansion, setExpansion] = React.useState<Expansion>("lostFleet");

  // 共有設定と言語の復元（他のタブと同じ作法。書き込みは操作ハンドラのみ）
  React.useEffect(() => {
    try {
      const l = localStorage.getItem("gaia_ui_lang");
      if (l === "ja" || l === "en") setLang(l);
      const p = readSharedPlayers();
      if (p != null) setPlayers(p);
      const e = readSharedExpansion();
      if (e != null) setExpansion(e);
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

  const m = MANUAL[lang];

  return (
    <>
      <GlobalBar active="manual" players={players} expansion={expansion} onSelect={onGlobalSelect} lang={lang} onLang={setLangPersist} />
      <PageBody>
        <div style={{ maxWidth: 900, fontSize: 13 }}>
          <div style={{ fontWeight: 700, fontSize: 16 }}>{m.title}</div>
          <p style={{ margin: "6px 0 10px", fontSize: 12, color: T.fgMuted, lineHeight: 1.6 }}>{m.intro}</p>

          <nav aria-label={m.toc} style={{ border: T.borderSoft, borderRadius: T.radius, padding: "8px 12px", background: T.bgPanel, marginBottom: 14 }}>
            <div style={{ fontWeight: 700, fontSize: 12, marginBottom: 4 }}>{m.toc}</div>
            <ol style={{ margin: 0, paddingLeft: 18, fontSize: 12, lineHeight: 1.8, listStyle: "none" }}>
              {m.chapters.map((c) => (
                <li key={c.id}>
                  <a href={`#manual-${c.id}`} style={{ color: "#2733cc", textDecoration: "none" }}>
                    {c.title}
                  </a>
                </li>
              ))}
            </ol>
          </nav>

          {m.chapters.map((c) => (
            <section key={c.id} id={`manual-${c.id}`} style={{ marginBottom: 22, scrollMarginTop: 60 }}>
              <h2 style={{ fontSize: 15, fontWeight: 700, margin: "0 0 6px", paddingBottom: 4, borderBottom: "1px solid #ddd" }}>{c.title}</h2>
              {c.blocks.map((b, i) => (
                <Block key={i} b={b} />
              ))}
            </section>
          ))}
        </div>
      </PageBody>
    </>
  );
}
