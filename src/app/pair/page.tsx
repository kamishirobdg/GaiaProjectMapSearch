import { redirect } from "next/navigation";

// Pair はトップ `/` に移した（段階 3、2026-10-17）。共有 URL（?h=&t=&s=）の引数はそのまま渡す。
export default async function PairPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) if (typeof v === "string") q.set(k, v);
  const qs = q.toString();
  redirect(`/${qs ? `?${qs}` : ""}`);
}
