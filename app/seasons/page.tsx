import { Crest, ResultBadge, when } from "@/components/bits";
import { currentSeason, loadSettings, localDay, matchKind, seasonOf, type MatchKind } from "@/lib/config";
import { getClub, getMatches, getSeason } from "@/lib/stats";

export const dynamic = "force-dynamic";
export const metadata = { title: "Seasons" };

const KINDS: { value: MatchKind; label: string }[] = [
  { value: "league", label: "League" },
  { value: "promotion", label: "Promotion" },
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

  const [club, all, league] = await Promise.all([getClub(), getMatches(5000), getSeason()]);
  const promo = league?.promotionGames ?? {};
  const kindOf = (m: (typeof all)[number]) => matchKind(Number(m.ts), m.match_type, m.id in promo);
  type Skip = "type" | "result";
  const keep = (m: (typeof all)[number], skip?: Skip) => {
    const ts = Number(m.ts);
    const d = localDay(ts);
    if (season && seasonOf(ts)?.name !== season.name) return false;
    if (skip !== "type" && kind && kindOf(m) !== kind) return false;
    if (skip !== "result" && result && m.result !== result) return false;
    if (from && d < from) return false;
    if (to && d > to) return false;
    if (q && !m.opp_name.toLowerCase().includes(q)) return false;
    return true;
  };
  const matches = all.filter((m) => keep(m));
  // counts on each pill ignore that pill's own group, so you can see what switching would give
  const byType = all.filter((m) => keep(m, "type"));
  const byResult = all.filter((m) => keep(m, "result"));
  const w = matches.filter((m) => m.result === "W").length;
  const d = matches.filter((m) => m.result === "D").length;
  const l = matches.filter((m) => m.result === "L").length;
  const gf = matches.reduce((s, m) => s + m.goals_for, 0);
  const ga = matches.reduce((s, m) => s + m.goals_against, 0);

  const state = { season: season ? season.name : "all", type: kind as string, result, from, to, q: one("q").trim() };
  const defaultSeason = current?.name ?? "all";
  const href = (change: Partial<typeof state>) => {
    const next = { ...state, ...change };
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(next)) if (v && !(k === "season" && v === defaultSeason)) qs.set(k, v);
    return `/seasons${qs.size ? `?${qs}` : ""}`;
  };
  const short = (v: string) => new Date(`${v}T12:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
  const active = [
    kind && { label: KINDS.find((k) => k.value === kind)!.label, clear: href({ type: "" }) },
    result && { label: RESULTS.find((r) => r.value === result)!.label, clear: href({ result: "" }) },
    from && { label: `From ${short(from)}`, clear: href({ from: "" }) },
    to && { label: `To ${short(to)}`, clear: href({ to: "" }) },
    state.q && { label: `“${state.q}”`, clear: href({ q: "" }) },
  ].filter(Boolean) as { label: string; clear: string }[];
  const dotColor: Record<string, string> = { W: "var(--accent)", D: "var(--muted)", L: "#c4485a" };

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

      <div className="stack" style={{ gap: 16 }}>
        <nav className="season-tabs" aria-label="Season">
          {[...seasons].reverse().map((x) => (
            <a key={x.name} href={href({ season: x.name })} aria-current={season?.name === x.name ? "page" : undefined}>{x.name}</a>
          ))}
          <a href={href({ season: "all" })} aria-current={!season ? "page" : undefined}>All seasons</a>
        </nav>

        <div className="card filter-bar">
          <div className="filter-group" role="group" aria-label="Match type">
            <span className="filter-label">Type</span>
            <a className="pill" href={href({ type: "" })} aria-current={!kind}>All <span className="count">{byType.length}</span></a>
            {KINDS.map((k) => {
              const n = byType.filter((m) => kindOf(m) === k.value).length;
              return (
                <a key={k.value} className={`pill${n ? "" : " is-empty"}`} href={href({ type: k.value })} aria-current={kind === k.value}>
                  {k.label} <span className="count">{n}</span>
                </a>
              );
            })}
          </div>
          <div className="filter-group" role="group" aria-label="Result">
            <span className="filter-label">Result</span>
            <a className="pill" href={href({ result: "" })} aria-current={!result}>All <span className="count">{byResult.length}</span></a>
            {RESULTS.map((r) => {
              const n = byResult.filter((m) => m.result === r.value).length;
              return (
                <a key={r.value} className={`pill${n ? "" : " is-empty"}`} href={href({ result: r.value })} aria-current={result === r.value}>
                  <span className="dot" style={{ background: dotColor[r.value] }} />
                  {r.label} <span className="count">{n}</span>
                </a>
              );
            })}
          </div>
          <form method="get" action="/seasons" className="filter-search">
            {state.season !== defaultSeason ? <input type="hidden" name="season" value={state.season} /> : null}
            {kind ? <input type="hidden" name="type" value={kind} /> : null}
            {result ? <input type="hidden" name="result" value={result} /> : null}
            <label className="field" style={{ flex: "1 1 220px" }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true" style={{ color: "var(--muted)" }}>
                <circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" />
              </svg>
              <input type="text" name="q" defaultValue={state.q} placeholder="Search opponent" aria-label="Opponent" style={{ flex: 1 }} />
            </label>
            <label className="field date" aria-label="From">
              <span>From</span>
              <input type="date" name="from" defaultValue={from} />
            </label>
            <label className="field date" aria-label="To">
              <span>To</span>
              <input type="date" name="to" defaultValue={to} />
            </label>
            <button type="submit">Search</button>
          </form>
          {active.length ? (
            <div className="active-filters">
              {active.map((a) => (
                <a key={a.label} className="chip-x" href={a.clear} aria-label={`Remove ${a.label}`}>{a.label} <b>✕</b></a>
              ))}
              <a href={href({ type: "", result: "", from: "", to: "", q: "" })} className="text-2" style={{ fontSize: 13 }}>Clear all</a>
            </div>
          ) : null}
        </div>
      </div>

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
              <span className="chip chip-ghost">
                {KINDS.find((k) => k.value === kindOf(m))?.label}
                {promo[m.id] ? ` · Game ${promo[m.id].game}/${promo[m.id].of}` : ""}
              </span>
              {m.dnf ? <span className="chip chip-ghost">They quit · {m.minutes} min</span> : null}
              {m.captain ? <span className="chip chip-ghost">C · {m.captain}</span> : null}
            </span>
          </a>
        ))}
        {!matches.length ? <p className="muted">{all.length ? "No games match these filters." : "No matches saved yet."}</p> : null}
      </div>
      <p className="muted" style={{ fontSize: 13, margin: 0 }}>
        Promotion = games in a promotion match series (EA sends them as league games; the site spots them from the points
        target). Playoffs = EA&apos;s playoff games plus every game during a season&apos;s end-of-season Playoffs. Season dates come from
        config/settings.json.
      </p>
    </main>
  );
}
