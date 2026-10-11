import { Crest, Flag, KitShirt, PosLabel, ResultBadge, ago, when } from "@/components/bits";
import { currentSeason, loadSettings, playoffsWindow } from "@/lib/config";
import { reputationUrl } from "@/lib/ea-assets";
import { divisionName, getClub, getMatches, getMembers, getRecords, getSeason, getSeasonPlayoffs, getTactics, lastPoll } from "@/lib/stats";
import { SeasonForm } from "@/components/Forms";
import { Tactics } from "@/components/Tactics";

export const dynamic = "force-dynamic";

export default async function Home() {
  const [club, members, recent, records, poll, tactics, season, playoffs] = await Promise.all([
    getClub(),
    getMembers(),
    getMatches(5),
    getRecords(),
    lastPoll(),
    getTactics(),
    getSeason(),
    getSeasonPlayoffs(),
  ]);
  // the season tracker follows the in-game lobby; EA's own division field lags behind
  const division = season?.division ?? club.division;
  const settings = loadSettings();
  const clubSeason = currentSeason();
  const nowSec = Date.now() / 1000;
  const playoffsWin = clubSeason ? playoffsWindow(clubSeason) : null;
  const playoffsAt = playoffsWin?.from ?? null;
  const seasonEnd = clubSeason ? (playoffsWin?.to ?? Date.parse(`${clubSeason.end}T23:59:59Z`) / 1000) : null;
  const dayLabel = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
  const countdown = (secs: number) => {
    const d = Math.floor(secs / 86400);
    const h = Math.floor((secs % 86400) / 3600);
    return d ? `${d} day${d === 1 ? "" : "s"}, ${h} hour${h === 1 ? "" : "s"}` : `${h} hour${h === 1 ? "" : "s"}`;
  };
  const seasonLine = !clubSeason
    ? null
    : seasonEnd !== null && nowSec > seasonEnd
      ? `${clubSeason.name} (${dayLabel(clubSeason.start)} – ${dayLabel(clubSeason.end)}) has ended`
      : `${clubSeason.name} · ${dayLabel(clubSeason.start)} – ${dayLabel(clubSeason.end)}` +
        (playoffsAt === null
          ? ""
          : nowSec < playoffsAt
            ? ` · Season Playoffs start in about ${countdown(playoffsAt - nowSec)}, in the highest division reached`
            : " · Season Playoffs are on: league points and chances are paused");
  const playing = members.filter((m) => m.games > 0);
  const top = (key: "goals" | "assists" | "motm") => [...playing].sort((a, b) => b[key] - a[key])[0];
  const lethal = [...playing].filter((m) => m.games >= 10).sort((a, b) => (b.goals + b.assists) / b.games - (a.goals + a.assists) / a.games)[0];
  const winPct = club.played ? Math.round((club.wins / club.played) * 100) : 0;
  const perGame = (n: number) => (club.played ? (n / club.played).toFixed(1) : "0");

  const kpis = [
    { label: "Played", value: club.played, sub: "League matches" },
    { label: "Record", value: `${club.wins}–${club.draws}–${club.losses}`, sub: `W–D–L · ${winPct}% win rate` },
    { label: "Goals for", value: club.goalsFor, sub: `${perGame(club.goalsFor)} per game` },
    { label: "Goals against", value: club.goalsAgainst, sub: `${perGame(club.goalsAgainst)} per game` },
    { label: "Division", value: division ?? "–", sub: `Best ${club.bestDivision ?? "–"} · ${club.promotions} promotion${club.promotions === 1 ? "" : "s"}, ${club.relegations} relegation${club.relegations === 1 ? "" : "s"}` },
    { label: "League points", value: club.points ?? "–", sub: "EA total" },
    { label: "Clean sheets", value: club.cleanSheets, sub: `In ${club.played} games` },
    { label: "Skill rating", value: club.skillRating ?? "–", sub: "EA club rating" },
  ];

  return (
    <main className="wrap">
      <section className="row between" style={{ gap: 32 }}>
        <div className="row" style={{ gap: 28 }}>
          <Crest id={club.crestAssetId} size={150} alt={`${club.name} crest`} />
          <div className="stack" style={{ gap: 10 }}>
            <span className="eyebrow">EA FC 27 · Clubs · Division {division ?? "–"}</span>
            <h1 className="display">{club.name}</h1>
            {settings.tagline ? <span style={{ fontSize: 19, fontWeight: 500 }}>{settings.tagline}</span> : null}
            <span className="text-2">
              {club.stadium ? `Home ground: ${club.stadium} · ` : ""}Updated {ago(poll?.at)}
            </span>
          </div>
        </div>
        <div className="stack" style={{ alignItems: "flex-end" }}>
          <div className="row" style={{ gap: 12 }}>
            <img src={reputationUrl(club.reputationTier)} alt={`Reputation tier ${club.reputationTier}`} width={52} height={52} />
            <div>
              <div className="muted" style={{ fontSize: 13 }}>Reputation</div>
              <div style={{ fontWeight: 700 }}>Tier {club.reputationTier}</div>
            </div>
          </div>
          <div className="row" style={{ gap: 8 }}>
            <span className="text-2" style={{ fontSize: 13 }}>Last {club.form.length} · newest right</span>
            {club.form.map((r, i) => <ResultBadge key={i} r={r} />)}
          </div>
        </div>
      </section>

      {playoffs ? (
        <section className="card stack" style={{ gap: 18, border: "1px solid var(--accent)" }}>
          <div className="section-head">
            <h2 className="display">{playoffs.name} Playoffs</h2>
            <span className="muted" style={{ fontSize: 13 }}>
              {division !== null ? `${divisionName(division)} · ` : ""}until {new Date(playoffs.to * 1000).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" })}
            </span>
          </div>
          <div className="grid grid-170">
            <div>
              <div className="kpi-label">Played</div>
              <div className="display kpi-value num">
                {playoffs.games.length}
                {playoffs.planned ? <span className="muted" style={{ fontSize: 24 }}>/{playoffs.planned}</span> : null}
              </div>
              <div className="kpi-sub">{playoffs.w}-{playoffs.d}-{playoffs.l} W-D-L</div>
            </div>
            <div>
              <div className="kpi-label">Points</div>
              <div className="display kpi-value num">{playoffs.points}</div>
              <div className="kpi-sub">Win 3 · Draw 1</div>
            </div>
            <div>
              <div className="kpi-label">Goals</div>
              <div className="display kpi-value num">{playoffs.gf}–{playoffs.ga}</div>
              <div className="kpi-sub">for–against</div>
            </div>
            <div>
              <div className="kpi-label">Skill Rating</div>
              <div className="display kpi-value num">{playoffs.srNow ?? "–"}</div>
              <div className="kpi-sub">
                {playoffs.srStart !== null && playoffs.srNow !== null
                  ? `${playoffs.srNow - playoffs.srStart >= 0 ? "+" : ""}${playoffs.srNow - playoffs.srStart} since the Playoffs started`
                  : "EA club rating"}
              </div>
            </div>
          </div>
          {playoffs.games.length ? (
            <div className="row" style={{ gap: 8 }}>
              <span className="text-2" style={{ fontSize: 13 }}>Playoff games</span>
              {playoffs.games.map((g) => (
                <a key={g.id} href={`/matches/${g.id}`} title={`${g.score} vs ${g.opp}`} style={{ textDecoration: "none" }}>
                  <ResultBadge r={g.result} />
                </a>
              ))}
            </div>
          ) : null}
          <span className="muted" style={{ fontSize: 13 }}>
            Played in the highest division reached this season. The final placing (top 1%, 5%, 10%, 25%, 50%) decides the
            rewards and where the club starts next season.
          </span>
        </section>
      ) : null}

      {season ? (
        <section className="card stack" style={{ gap: 18 }}>
          <div className="section-head">
            <h2 className="display">{divisionName(season.division)} season</h2>
            <span className="muted" style={{ fontSize: 13 }}>Win +3 · Draw +1 · Loss −1 chance</span>
          </div>
          {seasonLine ? <span className="text-2" style={{ fontSize: 14, marginTop: -8 }}>{seasonLine}</span> : null}
          {season.phase !== "league" ? (
            <div className="card-strong" style={{ border: `1px solid ${season.phase === "playoffs" ? "var(--accent)" : "var(--shame)"}` }}>
              <strong className="display" style={{ fontSize: 22, color: season.phase === "playoffs" ? "var(--accent)" : "var(--shame)" }}>
                {season.phase === "playoffs" ? "Promotion playoff" : "Relegation match"}
              </strong>
              <div className="text-2" style={{ marginTop: 6 }}>
                {season.phase === "playoffs"
                  ? `Points target reached. Win the playoff to go up to ${divisionName(Math.max(0, season.division - 1))}.`
                  : `Out of chances. Win the next game to stay in ${divisionName(season.division)}; lose it and you go down.`}
              </div>
            </div>
          ) : null}
          <div className="row" style={{ gap: 32, alignItems: "flex-end" }}>
            <div className="stack" style={{ gap: 8, flex: "2 1 320px" }}>
              <div className="row between">
                <span className="text-2">Points to promotion</span>
                <span className="display num" style={{ fontSize: 40 }}>
                  {season.points}<span className="muted" style={{ fontSize: 24 }}>/{season.target}</span>
                </span>
              </div>
              <div className="bar" style={{ height: 14 }} role="img" aria-label={`${season.points} of ${season.target} points`}>
                <div style={{ width: `${Math.min(100, Math.round((season.points / season.target) * 100))}%` }} />
              </div>
              <span className="muted" style={{ fontSize: 13 }}>
                {season.target - season.points > 0
                  ? `${season.target - season.points} more point${season.target - season.points === 1 ? "" : "s"} to go up: ${Math.ceil((season.target - season.points) / 3)} win${Math.ceil((season.target - season.points) / 3) === 1 ? "" : "s"}`
                  : "Promotion reached"}
              </span>
            </div>
            <div className="stack" style={{ gap: 8, flex: "1 1 200px" }}>
              <span className="text-2">Chances left</span>
              <div className="row" style={{ gap: 10 }} role="img" aria-label={`${season.chances} of ${season.maxChances} chances left`}>
                {Array.from({ length: season.maxChances }, (_, i) => (
                  <span
                    key={i}
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: "50%",
                      background: i < season.chances ? "var(--accent)" : "transparent",
                      border: `2px solid ${i < season.chances ? "var(--accent)" : "var(--line-2)"}`,
                    }}
                  />
                ))}
              </div>
              <span className="muted" style={{ fontSize: 13 }}>
                {season.chances === 0
                  ? "None left: relegation match next"
                  : season.chances === 1
                    ? "Last chance: one more loss means a relegation match"
                    : `${season.chances} losses left before a relegation match`}
              </span>
            </div>
          </div>
          {season.results.length ? (
            <div className="row" style={{ gap: 8 }}>
              <span className="text-2" style={{ fontSize: 13 }}>This season</span>
              {season.results.map((r) => (
                <a key={r.id} href={`/matches/${r.id}`} title={`${r.score} vs ${r.opp}`} style={{ textDecoration: "none" }}>
                  <ResultBadge r={r.result} />
                </a>
              ))}
            </div>
          ) : null}
          {season.events.length ? (
            <span className="text-2" style={{ fontSize: 14 }}>
              {season.events
                .map((e) => {
                  const label = {
                    playoffs: "Reached the promotion playoff",
                    promoted: `Promoted to ${divisionName(e.division)}`,
                    "playoff-lost": "Lost the promotion playoff",
                    "relegation-match": "Out of chances: relegation match",
                    survived: "Won the relegation match",
                    relegated: `Relegated to ${divisionName(e.division)}`,
                  }[e.kind];
                  return `${label} (${when(e.ts)})`;
                })
                .join(" · ")}
            </span>
          ) : null}
          <details>
            <summary style={{ fontSize: 13 }}>Doesn&apos;t match the lobby? Set it from the game</summary>
            <div style={{ marginTop: 12 }}>
              <SeasonForm division={season.division} points={season.points} target={season.target} chances={season.chances} />
            </div>
          </details>
        </section>
      ) : null}

      <section className="grid grid-170">
        {kpis.map((k) => (
          <div key={k.label} className="card">
            <div className="kpi-label">{k.label}</div>
            <div className="display kpi-value num">{k.value}</div>
            <div className="kpi-sub">{k.sub}</div>
          </div>
        ))}
      </section>

      <section className="stack">
        <h2 className="display">Meet the gang</h2>
        <div className="grid grid-240">
          {playing.map((m) => (
            <a key={m.gamertag} className="card stack" style={{ gap: 14 }} href={`/players/${encodeURIComponent(m.gamertag)}`}>
              <div className="row" style={{ gap: 14, flexWrap: "nowrap" }}>
                {m.photo ? (
                  <img src={m.photo} alt="" width={64} height={64} style={{ borderRadius: "50%", objectFit: "cover" }} />
                ) : (
                  <div style={{ width: 64, height: 64, flex: "0 0 64px", borderRadius: "50%", background: "var(--surface-2)", border: "2px dashed var(--accent)", display: "flex", alignItems: "center", justifyContent: "center" }} className="display accent">
                    {m.gamertag.replace(/[^a-z0-9]/gi, "").slice(0, 2).toUpperCase()}
                  </div>
                )}
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 18 }}>{m.gamertag}</div>
                  <div className="row muted" style={{ gap: 8, fontSize: 13 }}>
                    <Flag nation={m.nation} /> {m.proName}
                  </div>
                </div>
                <div style={{ marginLeft: "auto", textAlign: "center" }}>
                  <div className="display num" style={{ fontSize: 28, fontWeight: 900 }}>{m.overall || "–"}</div>
                  <div style={{ fontSize: 12 }}><PosLabel position={m.position} role={m.role} /></div>
                </div>
              </div>
              {m.nickname ? <div className="display accent" style={{ fontSize: 22 }}>“{m.nickname}”</div> : null}
              <div className="text-2" style={{ fontSize: 14 }}>
                {m.goals} goals · {m.assists} assists · {m.motm} MOTM in {m.games} games
                {m.bio ? <><br />{m.bio}</> : null}
              </div>
            </a>
          ))}
        </div>
      </section>

      <section className="row" style={{ alignItems: "stretch", gap: 24 }}>
        <div className="stack" style={{ flex: "2 1 560px" }}>
          <h2 className="display">Season awards</h2>
          <div className="grid grid-240">
            {[
              { cat: "Golden boot", m: top("goals"), v: top("goals")?.goals },
              { cat: "Chief playmaker", m: top("assists"), v: top("assists")?.assists },
              { cat: "Big game player", m: top("motm"), v: top("motm")?.motm, sfx: " MOTM" },
              { cat: "Most lethal", m: lethal, v: lethal ? ((lethal.goals + lethal.assists) / lethal.games).toFixed(2) : undefined, sfx: " G+A/game" },
            ].map((a) =>
              a.m ? (
                <a key={a.cat} className="card-strong stack" style={{ gap: 12 }} href={`/players/${encodeURIComponent(a.m.gamertag)}`}>
                  <span className="eyebrow" style={{ letterSpacing: "0.12em" }}>{a.cat}</span>
                  <div className="row between">
                    <span style={{ fontWeight: 700, fontSize: 19 }}>{a.m.gamertag}</span>
                    <span className="display accent num" style={{ fontSize: 44, fontWeight: 900 }}>{a.v}</span>
                  </div>
                </a>
              ) : null,
            )}
          </div>
        </div>
        <div className="stack" style={{ flex: "1 1 320px" }}>
          <h2 className="display">Latest records</h2>
          <div className="card" style={{ padding: "4px 22px" }}>
            {[...records.matchRecords.slice(0, 3), ...records.shame.slice(0, 2)].map((r, i) => (
              <div key={r.label} className="row between" style={{ padding: "14px 0", borderBottom: "1px solid var(--line)", flexWrap: "nowrap" }}>
                <div>
                  <div style={{ fontWeight: 600 }}>{r.label}</div>
                  <div className="muted" style={{ fontSize: 13 }}>{r.who}</div>
                </div>
                <span className="display num" style={{ fontSize: 28, color: i < 3 ? "var(--accent)" : "var(--shame)" }}>{r.value}</span>
              </div>
            ))}
            {!records.matchRecords.length ? <p className="muted">Records appear once the first matches are saved.</p> : null}
          </div>
          <a href="/records" style={{ fontWeight: 600 }}>Hall of fame &amp; hall of shame →</a>
        </div>
      </section>

      <section className="stack">
        <div className="section-head">
          <h2 className="display">Squad this season</h2>
          <a href="/players" style={{ fontWeight: 600 }}>Full leaderboard →</a>
        </div>
        <div className="table-box">
          <table>
            <thead>
              <tr>
                <th>Player</th><th>Pos</th><th>GP</th><th>Win %</th><th>G</th><th>A</th><th>Rating</th><th>MOTM</th><th>Pass %</th><th>OVR</th>
              </tr>
            </thead>
            <tbody>
              {members.map((m) => (
                <tr key={m.gamertag}>
                  <td>
                    <div className="player-cell">
                      <Flag nation={m.nation} />
                      <a href={`/players/${encodeURIComponent(m.gamertag)}`}>{m.gamertag}</a>
                      <span className="muted">{m.proName}</span>
                    </div>
                  </td>
                  <td><PosLabel position={m.position} role={m.role} /></td>
                  <td>{m.games}</td><td>{m.winRate}%</td><td>{m.goals}</td><td>{m.assists}</td>
                  <td>{m.rating.toFixed(1)}</td><td>{m.motm}</td><td>{m.passPct}%</td>
                  <td style={{ fontWeight: 700 }}>{m.overall || "–"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="stack">
        <div className="section-head">
          <h2 className="display">Recent matches</h2>
          <a href="/seasons" style={{ fontWeight: 600 }}>All saved matches →</a>
        </div>
        <div className="stack" style={{ gap: 8 }}>
          {recent.map((m) => (
            <a key={m.id} className="match-row" href={`/matches/${m.id}`}>
              <ResultBadge r={m.result} />
              <span className="muted" style={{ fontSize: 13, width: 130 }}>{when(m.ts)}</span>
              <div className="row" style={{ gap: 12, flex: "1 1 320px", flexWrap: "nowrap" }}>
                <Crest id={club.crestAssetId} size={30} />
                <span className="score num">{m.goals_for}–{m.goals_against}</span>
                <Crest id={m.opp_crest} size={30} />
                <span style={{ fontWeight: 700 }}>{m.opp_name}</span>
              </div>
              {m.dnf ? <span className="chip chip-ghost">They quit</span> : null}
            </a>
          ))}
          {!recent.length ? <p className="muted">No matches saved yet — the first check runs a few seconds after start-up.</p> : null}
        </div>
      </section>

      <section className="stack">
        <div className="section-head">
          <h2 className="display">Tactics</h2>
          <span className="muted" style={{ fontSize: 13 }}>Import in-game with the share code</span>
        </div>
        <Tactics tactics={tactics} />
      </section>

      <section className="stack">
        <h2 className="display">The kits</h2>
        <div className="grid grid-240">
          {club.kits.map((k) => (
            <div key={k.name} className="card stack" style={{ alignItems: "center", gap: 12 }}>
              <KitShirt colors={k.colors} />
              <span className="display" style={{ fontSize: 22 }}>{k.name}</span>
            </div>
          ))}
        </div>
      </section>

      <footer className="site-footer">
        Stats, crests and flags from EA&apos;s Clubs data, checked every 2 minutes while you play. Fan site, not affiliated with EA.
      </footer>
    </main>
  );
}
