// src/lib/setupShare.ts
//
// /setup の共有リンク（?s=<token>）のエンコード/デコード（TODO ③、2026-07-24）。
// トークンは BuildSetupInput（シード＋条件、無効時フィールド省略の正規形）を
// stableStringify → UTF-8 → base64url したもの。開いた側はマップの ?h= と
// 同じ作法でマウント時に捕捉して URL から除去し、表示のみ復元する
// （受け手の記憶設定は書き換えない）。

import type { BuildSetupInput } from "@/gaia/setup/buildSetup";
import { AVOID_RULES } from "@/gaia/setup/buildSetup";
import { TECH_SHIP_IDS, type ShipId } from "@/gaia/setup/types";
import { stableStringify } from "@/app/board/persistence";

export function encodeSetupToken(input: BuildSetupInput): string {
  const json = stableStringify(input);
  const bytes = new TextEncoder().encode(json);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/**
 * トークンを検証つきで BuildSetupInput に戻す。既知フィールドだけを
 * スプレッド省略の正規形で拾い直すので、壊れた/古いトークンでも
 * 安全に無視できる。失敗時は null。
 */
export function decodeSetupToken(token: string): BuildSetupInput | null {
  try {
    const b64 = token.replace(/-/g, "+").replace(/_/g, "/");
    const pad = b64.length % 4 === 0 ? "" : "=".repeat(4 - (b64.length % 4));
    const bin = atob(b64 + pad);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    const raw = JSON.parse(new TextDecoder().decode(bytes));
    if (!raw || typeof raw !== "object") return null;

    const seed = String(raw.seed ?? "").trim();
    if (!seed) return null;

    const players = Number(raw.playerCount);
    const lf = raw.mode === "lostFleet";

    const ruleIds = new Set(AVOID_RULES.map((r) => r.id));
    const strArr = (v: unknown, ok: (s: string) => boolean): string[] =>
      Array.isArray(v) ? v.map(String).filter(ok) : [];
    const strMap = (v: unknown, ok: (k: string, s: string) => boolean): Record<string, string> => {
      const out: Record<string, string> = {};
      if (v && typeof v === "object") {
        for (const [k, s] of Object.entries(v)) {
          if (typeof s === "string" && ok(k, s)) out[k] = s;
        }
      }
      return out;
    };
    const tileOk = (ruleId: string, tile: string) =>
      AVOID_RULES.some((r) => r.id === ruleId && r.tileIds.includes(tile));
    const shipOk = (s: string) => (TECH_SHIP_IDS as readonly string[]).includes(s);

    const avoidRules = strArr(raw.avoidRules, (s) => ruleIds.has(s));
    const forceRules = strArr(raw.forceRules, (s) => ruleIds.has(s));
    const forceTileRules = strMap(raw.forceTileRules, tileOk);
    const allowTileRules = strMap(raw.allowTileRules, tileOk);
    const shipDistanceAvoid = strArr(raw.shipDistanceAvoid, shipOk) as ShipId[];
    const shipDistanceForce = strArr(raw.shipDistanceForce, shipOk) as ShipId[];
    const gold = raw.rebellionGoldFed;
    const ext = raw.extensionFaceMode;
    const econ = raw.econFaceMode;

    return {
      seed,
      ...(Number.isFinite(players) ? { playerCount: players } : {}),
      ...(lf ? { mode: "lostFleet" as const } : {}),
      ...(lf && (ext === "random" || ext === "vp25" || ext === "shuttle")
        ? { extensionFaceMode: ext }
        : {}),
      ...(lf && (econ === "A" || econ === "B") ? { econFaceMode: econ } : {}),
      ...(avoidRules.length > 0 ? { avoidRules } : {}),
      ...(forceRules.length > 0 ? { forceRules } : {}),
      ...(Object.keys(forceTileRules).length > 0 ? { forceTileRules } : {}),
      ...(Object.keys(allowTileRules).length > 0 ? { allowTileRules } : {}),
      ...(lf && shipDistanceAvoid.length > 0 ? { shipDistanceAvoid } : {}),
      ...(lf && shipDistanceForce.length > 0 ? { shipDistanceForce } : {}),
      ...(lf && (gold === "avoid" || gold === "force") ? { rebellionGoldFed: gold } : {}),
    };
  } catch {
    return null;
  }
}

/** 共有URL文字列（/setup?s=<token>）。 */
export function setupShareUrl(input: BuildSetupInput): string {
  return `${window.location.origin}/setup?s=${encodeSetupToken(input)}`;
}

/** クリップボードへコピー（http でも動くフォールバック付き）。 */
export function copyText(text: string): void {
  try {
    if (navigator.clipboard?.writeText) {
      void navigator.clipboard.writeText(text);
      return;
    }
  } catch {
    // fall through
  }
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    document.body.removeChild(ta);
  } catch {
    // ignore
  }
}
