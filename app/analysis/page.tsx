import { Crest, ResultBadge, when } from "@/components/bits";
import { Lineup } from "@/components/Lineup";
import { getInsights, MIN_GAMES, SR_GAP, type Record3 } from "@/lib/insights";

export const dynamic = "force-dynamic";
export const metadata = { title: "Analysis" };

const ppg = (r: Record3) => r.ppg.toFixed(2);
const wdl = (r: Record3) => `${r.w}-${r.d}-${r.l}`;
const signed = (v: number, digits = 2) => {
  const r = Number(v.toFixed(digits)); // so -0.02 doesn't print as "-0.0"
  return `${r > 0 ? "+" : ""}${r.toFixed(digits)}`;
};
const player = (name: string) => <a href={`/players/${encodeURIComponent(name)}`}>{name}</a>;

export default async function AnalysisPage() {
  const x = await getInsights();
  const { buckets, upsets, toughest } = x.opponents;

  return (
    <main className="wrap">
      <section className="stack" style={{ gap: 10 }}>
        <span className="eyebrow">Analysis</span>
        <h1 className="display">What the numbers say</h1>
        <span className="text-2" style={{ maxWidth: 760 }}>
          Worked out from the {x.games} games this site has saved{x.since ? ` since ${when(x.since)}` : ""}, not from EA&apos;s totals.
          Goals and assists are each player&apos;s own, without the CPU&apos;s. Players need {MIN_GAMES}+ games to appear;
          with this few games, treat it as a hint, not a verdict.
        </span>
      </section>

      <section className="stack">
        <div className="section-head">
          <h2 className="display">Form</h2>
          <span className="muted" style={{ fontSize: 13 }}>Average rating in the last 5 games vs all saved games</span>
        </div>
        <div className="grid grid-240">
          {x.form.map((f) => (
            <a key={f.player} className="card stack" style={{ gap: 10, textDecoration: "none", color: "var(--text)" }} href={`/players/${encodeURIComponent(f.player)}`}>
              <div className="row between" style={{ flexWrap: "nowrap" }}>
                <strong style={{ fontSize: 18 }}>{f.player}</strong>
                <span className={f.trend === "hot" ? "chip" : f.trend === "cold" ? "chip chip-shame" : "chip chip-ghost"}>
                  {f.trend === "hot" ? "Hot" : f.trend === "cold" ? "Cold" : "Steady"}
                </span>
              </div>
              <div className="row" style={{ gap: 6, alignItems: "baseline" }}>
                <span className="display num" style={{ fontSize: 40 }}>{f.last5Rating.toFixed(1)}</span>
                <span className="muted num">{signed(f.last5Rating - f.rating, 1)} vs {f.rating.toFixed(1)}</span>
              </div>
              <div className="row" style={{ gap: 4 }}>
                {f.recent.map((r, i) => (
                  <span key={i} className={`badge badge-${r.result}`} title={r.rating === null ? "Rating unknown: ran the CPU" : r.est ? `Rating ≈ ${r.rating.toFixed(1)}, estimated: ran the CPU` : `Rating ${r.rating.toFixed(1)}`} style={{ fontSize: 12 }}>
                    {r.rating === null ? "–" : `${r.est ? "≈" : ""}${r.rating.toFixed(1)}`}
                  </span>
                ))}
              </div>
              <span className="muted" style={{ fontSize: 13 }}>{f.last5GoalsAssists} goals + assists in the last 5 · {f.games} games</span>
            </a>
          ))}
        </div>
      </section>

      <section className="stack">
        <div className="section-head">
          <h2 className="display">With and without</h2>
          <span className="muted" style={{ fontSize: 13 }}>Club points per game (win 3, draw 1) when the player plays and when they don&apos;t</span>
        </div>
        <div className="table-box">
          <table>
            <thead>
              <tr><th>Player</th><th>With: games</th><th>W-D-L</th><th>Pts/game</th><th>Goals for/against</th><th>Without: games</th><th>Pts/game</th><th>Difference</th></tr>
            </thead>
            <tbody>
              {x.withWithout.map((r) => (
                <tr key={r.player}>
                  <td>{player(r.player)}</td>
                  <td>{r.with.games}</td>
                  <td>{wdl(r.with)}</td>
                  <td style={{ fontWeight: 700 }}>{ppg(r.with)}</td>
                  <td>{r.with.gf.toFixed(1)} / {r.with.ga.toFixed(1)}</td>
                  <td>{r.without.games || "–"}</td>
                  <td>{r.without.games ? ppg(r.without) : "–"}</td>
                  <td style={{ fontWeight: 700, color: r.ppgDiff === null ? undefined : r.ppgDiff >= 0 ? "var(--accent)" : "var(--shame)" }}>
                    {r.ppgDiff === null ? "never missed" : signed(r.ppgDiff)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="stack">
        <div className="section-head">
          <h2 className="display">Pick a lineup</h2>
          <span className="muted" style={{ fontSize: 13 }}>How the club does with some players in and others out</span>
        </div>
        <Lineup players={x.lineup.players} games={x.lineup.games.map(({ ts, ...g }) => ({ ...g, date: when(ts) }))} />
      </section>

      <section className="stack">
        <div className="section-head">
          <h2 className="display">Duos</h2>
          <span className="muted" style={{ fontSize: 13 }}>Pairs with {MIN_GAMES}+ games together, best points per game first</span>
        </div>
        {x.duos.length ? (
          <div className="table-box">
            <table>
              <thead>
                <tr><th>Duo</th><th>Games</th><th>W-D-L</th><th>Pts/game</th><th>Goals for/against</th><th>Their goals + assists</th></tr>
              </thead>
              <tbody>
                {x.duos.map((d) => (
                  <tr key={d.players.join("+")}>
                    <td>{player(d.players[0])} + {player(d.players[1])}</td>
                    <td>{d.rec.games}</td>
                    <td>{wdl(d.rec)}</td>
                    <td style={{ fontWeight: 700 }}>{ppg(d.rec)}</td>
                    <td>{d.rec.gf.toFixed(1)} / {d.rec.ga.toFixed(1)}</td>
                    <td>{d.goalsAssists}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="muted">No pair has played {MIN_GAMES} games together yet.</p>
        )}
      </section>

      <section className="stack">
        <div className="section-head">
          <h2 className="display">Opponent strength</h2>
          <span className="muted" style={{ fontSize: 13 }}>By EA Skill Rating, {x.opponents.rated} of {x.games} games rated</span>
        </div>
        <div className="grid grid-240">
          {buckets.map((b) => (
            <div key={b.label} className="card stack" style={{ gap: 8 }}>
              <div className="kpi-label">{b.label} <span className="muted">· {b.note}</span></div>
              <div className="display kpi-value num" style={{ fontSize: 40 }}>{b.rec.games ? ppg(b.rec) : "–"}</div>
              <div className="kpi-sub">{b.rec.games ? `points per game · ${wdl(b.rec)} in ${b.rec.games}` : "no games yet"}</div>
            </div>
          ))}
        </div>
        {upsets.length || toughest ? (
          <div className="card" style={{ padding: "8px 24px" }}>
            {toughest ? (
              <a href={`/matches/${toughest.id}`} className="row" style={{ gap: 14, padding: "14px 0", borderBottom: "1px solid var(--line)", textDecoration: "none", color: "var(--text)" }}>
                <strong style={{ flex: "1 1 180px" }}>Toughest opponent</strong>
                <Crest id={toughest.crest} size={28} />
                <span style={{ flex: "2 1 260px" }}>{toughest.opp} · {toughest.oppSr} SR ({signed(toughest.gap, 0)}) · {toughest.gf}–{toughest.ga}</span>
                <ResultBadge r={toughest.result} />
              </a>
            ) : null}
            {upsets.map((u) => (
              <a key={u.id} href={`/matches/${u.id}`} className="row" style={{ gap: 14, padding: "14px 0", borderBottom: "1px solid var(--line)", textDecoration: "none", color: "var(--text)" }}>
                <strong style={{ flex: "1 1 180px" }}>Upset win</strong>
                <Crest id={u.crest} size={28} />
                <span style={{ flex: "2 1 260px" }}>{u.gf}–{u.ga} vs {u.opp} · {u.oppSr} SR ({signed(u.gap, 0)}) · {when(u.ts)}</span>
                <ResultBadge r={u.result} />
              </a>
            ))}
          </div>
        ) : null}
        <p className="muted" style={{ fontSize: 13, margin: 0 }}>
          “Stronger” means at least {SR_GAP} Skill Rating above ours. EA only gives today&apos;s rating, so it&apos;s saved within minutes of
          each game{x.opponents.estimated ? "; older games use the ratings from when this was added, and our current rating" : ""}.
        </p>
      </section>

      <section className="stack">
        <div className="section-head">
          <h2 className="display">Positions</h2>
          <span className="muted" style={{ fontSize: 13 }}>EA&apos;s group (FWD/MID/DEF/GK) unless the exact position was entered with Fix stats</span>
        </div>
        <div className="table-box">
          <table>
            <thead>
              <tr><th>Player</th><th>Position</th><th>Games</th><th>Avg rating</th><th>Goals + assists per game</th></tr>
            </thead>
            <tbody>
              {x.positions.map((p) => (
                <tr key={`${p.player}-${p.position}`}>
                  <td>{player(p.player)}</td>
                  <td>{p.position}</td>
                  <td>{p.games}</td>
                  <td style={{ fontWeight: 700 }}>{p.rating === null ? "–" : p.rating.toFixed(1)}</td>
                  <td>{p.goalsAssistsPerGame.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
