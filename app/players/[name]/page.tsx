import { notFound } from "next/navigation";
import { Crest, Flag, PosLabel, Rating, ResultBadge, when } from "@/components/bits";
import { SeasonRedsForm } from "@/components/Forms";
import { COUNTER_STATS } from "@/lib/counters";
import { archetypeGroup, archetypeName, groupShort } from "@/lib/ea-assets";
import { MIN_GAMES } from "@/lib/insights";
import { AFK_SECONDS, getAdvanced, getArchetypeSeason, getArchetypes, getCareer, getMembers, getPlayerLog, getSeasonCpuReds, getTracked, idleLabel, UNKNOWN_ARCHETYPE } from "@/lib/stats";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ name: string }> }) {
  return { title: decodeURIComponent((await params).name) };
}

export default async function PlayerPage({ params }: { params: Promise<{ name: string }> }) {
  const name = decodeURIComponent((await params).name);
  const members = await getMembers();
  const p = members.find((m) => m.gamertag === name);
  if (!p) notFound();
  const [log, seasonCpuReds, tracked, archetypes, byArchetype, career, advanced] = await Promise.all([
    getPlayerLog(name, 20),
    getSeasonCpuReds(name),
    getTracked(),
    getArchetypes(name),
    getArchetypeSeason(name),
    getCareer(name),
    getAdvanced(),
  ]);
  const adv = advanced.get(name);
  const currentArchetype = log[0]?.archetype ?? null;
  const t = tracked.get(name);
  const playing = members.filter((m) => m.games > 0);
  const squadRating = playing.length ? playing.reduce((s, m) => s + m.rating, 0) / playing.length : 0;
  const per = (v: number) => (p.games ? (v / p.games).toFixed(2) : "0");
  // own goals from the saved games (EA's prevGoals include the CPU's for whoever controls it)
  const last10 = log.length ? log.slice(0, 10).map((m) => m.goals).reverse() : p.lastTenGoals;
  const maxG = Math.max(1, ...last10);
  const posCount = new Map<string, number>();
  for (const m of log) {
    const key = m.position || groupShort(m.pos);
    if (key) posCount.set(key, (posCount.get(key) ?? 0) + 1);
  }
  const positionsPlayed = [...posCount.entries()].sort((a, b) => b[1] - a[1]).map(([k, n]) => `${k} ×${n}`).join(" · ");

  // EA's totals for games from before the site saved matches can't have the CPU's share taken out
  const cpuWarn = p.cpuEarlyGames
    ? `May include the CPU's from ${p.cpuEarlyGames} earlier game${p.cpuEarlyGames === 1 ? "" : "s"}`
    : undefined;
  const tiles: { label: string; value: string | number; sub: string; warn?: string }[] = [
    { label: "Games", value: p.games, sub: `${p.winRate}% win rate` },
    { label: "Goals", value: p.goals, sub: `${per(p.goals)} per game${p.goalsEa !== p.goals ? ` · EA: ${p.goalsEa} incl. CPU` : ""}`, warn: cpuWarn },
    { label: "Assists", value: p.assists, sub: `${per(p.assists)} per game${p.assistsEa !== p.assists ? ` · EA: ${p.assistsEa} incl. CPU` : ""}`, warn: cpuWarn },
    {
      label: "Avg rating",
      value: p.rating.toFixed(1),
      sub: `Squad avg ${squadRating.toFixed(1)}${p.ratingEstimated ? ` · ${p.ratingEstimated} +CPU game${p.ratingEstimated === 1 ? "" : "s"} estimated` : ""}${p.ratingUnknown ? ` · ${p.ratingUnknown} +CPU game${p.ratingUnknown === 1 ? "" : "s"} left out` : ""}${p.ratingEstimated || p.ratingUnknown ? ` · EA: ${p.ratingEa.toFixed(1)} incl. CPU` : ""}`,
      warn: cpuWarn,
    },
    { label: "MOTM", value: p.motm, sub: p.games ? `${Math.round((p.motm / p.games) * 100)}% of games` : "" },
    { label: "Passes", value: p.passes.toLocaleString("en-GB"), sub: `${per(p.passes)} per game${p.passesEa !== p.passes ? ` · EA: ${p.passesEa.toLocaleString("en-GB")} incl. CPU` : ""}`, warn: cpuWarn },
    { label: "Tackles", value: p.tackles.toLocaleString("en-GB"), sub: `${per(p.tackles)} per game${p.tacklesEa !== p.tackles ? ` · EA: ${p.tacklesEa} incl. CPU` : ""}`, warn: cpuWarn },
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
    // members/career/stats: all seasons at the club; only worth a tile once it differs from this season
    ...(career && career.games > p.games
      ? [{ label: "All-time at the club", value: career.games, sub: `games · ${career.goals} goals · ${career.assists} assists (EA)` }]
      : []),
    ...(t?.afkGames ? [{ label: "AFK games", value: t.afkGames, sub: `${idleLabel(t.idleSeconds)} idle in saved games` }] : []),
  ];
  const maxSave = Math.max(1, ...(t?.saveTypes ?? []).map((x) => x.n));

  return (
    <main className="bands">
      <section className="band band-club profile-hero">
        <div className="wrap" style={{ gap: 28 }}>
      <a href="/players" className="back-link">
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 2 4 7l5 5" /></svg>
        All players
      </a>

      <section className="row" style={{ gap: 40, alignItems: "stretch" }}>
        <div className="profile-card stack" style={{ flex: "0 0 240px", justifyContent: "space-between", minHeight: 260 }}>
          <div className="row between" style={{ alignItems: "flex-start" }}>
            <div>
              <div className="display num" style={{ fontSize: 72 }}>{p.overall || "–"}</div>
              <PosLabel position={p.position} role={p.role} />
            </div>
            {p.height ? <span className="text-2" style={{ fontSize: 14 }}>{p.height} cm</span> : null}
          </div>
          {p.photo ? <img src={p.photo} alt="" style={{ width: "100%", borderRadius: 12 }} /> : null}
          <div>
            <div style={{ fontSize: 22, fontWeight: 800 }}>{p.proName}</div>
            <div className="row text-2" style={{ gap: 8, fontSize: 14 }}>
              <Flag nation={p.nation} size={28} />
              {p.eaPosition && p.eaPosition !== p.position ? `${p.eaPosition} on EA` : "Pro"}
            </div>
          </div>
        </div>
        <div className="stack" style={{ flex: "1 1 520px", justifyContent: "flex-end" }}>
          <h1 className="display" style={{ textTransform: "none" }}>{p.gamertag}</h1>
          {p.nickname ? <div className="display profile-nick">“{p.nickname}”</div> : null}
          {p.bio ? <p className="text-2" style={{ margin: 0, fontSize: 18, maxWidth: "60ch" }}>{p.bio}</p> : null}
        </div>
      </section>
        </div>
      </section>

      <section className="band">
        <div className="wrap">

      <section className="grid grid-170">
        {tiles.map((t) => (
          <div key={t.label} className="card">
            <div className="kpi-label">{t.label}</div>
            <div className="kpi-value">{t.value}</div>
            <div className="kpi-sub">{t.sub}</div>
            {t.warn ? <div className="kpi-sub cpu-warn">{t.warn}</div> : null}
          </div>
        ))}
      </section>

      <section className="row" style={{ alignItems: "stretch", gap: 24 }}>
        <div className="card stack" style={{ flex: "1 1 520px" }}>
          <div className="section-head">
            <h2 className="card-title">Goals, last 10 games</h2>
            <span className="muted" style={{ fontSize: 14 }}>Oldest to newest</span>
          </div>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 10, height: 160, borderBottom: "1px solid var(--line-2)" }}>
            {last10.map((g, i) => (
              <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-end", gap: 6, height: "100%" }}>
                <span className="text-2 num" style={{ fontSize: 14 }}>{g}</span>
                <div style={{ width: "100%", maxWidth: 44, borderRadius: "6px 6px 0 0", background: g ? "var(--accent)" : "var(--line-2)", height: g ? Math.round((g / maxG) * 120) : 4 }} />
              </div>
            ))}
          </div>
          <span className="muted" style={{ fontSize: 14 }}>
            {last10.reduce((a, b) => a + b, 0)} goals in the last 10, season rate {per(p.goals)} per game.
          </span>
        </div>
        <div className="card stack" style={{ flex: "1 1 320px" }}>
          <h2 className="card-title">Success rates</h2>
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
            <h2 className="card-title">Saves by type</h2>
            <span className="muted" style={{ fontSize: 14 }}>{t.saves} saves in {t.games} saved games</span>
          </div>
          {t.saveTypes.map((x) => (
            <div key={x.label} className="stack" style={{ gap: 6 }}>
              <div className="row between"><span>{x.label}</span><span className="num">{x.n}</span></div>
              <div className="bar"><div style={{ width: `${Math.round((x.n / maxSave) * 100)}%` }} /></div>
            </div>
          ))}
          <span className="muted" style={{ fontSize: 14 }}>EA doesn&apos;t give every save a type; those are counted as Other.</span>
        </section>
      ) : null}

      {adv?.games ? (
        <section className="card stack">
          <div className="section-head">
            <h2 className="card-title">More stats</h2>
            <span className="muted" style={{ fontSize: 14 }}>{adv.games} saved games</span>
          </div>
          <dl className="arch-stats">
            {COUNTER_STATS.map((s) => (
              <div key={s.key}>
                <dt title={s.approx ?? s.fewChecks}>{s.approx ? "≈ " : ""}{s.label}{s.rough ? "*" : ""}{s.fewChecks ? "†" : ""}</dt>
                <dd className="num">
                  {adv.totals[s.key]} <span className="muted" style={{ fontSize: 12 }}>({(adv.totals[s.key] / adv.games).toFixed(1)} per game)</span>
                </dd>
              </div>
            ))}
          </dl>
          <p className="muted" style={{ fontSize: 13, margin: 0 }}>
            The player&apos;s own (never the CPU&apos;s), in the games the site saved, from EA&apos;s hidden event counters as decoded by
            the <a href="https://github.com/Interactive-63/eafc-pro-clubs-api-research">EA FC Pro Clubs API research</a> project.
            * Not confirmed yet: didn't match the in-game screen exactly. ≈ Close to the in-game number, but can be off by one to three in a game. † Matched the in-game screen, but only one checked game had any.
          </p>
        </section>
      ) : null}

        </div>
      </section>

      <section className="band section-light">
        <div className="wrap">
      {byArchetype ? (
        <section className="stack">
          <div className="section-head">
            <h2 className="display">{byArchetype.season} by archetype</h2>
            <span className="muted" style={{ fontSize: 14 }}>Whole season, most played first</span>
          </div>
          <div className="grid grid-270">
            {byArchetype.rows.map((a) => {
              const t = a.total;
              const g = a.inGame;
              const unknown = a.archetype === UNKNOWN_ARCHETYPE;
              const keeper = !unknown && archetypeGroup(a.archetype) === "Keeper";
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
                <div key={a.archetype} className="card stack" style={{ gap: 14, border: a.archetype === currentArchetype ? "1px solid var(--accent)" : undefined, opacity: unknown ? 0.75 : undefined }}>
                  <div className="row between" style={{ alignItems: "flex-start" }}>
                    <div className="stack" style={{ gap: 2 }}>
                      <span className="kpi-label">{unknown ? "Archetype unknown" : archetypeGroup(a.archetype)}</span>
                      <strong style={{ fontSize: 20, fontWeight: 800 }}>{unknown ? "Earlier games" : archetypeName(a.archetype)}</strong>
                    </div>
                    {a.archetype === currentArchetype ? <span className="chip">Current</span> : null}
                  </div>
                  {p.controlsCpu && (g || unknown) ? (
                    <div className="kpi-sub cpu-warn">
                      {unknown ? "EA's numbers: may include the CPU's" : `In-game numbers may include the CPU's${a.since.games ? `; the ${a.since.games} saved since are the player's own` : ""}`}
                    </div>
                  ) : null}
                  <div className="stack" style={{ gap: 6 }}>
                    <div className="row between">
                      <span className="text-2">Games</span>
                      <span className="num" style={{ fontSize: 28, fontWeight: 800, lineHeight: 1 }}>{t.games}</span>
                    </div>
                    <div className="bar" role="img" aria-label={`${t.games} of ${total} games`}>
                      <div style={{ width: `${total ? Math.round((t.games / total) * 100) : 0}%` }} />
                    </div>
                    <span className="muted" style={{ fontSize: 12 }}>{total ? Math.round((t.games / total) * 100) : 0}% of the season</span>
                  </div>
                  <dl className="arch-stats">
                    {stats.filter(([, v]) => v !== "–").map(([k, v]) => (
                      <div key={k}><dt>{k}</dt><dd className="num">{v}</dd></div>
                    ))}
                  </dl>
                </div>
              );
            })}
          </div>
          <p className="muted" style={{ fontSize: 13, margin: 0 }}>
            {byArchetype.asOf !== null ? (
              <>
                From the in-game Archetypes › Statistics screen ({when(byArchetype.asOf)}), plus every game the site saved since.
                Percentages and shots are the game&apos;s, as of then.
              </>
            ) : (
              <>
                From the league games the site saved. EA doesn&apos;t split season totals by archetype, so the games from
                before the site saved matches are under Earlier games; a screenshot of the in-game Archetypes › Statistics
                screen fills those in.
              </>
            )}{" "}
            Goals and assists here are EA&apos;s, so they include the CPU&apos;s for whoever runs it.
          </p>
        </section>
      ) : null}

      {archetypes.length > 1 ? (
        <section className="stack">
          <div className="section-head">
            <h2 className="display">{byArchetype ? "Saved games by archetype" : "By archetype"}</h2>
            <span className="muted" style={{ fontSize: 14 }}>From the saved games, most played first</span>
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
                    <td style={{ fontWeight: 700 }}><Rating rating={a.rating} /></td>
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
                        <span className="muted" style={{ fontSize: 14 }}>{when(m.ts)}</span>
                        {m.motm ? <span className="chip">MOTM</span> : null}
                        {m.controls_cpu ? <span className="chip chip-ghost">+CPU</span> : null}
                        {m.fixed ? <span className="chip chip-ghost">Real stats</span> : null}
                        {m.clean_sheet ? <span className="chip chip-ghost">CS</span> : null}
                        {m.idle_seconds >= AFK_SECONDS ? <span className="chip chip-shame">AFK {idleLabel(m.idle_seconds)}</span> : null}
                      </a>
                    </td>
                    <td>{m.position ? <PosLabel position={m.position} /> : <span className="text-2">{groupShort(m.pos)}</span>}</td>
                    <td style={{ fontWeight: 700 }}><Rating rating={m.rating} ea={m.ea_rating} est={m.rating_est} /></td>
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
          Goals, assists, shots, passes and tackles are the player&apos;s own. “+CPU” = the player ran the CPU teammates that
          game, so EA&apos;s line also had theirs (red cards still do). “Real stats” = corrected from the in-game screen.
          Positions are EA&apos;s group (FWD/MID/DEF/GK) unless the exact one was entered with Fix stats on the match page.
        </p>
      </section>

        </div>
      </section>

      {p.controlsCpu || p.redsEa > 0 ? (
        <section className="band">
        <div className="wrap">
        <section className="card stack">
          <h2 className="card-title">Red cards from before tracking</h2>
          <p className="text-2" style={{ margin: 0 }}>
            EA only gives a season total ({p.redsEa}). If some of those were the CPU&apos;s, enter how many here once.
          </p>
          <SeasonRedsForm player={p.gamertag} current={seasonCpuReds} />
        </section>
        </div>
        </section>
      ) : null}
    </main>
  );
}
