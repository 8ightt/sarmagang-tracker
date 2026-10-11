import { notFound } from "next/navigation";
import { Crest, Flag, PosLabel, ResultBadge, when } from "@/components/bits";
import { SeasonRedsForm } from "@/components/Forms";
import { archetypeGroup, archetypeName, groupShort } from "@/lib/ea-assets";
import { MIN_GAMES } from "@/lib/insights";
import { AFK_SECONDS, getArchetypeSeason, getArchetypes, getMembers, getPlayerLog, getSeasonCpuReds, getTracked, idleLabel } from "@/lib/stats";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ name: string }> }) {
  return { title: decodeURIComponent((await params).name) };
}

export default async function PlayerPage({ params }: { params: Promise<{ name: string }> }) {
  const name = decodeURIComponent((await params).name);
  const members = await getMembers();
  const p = members.find((m) => m.gamertag === name);
  if (!p) notFound();
  const [log, seasonCpuReds, tracked, archetypes, byArchetype] = await Promise.all([
    getPlayerLog(name, 20),
    getSeasonCpuReds(name),
    getTracked(),
    getArchetypes(name),
    getArchetypeSeason(name),
  ]);
  const currentArchetype = log[0]?.archetype ?? null;
  const t = tracked.get(name);
  const playing = members.filter((m) => m.games > 0);
  const squadRating = playing.length ? playing.reduce((s, m) => s + m.rating, 0) / playing.length : 0;
  const per = (v: number) => (p.games ? (v / p.games).toFixed(2) : "0");
  // own goals from the saved games (EA's prevGoals include the CPU's for whoever controls it)
  const last10 = log.length ? log.slice(0, 10).map((m) => m.goals).reverse() : p.lastTenGoals;
  const maxG = Math.max(1, ...last10);
  const cpu = p.controlsCpu ? " · incl. CPU" : "";
  const posCount = new Map<string, number>();
  for (const m of log) {
    const key = m.position || groupShort(m.pos);
    if (key) posCount.set(key, (posCount.get(key) ?? 0) + 1);
  }
  const positionsPlayed = [...posCount.entries()].sort((a, b) => b[1] - a[1]).map(([k, n]) => `${k} ×${n}`).join(" · ");

  const tiles = [
    { label: "Games", value: p.games, sub: `${p.winRate}% win rate` },
    { label: "Goals", value: p.goals, sub: `${per(p.goals)} per game${p.goalsEa !== p.goals ? ` · EA: ${p.goalsEa} incl. CPU` : ""}` },
    { label: "Assists", value: p.assists, sub: `${per(p.assists)} per game${p.assistsEa !== p.assists ? ` · EA: ${p.assistsEa} incl. CPU` : ""}` },
    { label: "Avg rating", value: p.rating.toFixed(1), sub: `Squad avg ${squadRating.toFixed(1)}` },
    { label: "MOTM", value: p.motm, sub: p.games ? `${Math.round((p.motm / p.games) * 100)}% of games` : "" },
    { label: "Passes", value: p.passes.toLocaleString("en-GB"), sub: `${per(p.passes)} per game${cpu}` },
    { label: "Tackles", value: p.tackles.toLocaleString("en-GB"), sub: `${per(p.tackles)} per game${cpu}` },
    {
      label: "Red cards",
      value: p.redsCpu ? `${p.reds}` : p.redsEa,
      sub: p.redsCpu ? `${p.redsEa} on EA · ${p.redsCpu} were the CPU's` : p.controlsCpu ? "EA total · may include CPU cards" : "",
    },
    ...(t?.games
      ? [
          { label: "Clean sheets", value: t.cleanSheets, sub: `in ${t.games} saved games` },
          { label: "Conceded", value: t.conceded, sub: `${(t.conceded / t.games).toFixed(1)} per game while on the pitch` },
        ]
      : []),
    ...(t?.afkGames ? [{ label: "AFK games", value: t.afkGames, sub: `${idleLabel(t.idleSeconds)} idle in saved games` }] : []),
  ];
  const maxSave = Math.max(1, ...(t?.saveTypes ?? []).map((x) => x.n));

  return (
    <main className="wrap">
      <a href="/players" style={{ fontWeight: 600 }}>← All players</a>

      <section className="row" style={{ gap: 32, alignItems: "stretch" }}>
        <div className="card-strong stack" style={{ flex: "0 0 230px", justifyContent: "space-between", minHeight: 260 }}>
          <div className="row between" style={{ alignItems: "flex-start" }}>
            <div>
              <div className="display accent num" style={{ fontSize: 72, fontWeight: 900 }}>{p.overall || "–"}</div>
              <PosLabel position={p.position} role={p.role} />
            </div>
            {p.height ? <span className="text-2" style={{ fontSize: 13 }}>{p.height} cm</span> : null}
          </div>
          {p.photo ? <img src={p.photo} alt="" style={{ width: "100%", borderRadius: 12 }} /> : null}
          <div>
            <div className="display" style={{ fontSize: 28 }}>{p.proName}</div>
            <div className="row text-2" style={{ gap: 8, fontSize: 14 }}>
              <Flag nation={p.nation} size={28} />
              {p.eaPosition && p.eaPosition !== p.position ? `${p.eaPosition} on EA` : "Pro"}
            </div>
          </div>
        </div>
        <div className="stack" style={{ flex: "1 1 520px", justifyContent: "flex-end" }}>
          <span className="eyebrow">Player profile · this season</span>
          <h1 className="display" style={{ textTransform: "none" }}>{p.gamertag}</h1>
          {p.nickname ? <div className="display accent" style={{ fontSize: 26 }}>“{p.nickname}”</div> : null}
          {p.bio ? <p className="text-2" style={{ margin: 0, fontSize: 17, maxWidth: 640 }}>{p.bio}</p> : null}
        </div>
      </section>

      <section className="grid grid-170">
        {tiles.map((t) => (
          <div key={t.label} className="card">
            <div className="kpi-label">{t.label}</div>
            <div className="display kpi-value num" style={{ fontSize: 40 }}>{t.value}</div>
            <div className="kpi-sub">{t.sub}</div>
          </div>
        ))}
      </section>

      <section className="row" style={{ alignItems: "stretch", gap: 24 }}>
        <div className="card stack" style={{ flex: "1 1 520px" }}>
          <div className="section-head">
            <h2 className="display" style={{ fontSize: 26 }}>Goals, last 10 games</h2>
            <span className="muted" style={{ fontSize: 13 }}>Oldest → newest</span>
          </div>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 10, height: 160, borderBottom: "1px solid var(--line-2)" }}>
            {last10.map((g, i) => (
              <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-end", gap: 6, height: "100%" }}>
                <span className="text-2 num" style={{ fontSize: 13 }}>{g}</span>
                <div style={{ width: "100%", maxWidth: 44, borderRadius: "6px 6px 0 0", background: g ? "var(--accent)" : "var(--line-2)", height: g ? Math.round((g / maxG) * 120) : 4 }} />
              </div>
            ))}
          </div>
          <span className="muted" style={{ fontSize: 13 }}>
            {last10.reduce((a, b) => a + b, 0)} goals in the last 10, season rate {per(p.goals)} per game.
          </span>
        </div>
        <div className="card stack" style={{ flex: "1 1 320px" }}>
          <h2 className="display" style={{ fontSize: 26 }}>Success rates</h2>
          {[
            ["Pass success", p.passPct],
            ["Shot success", p.shotPct],
            ["Tackle success", p.tacklePct],
          ].map(([label, v]) => (
            <div key={label as string} className="stack" style={{ gap: 6 }}>
              <div className="row between"><span>{label}</span><span className="num">{v}%</span></div>
              <div className="bar"><div style={{ width: `${v}%` }} /></div>
            </div>
          ))}
        </div>
      </section>

      {t?.saves ? (
        <section className="card stack">
          <div className="section-head">
            <h2 className="display" style={{ fontSize: 26 }}>Saves by type</h2>
            <span className="muted" style={{ fontSize: 13 }}>{t.saves} saves in {t.games} saved games</span>
          </div>
          {t.saveTypes.map((x) => (
            <div key={x.label} className="stack" style={{ gap: 6 }}>
              <div className="row between"><span>{x.label}</span><span className="num">{x.n}</span></div>
              <div className="bar"><div style={{ width: `${Math.round((x.n / maxSave) * 100)}%` }} /></div>
            </div>
          ))}
          <span className="muted" style={{ fontSize: 13 }}>EA doesn&apos;t give every save a type; those are counted as Other.</span>
        </section>
      ) : null}

      {byArchetype ? (
        <section className="stack">
          <div className="section-head">
            <h2 className="display">{byArchetype.season} by archetype</h2>
            <span className="muted" style={{ fontSize: 13 }}>Whole season, most played first</span>
          </div>
          <div className="grid grid-270">
            {byArchetype.rows.map((a) => {
              const t = a.total;
              const g = a.inGame;
              const keeper = archetypeGroup(a.archetype) === "Keeper";
              const total = byArchetype.rows.reduce((n, x) => n + x.total.games, 0);
              const stats: [string, string | number][] = keeper
                ? [
                    ["Saves", t.saves],
                    ["Saves per game", t.games ? (t.saves / t.games).toFixed(1) : "–"],
                    ["Conceded", t.conceded],
                    ["Conceded per game", t.games ? (t.conceded / t.games).toFixed(1) : "–"],
                    ["Clean sheets", t.cleanSheets],
                    ["Save %", g?.savePct !== undefined ? `${g.savePct}%` : "–"],
                    ["MOTM", t.motm],
                  ]
                : [
                    ["Goals", t.goals],
                    ["Assists", t.assists],
                    ["G+A per game", t.games ? ((t.goals + t.assists) / t.games).toFixed(2) : "–"],
                    ["MOTM", t.motm],
                    ["Passes", t.passes],
                    ["Tackles", t.tackles],
                    ["Interceptions", g?.interceptions ?? "–"],
                    ["Shots per game", g?.avgShots ?? "–"],
                    ["Conversion", g?.conversionPct !== undefined ? `${g.conversionPct}%` : "–"],
                    ["Pass success", g?.passPct !== undefined ? `${g.passPct}%` : "–"],
                    ["Tackle success", g?.tacklePct !== undefined ? `${g.tacklePct}%` : "–"],
                  ];
              return (
                <div key={a.archetype} className="card stack" style={{ gap: 14, border: a.archetype === currentArchetype ? "1px solid var(--accent)" : undefined }}>
                  <div className="row between" style={{ alignItems: "flex-start" }}>
                    <div className="stack" style={{ gap: 2 }}>
                      <span className="kpi-label">{archetypeGroup(a.archetype)}</span>
                      <strong className="display" style={{ fontSize: 24 }}>{archetypeName(a.archetype)}</strong>
                    </div>
                    {a.archetype === currentArchetype ? <span className="chip">Current</span> : null}
                  </div>
                  <div className="stack" style={{ gap: 6 }}>
                    <div className="row between">
                      <span className="text-2">Games</span>
                      <span className="display num" style={{ fontSize: 32, lineHeight: 1 }}>{t.games}</span>
                    </div>
                    <div className="bar" role="img" aria-label={`${t.games} of ${total} games`}>
                      <div style={{ width: `${total ? Math.round((t.games / total) * 100) : 0}%` }} />
                    </div>
                    <span className="muted" style={{ fontSize: 12 }}>{total ? Math.round((t.games / total) * 100) : 0}% of the season</span>
                  </div>
                  <dl className="arch-stats">
                    {stats.map(([k, v]) => (
                      <div key={k}><dt>{k}</dt><dd className="num">{v}</dd></div>
                    ))}
                  </dl>
                </div>
              );
            })}
          </div>
          <p className="muted" style={{ fontSize: 13, margin: 0 }}>
            From the in-game Archetypes › Statistics screen ({when(byArchetype.asOf)}), plus every game the site saved since.
            Percentages and shots are the game&apos;s, as of then. Goals and assists here are EA&apos;s, so they include the CPU&apos;s for
            whoever runs it.
          </p>
        </section>
      ) : null}

      {archetypes.length > 1 ? (
        <section className="stack">
          <div className="section-head">
            <h2 className="display">{byArchetype ? "Saved games by archetype" : "By archetype"}</h2>
            <span className="muted" style={{ fontSize: 13 }}>From the saved games, most played first</span>
          </div>
          <div className="table-box">
            <table>
              <thead>
                <tr><th>Archetype</th><th>Games</th><th>W-D-L</th><th>Avg rating</th><th>Goals</th><th>Assists</th><th>G+A per game</th><th>MOTM</th>{archetypes.some((a) => a.saves) ? <th>Saves per game</th> : null}</tr>
              </thead>
              <tbody>
                {archetypes.map((a) => (
                  <tr key={a.archetype}>
                    <td>
                      <strong>{archetypeName(a.archetype)}</strong>
                      {a.games < MIN_GAMES ? <span className="chip chip-ghost" style={{ marginLeft: 8 }}>small sample</span> : null}
                    </td>
                    <td>{a.games}</td>
                    <td>{a.w}-{a.d}-{a.l}</td>
                    <td style={{ fontWeight: 700 }}>{a.rating.toFixed(1)}</td>
                    <td>{a.goals}</td>
                    <td>{a.assists}</td>
                    <td>{((a.goals + a.assists) / a.games).toFixed(2)}</td>
                    <td>{a.motm}</td>
                    {archetypes.some((x) => x.saves) ? <td>{(a.saves / a.games).toFixed(1)}</td> : null}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="muted" style={{ fontSize: 13, margin: 0 }}>
            {byArchetype ? "Only the games the site saved, with results and ratings the in-game screen doesn't show." : "EA's season totals can't be split by archetype, so this only covers games the site saved."}{" "}
            Goals and assists are the player&apos;s own. Under {MIN_GAMES} games says little.
          </p>
        </section>
      ) : null}

      <section className="stack">
        <div className="section-head">
          <h2 className="display">Match log</h2>
          {positionsPlayed ? <span className="text-2">Played: {positionsPlayed}</span> : null}
        </div>
        {log.length ? (
          <div className="table-box">
            <table>
              <thead>
                <tr><th>Match</th><th>Pos</th><th>Rating</th><th>G</th><th>A</th><th>Shots</th><th>Passes</th><th>Tackles won</th></tr>
              </thead>
              <tbody>
                {log.map((m) => (
                  <tr key={m.match_id}>
                    <td>
                      <a className="player-cell" href={`/matches/${m.match_id}`} style={{ textDecoration: "none", color: "var(--text)" }}>
                        <ResultBadge r={m.result} />
                        <Crest id={m.opp_crest} size={26} />
                        <strong className="num">{m.goals_for}–{m.goals_against}</strong> {m.opp_name}
                        <span className="muted" style={{ fontSize: 13 }}>{when(m.ts)}</span>
                        {m.motm ? <span className="chip">MOTM</span> : null}
                        {m.controls_cpu ? <span className="chip chip-ghost">+CPU</span> : null}
                        {m.fixed ? <span className="chip chip-ghost">Real stats</span> : null}
                        {m.clean_sheet ? <span className="chip chip-ghost">CS</span> : null}
                        {m.idle_seconds >= AFK_SECONDS ? <span className="chip chip-shame">AFK {idleLabel(m.idle_seconds)}</span> : null}
                      </a>
                    </td>
                    <td>{m.position ? <PosLabel position={m.position} /> : <span className="text-2">{groupShort(m.pos)}</span>}</td>
                    <td style={{ fontWeight: 700 }}>{m.rating.toFixed(1)}</td>
                    <td>{m.goals}</td><td>{m.assists}</td><td>{m.shots}</td>
                    <td>{m.passes_made}{m.pass_attempts !== null ? `/${m.pass_attempts}` : ""}</td>
                    <td>{m.tackles_made}{m.tackle_attempts !== null ? `/${m.tackle_attempts}` : ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="muted">No saved matches for {p.gamertag} yet.</p>
        )}
        <p className="muted" style={{ fontSize: 13, margin: 0 }}>
          Goals, assists and shots are the player&apos;s own. “+CPU” = EA added the CPU teammates&apos; passes, tackles and cards
          to this line that game. “Real stats” = corrected from the in-game screen.
          Positions are EA&apos;s group (FWD/MID/DEF/GK) unless the exact one was entered with Fix stats on the match page.
        </p>
      </section>

      {p.controlsCpu || p.redsEa > 0 ? (
        <section className="card stack">
          <h2 className="display" style={{ fontSize: 22 }}>Red cards from before tracking</h2>
          <p className="text-2" style={{ margin: 0 }}>
            EA only gives a season total ({p.redsEa}). If some of those were the CPU&apos;s, enter how many here once.
          </p>
          <SeasonRedsForm player={p.gamertag} current={seasonCpuReds} />
        </section>
      ) : null}
    </main>
  );
}
