import { Crest, ResultBadge, when } from "@/components/bits";
import { currentSeason, loadSettings, localDay, matchKind, seasonOf, type MatchKind } from "@/lib/config";
import { getClub, getMatches } from "@/lib/stats";

export const dynamic = "force-dynamic";
export const metadata = { title: "Seasons" };

const KINDS: { value: MatchKind; label: string }[] = [
  { value: "league", label: "League" },
  { value: "playoffs", label: "Playoffs" },
  { value: "friendly", label: "Friendly" },
];
const RESULTS = [
  { value: "W", label: "Wins" },
  { value: "D", label: "Draws" },
  { value: "L", label: "Losses" },
];
const day = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
const isDay = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v);

type Params = Record<string, string | string[] | undefined>;

export default async function SeasonsPage({ searchParams }: { searchParams: Promise<Params> }) {
  const p = await searchParams;
  const one = (k: string) => (Array.isArray(p[k]) ? p[k][0] : p[k]) ?? "";
  const seasons = loadSettings().seasons;
  const current = currentSeason();
  // the current season by default; "all" shows every saved game
  const seasonParam = one("season") || current?.name || "all";
  const season = seasons.find((x) => x.name === seasonParam) ?? null;
  const kind = KINDS.some((k) => k.value === one("type")) ? (one("type") as MatchKind) : "";
  const result = RESULTS.some((r) => r.value === one("result")) ? one("result") : "";
  const from = isDay(one("from")) ? one("from") : "";
  const to = isDay(one("to")) ? one("to") : "";
  const q = one("q").trim().toLowerCase();

  const [club, all] = await Promise.all([getClub(), getMatches(5000)]);
  const matches = all.filter((m) => {
    const ts = Number(m.ts);
    const d = localDay(ts);
    if (season && seasonOf(ts)?.name !== season.name) return false;
    if (kind && matchKind(ts, m.match_type) !== kind) return false;
    if (result && m.result !== result) return false;
    if (from && d < from) return false;
    if (to && d > to) return false;
    if (q && !m.opp_name.toLowerCase().includes(q)) return false;
    return true;
  });
  const w = matches.filter((m) => m.result === "W").length;
  const d = matches.filter((m) => m.result === "D").length;
  const l = matches.filter((m) => m.result === "L").length;
  const gf = matches.reduce((s, m) => s + m.goals_for, 0);
  const ga = matches.reduce((s, m) => s + m.goals_against, 0);
  const filtered = Boolean(kind || result || from || to || q);

  return (
    <main className="wrap">
      <div className="stack" style={{ gap: 8 }}>
        <span className="eyebrow">Seasons</span>
        <h1 className="display">{season ? season.name : "Every game"}</h1>
        <span className="text-2">
          {season
            ? `${day(season.start)} – ${day(season.end)}${season.playoffsStart ? ` · Season Playoffs from ${when(Date.parse(season.playoffsStart) / 1000)}` : ""}`
            : "All saved games. EA only keeps the latest 10, so this site is the full record."}
        </span>
      </div>

      <form method="get" className="card stack" style={{ gap: 12 }}>
        <div className="inline-form" style={{ alignItems: "flex-end", gap: 12 }}>
          <label className="stack" style={{ gap: 4 }}>
            <span className="kpi-label">Season</span>
            <select name="season" defaultValue={season ? season.name : "all"}>
              <option value="all">All seasons</option>
              {[...seasons].reverse().map((x) => <option key={x.name} value={x.name}>{x.name}</option>)}
            </select>
          </label>
          <label className="stack" style={{ gap: 4 }}>
            <span className="kpi-label">Type</span>
            <select name="type" defaultValue={kind}>
              <option value="">All types</option>
              {KINDS.map((k) => <option key={k.value} value={k.value}>{k.label}</option>)}
            </select>
          </label>
          <label className="stack" style={{ gap: 4 }}>
            <span className="kpi-label">Result</span>
            <select name="result" defaultValue={result}>
              <option value="">All results</option>
              {RESULTS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
          </label>
          <label className="stack" style={{ gap: 4 }}>
            <span className="kpi-label">From</span>
            <input type="date" name="from" defaultValue={from} />
          </label>
          <label className="stack" style={{ gap: 4 }}>
            <span className="kpi-label">To</span>
            <input type="date" name="to" defaultValue={to} />
          </label>
          <label className="stack" style={{ gap: 4, flex: "1 1 180px" }}>
            <span className="kpi-label">Opponent</span>
            <input type="text" name="q" defaultValue={one("q")} placeholder="Club name" />
          </label>
          <button type="submit">Filter</button>
          {filtered || seasonParam !== (current?.name ?? "all") ? (
            <a href="/seasons" className="text-2" style={{ fontSize: 14, alignSelf: "center" }}>Reset</a>
          ) : null}
        </div>
      </form>

      <section className="grid grid-170">
        <div className="card">
          <div className="kpi-label">Games</div>
          <div className="display kpi-value num">{matches.length}</div>
          <div className="kpi-sub">{matches.length ? `${Math.round((w / matches.length) * 100)}% won` : "none match"}</div>
        </div>
        <div className="card">
          <div className="kpi-label">W-D-L</div>
          <div className="display kpi-value num">{w}-{d}-{l}</div>
          <div className="kpi-sub">{w * 3 + d} points (win 3, draw 1)</div>
        </div>
        <div className="card">
          <div className="kpi-label">Goals</div>
          <div className="display kpi-value num">{gf}–{ga}</div>
          <div className="kpi-sub">{matches.length ? `${(gf / matches.length).toFixed(1)} for, ${(ga / matches.length).toFixed(1)} against per game` : "for–against"}</div>
        </div>
      </section>

      <div className="stack" style={{ gap: 8 }}>
        {matches.map((m) => (
          <a key={m.id} className="match-row" href={`/matches/${m.id}`}>
            <ResultBadge r={m.result} />
            <span className="muted" style={{ fontSize: 13, width: 140 }}>{when(m.ts)}</span>
            <div className="row" style={{ gap: 12, flex: "1 1 320px", flexWrap: "nowrap" }}>
              <Crest id={club.crestAssetId} size={30} />
              <span className="score num">{m.goals_for}–{m.goals_against}</span>
              <Crest id={m.opp_crest} size={30} />
              <span style={{ fontWeight: 700 }}>{m.opp_name}</span>
            </div>
            <span className="row" style={{ gap: 8 }}>
              <span className="chip chip-ghost">{KINDS.find((k) => k.value === matchKind(Number(m.ts), m.match_type))?.label}</span>
              {m.dnf ? <span className="chip chip-ghost">They quit · {m.minutes} min</span> : null}
              {m.captain ? <span className="chip chip-ghost">C · {m.captain}</span> : null}
            </span>
          </a>
        ))}
        {!matches.length ? <p className="muted">{all.length ? "No games match these filters." : "No matches saved yet."}</p> : null}
      </div>
      <p className="muted" style={{ fontSize: 13, margin: 0 }}>
        Playoffs = EA&apos;s playoff games plus every game during a season&apos;s end-of-season Playoffs. Season dates come from
        config/settings.json.
      </p>
    </main>
  );
}
