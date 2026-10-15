import { notFound } from "next/navigation";
import { CaptainForm, CpuRedButton, FixStatsForm } from "@/components/Forms";
import { Crest, Flag, KitShirt, PosLabel, Rating, ResultBadge, when } from "@/components/bits";
import { COUNTER_STATS, counterStat } from "@/lib/counters";
import { groupShort } from "@/lib/ea-assets";
import { AFK_SECONDS, divisionName, getClub, getMatch, getMembers, getSeason, idleLabel, saveBreakdown } from "@/lib/stats";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const data = await getMatch((await params).id);
  return { title: data ? `${data.match.goals_for}–${data.match.goals_against} vs ${data.match.opp_name}` : "Match" };
}

export default async function MatchPage({ params }: { params: Promise<{ id: string }> }) {
  const data = await getMatch((await params).id);
  if (!data) notFound();
  const { match: m, players, team, cpuReds } = data;
  const [club, memberList] = await Promise.all([getClub(), getMembers()]);
  const members = new Map(memberList.map((x) => [x.gamertag, x]));
  const cpuGoals = m.goals_for - players.reduce((s, p) => s + p.goals, 0);
  const scorers = [
    ...players.filter((p) => p.goals > 0).map((p) => (p.goals > 1 ? `${p.player} ×${p.goals}` : p.player)),
    ...(cpuGoals > 0 ? [cpuGoals > 1 ? `CPU ×${cpuGoals}` : "CPU"] : []),
  ];
  const motm = players.find((p) => p.motm);
  const quitters = players.filter((p) => p.quit).map((p) => `${p.player} quit at ${Math.round(p.seconds / 60)}′`);
  // EA sends promotion match games as league games; the season replay knows which ones they were
  const promo = (await getSeason())?.promotionGames[m.id] ?? null;
  const ourKit = m.our_kit ?? club.kits[0]?.colors;
  const stat = (k: string) => [Number(team.us?.[k] ?? 0), Number(team.them?.[k] ?? 0)];
  const rows = [
    { label: "Shots", v: stat("shots") },
    { label: "Passes completed", v: stat("passesmade"), sub: stat("passattempts") },
    { label: "Tackles won", v: stat("tacklesmade"), sub: stat("tackleattempts") },
    { label: "Saves", v: stat("saves") },
    { label: "Red cards", v: stat("redcards") },
  ];

  return (
    <main className="wrap">
      <a href="/seasons" style={{ fontWeight: 600 }}>← All matches</a>

      <section className="card stack" style={{ alignItems: "center", gap: 22, padding: "36px 28px" }}>
        <span className="eyebrow" style={{ textAlign: "center" }}>
          {promo
            ? `Promotion match to ${divisionName(Math.max(0, promo.division - 1))} · Game ${promo.game} of ${promo.of}`
            : m.match_type === "leagueMatch" ? "League" : m.match_type === "playoffMatch" ? "Playoff" : "Friendly"}{" "}
          · {when(m.ts)} · {m.minutes} min
          {m.dnf ? " · opponent quit" : ""}
          {quitters.length ? ` · ${quitters.join(", ")}` : ""}
        </span>
        <div className="row" style={{ justifyContent: "center", gap: 28, width: "100%" }}>
          <div className="stack" style={{ flex: "1 1 220px", alignItems: "center", gap: 10 }}>
            <div className="row" style={{ gap: 6, flexWrap: "nowrap" }}>
              <Crest id={club.crestAssetId} size={104} alt={`${club.name} crest`} />
              {ourKit ? <KitShirt colors={ourKit} size={52} /> : null}
            </div>
            <span className="display" style={{ fontSize: 28, textAlign: "center" }}>{club.name}</span>
            <span className="text-2" style={{ textAlign: "center" }}>{scorers.join(" · ") || "No scorers"}</span>
          </div>
          <div className="stack" style={{ alignItems: "center", gap: 8 }}>
            <span className="display accent num" style={{ fontSize: 88, fontWeight: 900 }}>{m.goals_for} – {m.goals_against}</span>
            <ResultBadge r={m.result} />
          </div>
          <div className="stack" style={{ flex: "1 1 220px", alignItems: "center", gap: 10 }}>
            <div className="row" style={{ gap: 6, flexWrap: "nowrap" }}>
              {m.opp_kit ? <KitShirt colors={m.opp_kit} size={52} /> : null}
              <Crest id={m.opp_crest} size={104} alt={`${m.opp_name} crest`} />
            </div>
            <span className="display" style={{ fontSize: 28, textAlign: "center" }}>{m.opp_name}</span>
          </div>
        </div>
        <div className="row" style={{ justifyContent: "center", gap: 12 }}>
          {motm ? (
            <span className="row" style={{ gap: 8, background: "var(--surface-2)", borderRadius: 999, padding: "10px 18px" }}>
              <Flag nation={members.get(motm.player)?.nation} />
              Man of the match: <strong>{motm.player}</strong> · <Rating rating={motm.rating} ea={motm.ea_rating} est={motm.rating_est} />
            </span>
          ) : null}
          {m.captain ? <span className="chip chip-ghost" style={{ padding: "8px 12px" }}>Captain: {m.captain}</span> : null}
        </div>
      </section>

      <section className="stack">
        <h2 className="display">Team stats</h2>
        <div className="card" style={{ padding: "8px 24px" }}>
          <div className="row between muted" style={{ fontSize: 13, padding: "10px 0", borderBottom: "1px solid var(--line)" }}>
            <span>{club.name}</span><span>{m.opp_name}</span>
          </div>
          {rows.map((r) => {
            const [a, b] = r.v;
            const share = a + b ? Math.round((a / (a + b)) * 100) : 50;
            return (
              <div key={r.label} className="stack" style={{ gap: 8, padding: "14px 0", borderBottom: "1px solid var(--line)" }}>
                <div className="row between" style={{ flexWrap: "nowrap" }}>
                  <strong className="num" style={{ fontSize: 18 }}>{a}{r.sub ? <span className="muted" style={{ fontWeight: 400 }}>/{r.sub[0]}</span> : null}</strong>
                  <span className="text-2">{r.label}</span>
                  <strong className="num" style={{ fontSize: 18 }}>{b}{r.sub ? <span className="muted" style={{ fontWeight: 400 }}>/{r.sub[1]}</span> : null}</strong>
                </div>
                <div className="bar" style={{ height: 6, background: "var(--line-2)" }}><div style={{ width: `${share}%`, borderRadius: 0 }} /></div>
              </div>
            );
          })}
        </div>
        <p className="muted" style={{ fontSize: 13, margin: 0 }}>EA&apos;s match feed has no possession figure. Totals are the human players&apos; lines added up.</p>
      </section>

      <section className="stack">
        <h2 className="display">Player ratings</h2>
        <div className="table-box">
          <table>
            <thead>
              <tr><th>Player</th><th>Pos</th><th>Rating</th><th>G</th><th>A</th><th>Shots</th><th>Passes</th><th>Tackles won</th><th>Saves</th><th>Red card</th></tr>
            </thead>
            <tbody>
              {players.map((p) => {
                const mem = members.get(p.player);
                return (
                  <tr key={p.player}>
                    <td>
                      <div className="player-cell">
                        <Flag nation={mem?.nation} />
                        <a href={`/players/${encodeURIComponent(p.player)}`}>{p.player}</a>
                        {p.motm ? <span className="chip">MOTM</span> : null}
                        {m.captain === p.player ? <span className="chip chip-ghost">C</span> : null}
                        {p.controls_cpu ? <span className="chip chip-ghost" title="This player ran the CPU teammates; EA added their stats to this line. The table shows the player's own, except red cards">+CPU</span> : null}
                        {p.quit ? (
                          <span className="chip chip-shame" title="Left mid-game. EA wiped this line (the rating is its quit penalty); passes and the like come from the hidden counters, goals conceded are the team's">Quit {Math.round(p.seconds / 60)}′</span>
                        ) : null}
                        {p.fixed ? <span className="chip chip-ghost" title="Corrected from the in-game screen">Real stats</span> : null}
                        {p.clean_sheet ? <span className="chip chip-ghost" title="EA credited a clean sheet">CS</span> : null}
                        {p.idle_seconds >= AFK_SECONDS ? (
                          <span className="chip chip-shame" title="Real-world time EA counted as idle">AFK {idleLabel(p.idle_seconds)}</span>
                        ) : null}
                      </div>
                    </td>
                    <td>
                      {p.position ? (
                        <PosLabel position={p.position} />
                      ) : (
                        <span className="text-2" title="EA only records the group; set the exact position with Fix stats">{groupShort(p.pos)}</span>
                      )}
                    </td>
                    <td style={{ fontWeight: 700, color: p.motm ? "var(--accent)" : undefined }}><Rating rating={p.rating} ea={p.ea_rating} est={p.rating_est} /></td>
                    <td title={p.goals !== p.ea_goals ? `EA: ${p.ea_goals} incl. CPU` : undefined}>{p.goals}</td>
                    <td title={p.assists !== p.ea_assists ? `EA: ${p.ea_assists} incl. CPU` : undefined}>{p.assists}</td>
                    <td>{p.shots}</td>
                    <td title={p.passes_made !== p.ea_passes_made ? `EA: ${p.ea_passes_made}/${p.ea_pass_attempts} incl. CPU` : undefined}>
                      {p.passes_made}{p.pass_attempts !== null ? `/${p.pass_attempts}` : ""}
                    </td>
                    <td title={p.tackles_made !== p.ea_tackles_made ? `EA: ${p.ea_tackles_made} incl. CPU` : undefined}>
                      {p.tackles_made}{p.tackle_attempts !== null ? `/${p.tackle_attempts}` : ""}
                    </td>
                    <td>
                      {p.saves || "–"}
                      {p.saves ? (
                        <div className="muted" style={{ fontSize: 12, whiteSpace: "nowrap" }}>
                          {saveBreakdown(p).map((x) => `${x.n} ${x.label.toLowerCase()}`).join(" · ")}
                        </div>
                      ) : null}
                    </td>
                    <td>{p.reds ? <CpuRedButton matchId={m.id} player={p.player} isCpu={cpuReds.has(p.player)} /> : <span className="muted">–</span>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="muted" style={{ fontSize: 13, margin: 0 }}>
          Goals, assists, shots, passes and tackles are each player&apos;s own; goals the CPU teammates scored are listed as
          “CPU”, and EA&apos;s number (incl. the CPU&apos;s) shows when you hover a cell. EA still puts the CPU&apos;s red cards on
          the line marked “+CPU”, gives no own tackle attempts for it, and only records forward/midfielder/defender/keeper.
          Use <a href="#fix">Fix stats</a> below with the numbers from the in-game Player Performance screen to correct those.
        </p>
      </section>

      {players.some((p) => p.counters) ? (
        <section className="stack">
          <h2 className="display">More stats</h2>
          <div className="table-box">
            <table>
              <thead>
                <tr>
                  <th>Player</th>
                  {COUNTER_STATS.map((s) => (
                    <th key={s.key} title={s.approx ?? s.label}>{s.approx ? "≈ " : ""}{s.label}{s.rough ? "*" : ""}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {players.map((p) => (
                  <tr key={p.player}>
                    <td><a href={`/players/${encodeURIComponent(p.player)}`}>{p.player}</a></td>
                    {COUNTER_STATS.map((s) => (
                      <td key={s.key}>{p.counters ? counterStat(p.counters, s) : "–"}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="muted" style={{ fontSize: 13, margin: 0 }}>
            Each player&apos;s own, from EA&apos;s hidden event counters, decoded by the{" "}
            <a href="https://github.com/Interactive-63/eafc-pro-clubs-api-research">EA FC Pro Clubs API research</a> project.
            * Not confirmed yet: didn't match the in-game screen exactly.
          </p>
        </section>
      ) : null}

      <section className="card stack" id="fix">
        <h2 className="display" style={{ fontSize: 22 }}>Fix stats</h2>
        <p className="text-2" style={{ margin: 0 }}>
          Copy the real numbers from the in-game <strong>Player Performance</strong> screen. Tick “Correct” for each player you enter;
          unticked players keep EA&apos;s numbers. Season totals and records update with your numbers.
        </p>
        <FixStatsForm
          matchId={m.id}
          rows={players.map((p) => ({
            player: p.player,
            fixed: Boolean(p.fixed),
            position: p.position ?? null,
            rating: p.rating ?? 0, // blank in the form when unknown (+CPU)
            goals: p.goals,
            assists: p.assists,
            shots: p.shots,
            passes: p.passes_made,
            tackles: p.tackles_made,
            motm: p.motm,
          }))}
        />
      </section>

      <section className="card stack">
        <h2 className="display" style={{ fontSize: 22 }}>Captain</h2>
        <p className="text-2" style={{ margin: 0 }}>EA doesn&apos;t record who captained, so set it here after the game.</p>
        <CaptainForm matchId={m.id} players={players.map((p) => p.player)} current={m.captain} />
      </section>
    </main>
  );
}
