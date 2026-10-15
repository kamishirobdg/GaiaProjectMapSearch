// src/components/ui/HelpPopover.tsx
//
// 項目の横に置く「?」と、タップ／クリック／ホバーで開く小窓（2026-10-15 ユーザー確定 1-(a) 〜 5-(a)）。
//
// 経緯: Map 画面の説明はブラウザ標準の title ツールチップ（点線下線の Hint）で出していたが、
// タッチ端末では表示されず、ユーザーの本番確認（Android）では読めていなかった。
// title は小窓に置き換えて外す（PC で同じ説明が二重に出ないように）。
//
// 開き方:
//   - 「?」をタップ／クリックで開閉（固定）。小窓の外のタップ・Escape で閉じる。
//   - マウスのホバーで一時的に開き、離れると閉じる（タッチのホバー模倣は pointerType で除外）。
// 置き場所: position: fixed で「?」の直下（画面の下端に掛かるときは直上）。横は画面内に収める。
//   条件ペインは overflow: auto の内包スクロールなので、absolute だと枠に切られる。
// 中身: 見出し（項目名）／何を測るか／既定値の根拠／設計ノートの節番号（任意）。

"use client";

import React from "react";

export type HelpContent = {
  /** 小窓の見出し（項目名） */
  title: string;
  /** 何を測っているか（1 行） */
  what: string;
  /** 既定値の根拠・設計意図（1〜2 行）。無ければ出さない */
  why?: string;
  /** 設計ノート（docs/design-notes.md）の節番号。例 "2.8" */
  ref?: string;
};

export type HelpLabels = {
  /** 「?」の aria-label */
  open: string;
  /** 「既定値の根拠」の見出し */
  why: string;
  /** 「設計ノート」の見出し */
  ref: string;
};

export const HELP_LABELS: Record<"ja" | "en", HelpLabels> = {
  ja: { open: "説明を開く", why: "既定値の根拠", ref: "設計ノート" },
  en: { open: "Show help", why: "Why this default", ref: "Design notes" },
};

const POP_WIDTH = 320;
const POP_MARGIN = 8;
/** 下に開くときに必要とみなす高さ。足りなければ上に開く */
const POP_MIN_HEIGHT = 220;

type Pos = { left: number; top?: number; bottom?: number; width: number };

function placeNear(rect: DOMRect): Pos {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const width = Math.min(POP_WIDTH, vw - POP_MARGIN * 2);
  const left = Math.max(POP_MARGIN, Math.min(rect.left, vw - width - POP_MARGIN));
  const below = rect.bottom + 6;
  if (below + POP_MIN_HEIGHT <= vh || rect.top < vh / 2) {
    return { left, top: below, width };
  }
  return { left, bottom: vh - rect.top + 6, width };
}

export function HelpPopover({
  content,
  labels,
  size = 15,
}: {
  content: HelpContent;
  labels: HelpLabels;
  /** 「?」の直径（px） */
  size?: number;
}) {
  const [open, setOpen] = React.useState(false);
  // クリックで開いたか（ホバーで開いただけなら離れたときに閉じる）
  const [pinned, setPinned] = React.useState(false);
  const [pos, setPos] = React.useState<Pos | null>(null);
  const btnRef = React.useRef<HTMLButtonElement | null>(null);
  const popRef = React.useRef<HTMLDivElement | null>(null);

  const show = React.useCallback(() => {
    const el = btnRef.current;
    if (el) setPos(placeNear(el.getBoundingClientRect()));
    setOpen(true);
  }, []);
  const hide = React.useCallback(() => {
    setOpen(false);
    setPinned(false);
  }, []);

  // 小窓の外のタップ／クリックと Escape で閉じる（固定で開いているときだけ）
  React.useEffect(() => {
    if (!open) return;
    const onDown = (e: Event) => {
      const t = e.target as Node | null;
      if (popRef.current?.contains(t) || btnRef.current?.contains(t)) return;
      hide();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") hide();
    };
    document.addEventListener("pointerdown", onDown, true);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown, true);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, hide]);

  // スクロール・リサイズで位置がずれるので閉じる
  React.useEffect(() => {
    if (!open) return;
    const onMove = () => hide();
    window.addEventListener("scroll", onMove, true);
    window.addEventListener("resize", onMove);
    return () => {
      window.removeEventListener("scroll", onMove, true);
      window.removeEventListener("resize", onMove);
    };
  }, [open, hide]);

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        aria-label={labels.open}
        aria-expanded={open}
        onClick={(e) => {
          // label の中に置くので、label の onClick（マーカー）や input へのフォーカス移動を起こさない
          e.preventDefault();
          e.stopPropagation();
          if (open && pinned) {
            hide();
          } else {
            setPinned(true);
            show();
          }
        }}
        onPointerEnter={(e) => {
          if (e.pointerType !== "mouse" || open) return;
          show();
        }}
        onPointerLeave={(e) => {
          if (e.pointerType !== "mouse" || pinned) return;
          setOpen(false);
        }}
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          width: size,
          height: size,
          minWidth: size,
          padding: 0,
          marginLeft: 4,
          borderRadius: "50%",
          border: "1px solid #9aa4b8",
          background: open ? "#4453ff" : "#fff",
          color: open ? "#fff" : "#4453ff",
          fontSize: Math.round(size * 0.7),
          fontWeight: 700,
          lineHeight: 1,
          cursor: "pointer",
          verticalAlign: "middle",
          flex: "0 0 auto",
        }}
      >
        ?
      </button>
      {open && pos ? (
        <div
          ref={popRef}
          role="dialog"
          aria-label={content.title}
          onClick={(e) => e.stopPropagation()}
          onPointerEnter={(e) => {
            if (e.pointerType !== "mouse") return;
            setOpen(true);
          }}
          onPointerLeave={(e) => {
            if (e.pointerType !== "mouse" || pinned) return;
            setOpen(false);
          }}
          style={{
            position: "fixed",
            left: pos.left,
            top: pos.top,
            bottom: pos.bottom,
            width: pos.width,
            maxHeight: "70vh",
            overflowY: "auto",
            zIndex: 1000,
            background: "#fff",
            border: "1px solid #c8cfdc",
            borderRadius: 8,
            boxShadow: "0 6px 20px rgba(0,0,0,0.18)",
            padding: "8px 10px",
            fontSize: 12,
            lineHeight: 1.5,
            color: "#222",
            textAlign: "left",
            fontWeight: 400,
            whiteSpace: "normal",
            cursor: "auto",
          }}
        >
          <div style={{ fontWeight: 700, marginBottom: 4 }}>{content.title}</div>
          <div>{content.what}</div>
          {content.why ? (
            <div style={{ marginTop: 6 }}>
              <span style={{ fontWeight: 700, color: "#555" }}>{labels.why}: </span>
              {content.why}
            </div>
          ) : null}
          {content.ref ? (
            <div style={{ marginTop: 6, fontSize: 11, color: "#777" }}>
              {labels.ref} {content.ref}
            </div>
          ) : null}
        </div>
      ) : null}
    </>
  );
}
