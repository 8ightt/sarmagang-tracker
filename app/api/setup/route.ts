import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { PLATFORMS, clubId, refreshSettings, type Platform } from "@/lib/config";
import { sql } from "@/lib/db";
import { fetchPayload, searchClubs } from "@/lib/ea-remote";
import { checkPassword } from "@/lib/password";
import { ingest, pollOnce } from "@/lib/poller";

export const dynamic = "force-dynamic";
// the first load fetches about a dozen things from EA
export const maxDuration = 60;

const isPlatform = (p: string): p is Platform => p in PLATFORMS;

/** Find your club: GET /api/setup?name=Sarma&platform=common-gen5 */
export async function GET(req: Request) {
  const q = new URL(req.url).searchParams;
  const name = (q.get("name") ?? "").trim().slice(0, 40);
  const platform = q.get("platform") ?? "common-gen5";
  if (name.length < 2) return NextResponse.json({ error: "Type at least 2 letters of the club name." }, { status: 400 });
  if (!isPlatform(platform)) return NextResponse.json({ error: "Unknown platform." }, { status: 400 });
  try {
    return NextResponse.json({ clubs: await searchClubs(name, platform) });
  } catch (err) {
    return NextResponse.json({ error: `EA's club search didn't answer: ${(err as Error).message}` }, { status: 502 });
  }
}

/**
 * Pick the club and load its games: POST { password, clubId, clubName, platform }.
 * A site that already saved games for one club won't switch to another (their games would mix).
 */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { password?: string; clubId?: string; clubName?: string; platform?: string };
  const denied = await checkPassword(body.password ?? "");
  if (denied) return NextResponse.json({ ok: false, message: denied }, { status: 403 });
  const id = String(body.clubId ?? "");
  const platform = String(body.platform ?? "");
  const name = String(body.clubName ?? "").trim().slice(0, 60);
  if (!/^\d{1,12}$/.test(id) || !isPlatform(platform) || !name) return NextResponse.json({ ok: false, message: "Pick a club from the list." }, { status: 400 });

  await refreshSettings(true);
  const current = clubId();
  if (current && current !== id) {
    const [{ n }] = await sql()`select count(*)::int as n from matches`;
    if (n > 0)
      return NextResponse.json(
        { ok: false, message: `This site already has ${n} saved games for another club. Following a different club needs a fresh database.` },
        { status: 409 },
      );
  }

  await sql()`
    insert into site_settings (key, data, updated_at) values ('main', ${sql().json({ club: { id, platform, name } })}, now())
    on conflict (key) do update set data = site_settings.data || excluded.data, updated_at = now()`;
  await refreshSettings(true);

  // first load: everything EA still has (its last 10 games of each type, the squad and season totals)
  let result;
  try {
    const payload = await fetchPayload(id, platform);
    result = payload ? await ingest({ ...payload, source: String(payload.source ?? "setup") }) : await pollOnce();
  } catch (err) {
    result = { ok: false, newMatches: 0, message: (err as Error).message };
  }
  revalidatePath("/", "layout");
  return NextResponse.json({ ...result, club: { id, platform, name } }, { status: result.ok ? 200 : 207 });
}
