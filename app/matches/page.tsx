import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

/** The match list moved to /seasons (with filters); match pages stay at /matches/[id]. */
export default async function MatchesPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const p = await searchParams;
  const qs = new URLSearchParams(Object.entries(p).flatMap(([k, v]) => (Array.isArray(v) ? v.map((x) => [k, x]) : v ? [[k, v]] : [])));
  redirect(`/seasons${qs.size ? `?${qs}` : ""}`);
}
