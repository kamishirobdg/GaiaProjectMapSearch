import { redirect } from "next/navigation";

// 旧 Total タブは Pair（/pair）の「詳細」へ統合した（段階 2、2026-10-17）。
export default async function TotalPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) if (typeof v === "string") q.set(k, v);
  const qs = q.toString();
  redirect(`/pair${qs ? `?${qs}` : ""}`);
}
