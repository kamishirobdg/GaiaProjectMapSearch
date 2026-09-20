// src/components/WeightReviewPanel.tsx
//
// /weights に出す「整合性レビュー」の部品（2026-09-20）。
//   - ReviewList … 全提案の一覧（採否の進捗つき）。項目を押すとそのタイルへ飛ぶ。
//     対象のタイルが無い要判断（列や種族が対象）は、その場で詳細を開く。
//   - ReviewCards … いま開いているタイルに関わる提案のカード。見出しだけ出して
//     タップで展開し、根拠のタイルへ飛ぶボタンと採否のボタンを持つ。
// 値の計算は持たない（採用の反映は weightReviewEdits.ts、画面の状態は WeightsEditor）。

"use client";

import React from "react";
import { FACTION_SHORT_JA, axesOfTile, weightTableOf } from "@/gaia/eval/weightTables";
import type { ReviewCell, ReviewItem } from "@/gaia/eval/weightReview";
import {
  REVIEW_DECISION_JA,
  cellsForTile,
  type ReviewDecision,
  type ReviewDecisions,
} from "@/gaia/eval/weightReviewEdits";

const CONF_STYLE: Record<string, { bg: string; fg: string }> = {
  高: { bg: "#ffe0e0", fg: "#a12020" },
  中: { bg: "#fff3cd", fg: "#7a5a00" },
  低: { bg: "#e8f0fe", fg: "#2b4a8f" },
};

const DECISION_STYLE: Record<ReviewDecision | "pending", { bg: string; fg: string }> = {
  adopt: { bg: "#dff3e3", fg: "#1a7f37" },
  reject: { bg: "#eee", fg: "#666" },
  done: { bg: "#dff3e3", fg: "#1a7f37" },
  pending: { bg: "#fff", fg: "#999" },
};

const badge = (text: string, s: { bg: string; fg: string }) => (
  <span
    style={{
      display: "inline-block",
      padding: "0 5px",
      borderRadius: 4,
      fontSize: 9,
      fontWeight: 700,
      background: s.bg,
      color: s.fg,
      border: "1px solid " + s.fg + "33",
      whiteSpace: "nowrap",
    }}
  >
    {text}
  </span>
);

const smallBtn: React.CSSProperties = {
  padding: "3px 8px",
  fontSize: 11,
  borderRadius: 6,
  border: "1px solid #ccc",
  background: "#fff",
  cursor: "pointer",
};

const rowBtn: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 5,
  width: "100%",
  textAlign: "left",
  padding: "5px 7px",
  border: 0,
  background: "none",
  fontSize: 11,
  cursor: "pointer",
};

export function decisionLabel(d: ReviewDecision | undefined): string {
  return d ? REVIEW_DECISION_JA[d] : "未定";
}

function confidenceBadge(it: ReviewItem) {
  return it.kind === "judgment"
    ? badge("要判断", CONF_STYLE["低"])
    : badge(it.confidence, CONF_STYLE[it.confidence] ?? CONF_STYLE["低"]);
}

function decisionBadge(d: ReviewDecision | undefined) {
  return badge(decisionLabel(d), DECISION_STYLE[d ?? "pending"]);
}

function axisJa(c: ReviewCell): string {
  if (c.axis === "") return "基準";
  const meta = weightTableOf(c.table);
  return axesOfTile(meta, c.tile, c.lf).find((a) => a.key === c.axis)?.ja ?? c.axis;
}

/** 見出し行（id・確信度・採否・対象）。 */
function ItemHead({ item, decision, open }: { item: ReviewItem; decision?: ReviewDecision; open: boolean }) {
  return (
    <>
      <b style={{ flex: "0 0 auto" }}>{item.id}</b>
      {confidenceBadge(item)}
      {decisionBadge(decision)}
      <span
        style={{
          flex: "1 1 0",
          minWidth: 0,
          overflow: open ? "visible" : "hidden",
          textOverflow: "ellipsis",
          whiteSpace: open ? "normal" : "nowrap",
          color: "#333",
        }}
      >
        {item.target}
      </span>
      <span style={{ flex: "0 0 auto", color: "#999" }}>{open ? "▲" : "▼"}</span>
    </>
  );
}

