import { Crest, ResultBadge, when } from "@/components/bits";
import { getClub, getMatches, savedMatchCount } from "@/lib/stats";

export const dynamic = "force-dynamic";
export const metadata = { title: "Matches" };

const TYPE: Record<string, string> = { leagueMatch: "League", playoffMatch: "Playoff", friendlyMatch: "Friendly" };

export default async function MatchesPage() {
  const [club, matches, { count, since }] = await Promise.all([getClub(), getMatches(500), savedMatchCount()]);
  const w = matches.filter((m) => m.result === "W").length;
  const d = matches.filter((m) => m.result === "D").length;
  const l = matches.filter((m) => m.result === "L").length;
  return (
    <main className="wrap">
      <div className="stack" style={{ gap: 8 }}>
        <span className="eyebrow">Match history</span>
        <h1 className="display">Every game</h1>
        <span className="text-2">
          {count} saved {since ? `since ${when(since)}` : ""} · {w}W {d}D {l}L. EA only keeps the latest 10, so this site is the full record.
        </span>
      </div>
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
              <span className="chip chip-ghost">{TYPE[m.match_type] ?? m.match_type}</span>
              {m.dnf ? <span className="chip chip-ghost">They quit · {m.minutes} min</span> : null}
              {m.captain ? <span className="chip chip-ghost">C · {m.captain}</span> : null}
            </span>
          </a>
        ))}
        {!matches.length ? <p className="muted">No matches saved yet.</p> : null}
      </div>
    </main>
  );
}