/** 展開したときの本文（理由・修正・根拠・書く値・参照ボタン・採否ボタン）。 */
function ItemBody({
  item,
  decision,
  cells,
  jumps,
  onDecide,
  onJump,
}: {
  item: ReviewItem;
  decision?: ReviewDecision;
  /** いま開いているタイルに書くセル（一覧から開いたときは空）。 */
  cells: ReviewCell[];
  /** 参照ボタンに出すタイル id。 */
  jumps: string[];
  onDecide: (item: ReviewItem, decision: ReviewDecision | null) => void;
  onJump: (tileId: string) => void;
}) {
  const choices: Array<[ReviewDecision, string]> =
    item.kind === "judgment"
      ? [
          ["done", "対応済み"],
          ["reject", "見送り"],
        ]
      : [
          ["adopt", "採用"],
          ["reject", "見送り"],
        ];
  return (
    <div style={{ padding: "0 7px 7px", fontSize: 11, lineHeight: 1.45, color: "#444" }}>
      <div>
        <b>理由</b> {item.reason}
      </div>
      <div style={{ marginTop: 3 }}>
        <b>修正</b> {item.change}
      </div>
      <div style={{ marginTop: 3 }}>
        <b>根拠</b> {item.refs}
      </div>
      {cells.length > 0 ? (
        <div style={{ marginTop: 3, color: "#7a3550" }}>
          <b>このタイルに書く値</b>{" "}
          {cells
            .map((c) => `${axisJa(c)} ${FACTION_SHORT_JA[c.faction] ?? c.faction} → ${c.value}`)
            .join(" / ")}
          {item.cells.length > cells.length
            ? `（他 ${item.cells.length - cells.length} セルは別のタイル・版）`
            : ""}
        </div>
      ) : item.cells.length > 0 ? (
        <div style={{ marginTop: 3, color: "#7a3550" }}>採用で書くセル {item.cells.length}</div>
      ) : null}
      {jumps.length > 0 ? (
        <div style={{ marginTop: 5, display: "flex", gap: 4, flexWrap: "wrap", alignItems: "center" }}>
          <span style={{ fontSize: 10, color: "#666" }}>参照:</span>
          {jumps.map((t) => (
            <button key={t} type="button" onClick={() => onJump(t)} style={{ ...smallBtn, color: "#2733cc" }}>
              {t}
            </button>
          ))}
        </div>
      ) : null}
      <div style={{ marginTop: 6, display: "flex", gap: 4, flexWrap: "wrap" }}>
        {choices.map(([dec, label]) => (
          <button
            key={dec}
            type="button"
            onClick={() => onDecide(item, decision === dec ? null : dec)}
            style={{
              ...smallBtn,
              fontWeight: decision === dec ? 700 : 400,
              border: "1px solid " + (decision === dec ? DECISION_STYLE[dec].fg : "#ccc"),
              background: decision === dec ? DECISION_STYLE[dec].bg : "#fff",
            }}
          >
            {label}
          </button>
        ))}
        {decision ? (
          <button type="button" onClick={() => onDecide(item, null)} style={smallBtn}>
            未定に戻す
          </button>
        ) : null}
      </div>
    </div>
  );
}

/** 全提案の一覧。確信度 高 → 中 → 要判断の順。 */
export function ReviewList({
  items,
  decisions,
  date,
  onPick,
  onDecide,
  onJump,
  onClose,
}: {
  items: readonly ReviewItem[];
  decisions: ReviewDecisions;
  date: string;
  /** 対象のタイルがある項目を押したとき（そのタイルへ飛ぶ）。 */
  onPick: (item: ReviewItem) => void;
  onDecide: (item: ReviewItem, decision: ReviewDecision | null) => void;
  onJump: (tileId: string) => void;
  onClose: () => void;
}) {
  /** 対象のタイルが無い項目は一覧の中で開く。 */
  const [open, setOpen] = React.useState<string | null>(null);
  const groups: Array<[string, ReviewItem[]]> = [
    [
      "確信度 高（機械的な矛盾か記録に残る差し戻し）",
      items.filter((i) => i.kind === "proposal" && i.confidence === "高"),
    ],
    ["確信度 中（表や設計メモと食い違う）", items.filter((i) => i.kind === "proposal" && i.confidence === "中")],
    ["要判断（値は自分で入れる。採用ボタンは無い）", items.filter((i) => i.kind === "judgment")],
  ];
  return (
    <div
      style={{
        margin: "0 8px 6px",
        border: "1px solid #d8c0cc",
        borderRadius: 6,
        background: "#fff",
        maxHeight: "60vh",
        overflowY: "auto",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          padding: "5px 7px",
          borderBottom: "1px solid #eee",
          position: "sticky",
          top: 0,
          background: "#fff",
          zIndex: 1,
        }}
      >
        <b style={{ fontSize: 11 }}>整合性レビュー（{date}）</b>
        <span style={{ fontSize: 10, color: "#666" }}>項目を押すとそのタイルへ</span>
        <button type="button" onClick={onClose} style={{ ...smallBtn, marginLeft: "auto" }}>
          閉じる
        </button>
      </div>
      {groups.map(([title, list]) =>
        list.length === 0 ? null : (
          <div key={title}>
            <div style={{ padding: "5px 7px 2px", fontSize: 10, color: "#7a3550", fontWeight: 700 }}>
              {title}
            </div>
            {list.map((it) => {
              const hasTarget = it.targetTiles.length > 0;
              const isOpen = open === it.id;
              return (
                <div key={it.id} style={{ borderTop: "1px solid #f3f3f3" }}>
                  <button
                    type="button"
                    onClick={() => (hasTarget ? onPick(it) : setOpen(isOpen ? null : it.id))}
                    style={{ ...rowBtn, padding: "4px 7px" }}
                  >
                    <ItemHead item={it} decision={decisions[it.id]} open={isOpen} />
                  </button>
                  {isOpen ? (
                    <ItemBody
                      item={it}
                      decision={decisions[it.id]}
                      cells={[]}
                      jumps={it.refTiles}
                      onDecide={onDecide}
                      onJump={onJump}
                    />
                  ) : null}
                </div>
              );
            })}
          </div>
        ),
      )}
    </div>
  );
}

/** いま開いているタイルに関わる提案のカード。 */
export function ReviewCards({
  items,
  decisions,
  tileId,
  lf,
  date,
  expanded,
  onToggle,
  onDecide,
  onJump,
}: {
  items: readonly ReviewItem[];
  decisions: ReviewDecisions;
  tileId: string;
  lf: boolean;
  date: string;
  expanded: string | null;
  onToggle: (id: string) => void;
  onDecide: (item: ReviewItem, decision: ReviewDecision | null) => void;
  onJump: (tileId: string) => void;
}) {
  if (items.length === 0) return null;
  return (
    <div style={{ margin: "0 8px 6px" }}>
      <div style={{ fontSize: 10, color: "#7a3550", fontWeight: 700, padding: "0 1px 2px" }}>
        整合性レビューの提案 {items.length}件（{date}）。見出しを押すと詳細。
      </div>
      {items.map((it) => {
        const isOpen = expanded === it.id;
        const d = decisions[it.id];
        return (
          <div
            key={it.id}
            style={{
              border: "1px solid " + (d === "adopt" || d === "done" ? "#9fd3ad" : "#e0c8d0"),
              borderRadius: 6,
              marginTop: 4,
              background: d === "reject" ? "#f6f6f6" : "#fff8fa",
            }}
          >
            <button type="button" onClick={() => onToggle(it.id)} style={rowBtn}>
              <ItemHead item={it} decision={d} open={isOpen} />
            </button>
            {isOpen ? (
              <ItemBody
                item={it}
                decision={d}
                cells={cellsForTile(it, tileId, lf)}
                jumps={[...it.targetTiles.filter((t) => t !== tileId), ...it.refTiles]}
                onDecide={onDecide}
                onJump={onJump}
              />
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
