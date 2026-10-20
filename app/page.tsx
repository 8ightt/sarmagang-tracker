import { Crest, Flag, KitShirt, PosLabel, ResultBadge, ago, when } from "@/components/bits";
import { currentSeason, loadSettings, playoffsWindow, promotionRule, seasonEnd } from "@/lib/config";
import { crestUrl, divisionCrestUrl, reputationName, reputationUrl } from "@/lib/ea-assets";
import { DivisionLadder, ReputationLadder, TopHundred } from "@/components/Ladders";
import { divisionName, getClub, getMatches, getMembers, getRecords, getSeason, getSeasonPlayoffs, getTactics, getTop100, lastPoll } from "@/lib/stats";
import { SeasonForm } from "@/components/Forms";
import { Tactics } from "@/components/Tactics";
import { getPlayerTakes } from "@/lib/takes";

export const dynamic = "force-dynamic";

export default async function Home() {
  const [club, members, recent, records, poll, tactics, season, playoffs, top100, takes] = await Promise.all([
    getClub(),
    getMembers(),
    getMatches(5),
    getRecords(),
    lastPoll(),
    getTactics(),
    getSeason(),
    getSeasonPlayoffs(),
    getTop100(),
    getPlayerTakes(),
  ]);
  // the season tracker follows the in-game lobby; EA's own division field lags behind
  const division = season?.division ?? club.division;
  const promo = season?.phase === "playoffs" ? season.promotion : null;
  // EA's bestDivision runs a division behind (as currentDivision does), so the tracker's division counts too
  const bestDivision = [club.bestDivision, division].filter((d): d is number => d !== null).reduce((a, b) => Math.min(a, b), Infinity);
  const settings = loadSettings();
  const clubSeason = currentSeason();
  const nowSec = Date.now() / 1000;
  const playoffsWin = clubSeason ? playoffsWindow(clubSeason) : null;
  const playoffsAt = playoffsWin?.from ?? null;
  const seasonEndTs = clubSeason ? seasonEnd(clubSeason) : null;
  const dayLabel = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
  const countdown = (secs: number) => {
    const d = Math.floor(secs / 86400);
    const h = Math.floor((secs % 86400) / 3600);
    return d ? `${d} day${d === 1 ? "" : "s"}, ${h} hour${h === 1 ? "" : "s"}` : `${h} hour${h === 1 ? "" : "s"}`;
  };
  const seasonLine = !clubSeason
    ? null
    : seasonEndTs !== null && nowSec > seasonEndTs
      ? `${clubSeason.name} (${dayLabel(clubSeason.start)} – ${dayLabel(clubSeason.end)}) has ended`
      : `${clubSeason.name} · ${dayLabel(clubSeason.start)} – ${dayLabel(clubSeason.end)}` +
        (playoffsAt === null
          ? ""
          : nowSec < playoffsAt
            ? ` · Season Playoffs start in about ${countdown(playoffsAt - nowSec)}, in the highest division reached`
            : ` · Season Playoffs are on, ending in ${countdown(Math.max(0, seasonEndTs! - nowSec))}: league points and chances are paused`);
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
    { label: "League points", value: club.points ?? "–", sub: "EA total" },
    { label: "Clean sheets", value: club.cleanSheets, sub: `In ${club.played} games` },
    { label: "Skill rating", value: club.skillRating ?? "–", sub: "EA club rating" },
  ];

  return (
    <main className="bands">
      <section className="band band-club club-hero">
        <div className="wrap" style={{ gap: 0 }}>
          <div className="hero-main">
            <img className="hero-crest" src={crestUrl(club.crestAssetId)} alt={`${club.name} crest`} width={180} height={180} />
            <div style={{ minWidth: 0 }}>
              <h1 className="display">{club.name}</h1>
              {settings.tagline ? <p className="tagline" style={{ margin: "14px 0 0" }}>{settings.tagline}</p> : null}
              <p className="meta" style={{ margin: "6px 0 0" }}>
                {club.stadium ? `Home ground: ${club.stadium} · ` : ""}Updated {ago(poll?.at)}
              </p>
            </div>
            <div className="hero-side">
              <div className="hero-standing">
                {division !== null ? (
                  <div>
                    <img src={divisionCrestUrl(division)} alt="" width={56} height={56} style={{ objectFit: "contain" }} />
                    <span><small>League</small><strong>{divisionName(division)}</strong></span>
                  </div>
                ) : null}
                <div>
                  <img src={reputationUrl(club.reputationTier)} alt="" width={52} height={52} />
                  <span><small>Reputation</small><strong>{reputationName(club.reputationTier)}</strong></span>
                </div>
              </div>
              {club.form.length ? (
                <div className="hero-form">
                  <span>Last {club.form.length}, newest right</span>
                  {club.form.map((r, i) => <ResultBadge key={i} r={r} />)}
                </div>
              ) : null}
            </div>
          </div>
          <div className="hero-stats">
            {kpis.map((k) => (
              <div key={k.label}>
                <div className="kpi-label">{k.label}</div>
                <div className="kpi-value">{k.value}</div>
                <div className="kpi-sub">{k.sub}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="band">
        <div className="wrap">
          {playoffs ? (
            <section className="card stack" style={{ gap: 18 }}>
              <div className="section-head">
                <h2 className="display">{playoffs.name} Playoffs</h2>
                <span className="muted" style={{ fontSize: 13 }}>
                  {division !== null ? `${divisionName(division)} · ` : ""}until {new Date(playoffs.to * 1000).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" })}
                  {playoffs.to > nowSec ? ` · ${countdown(playoffs.to - nowSec)} left` : ""}
                </span>
              </div>
              <div className="grid grid-170">
                <div>
                  <div className="kpi-label">Played</div>
                  <div className="display kpi-value num">
                    {playoffs.games.length}
                    {playoffs.planned ? <span className="muted" style={{ fontSize: 24 }}>/{playoffs.planned}</span> : null}
                  </div>
                  <div className="kpi-sub">{playoffs.w}-{playoffs.d}-{playoffs.l} W-D-L{playoffs.planned && playoffs.games.length >= playoffs.planned ? " · all played" : ""}</div>
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

          {/* during the Season Playoffs the Playoffs card above takes over: league points are paused */}
          {season && !playoffs ? (
            <section className="card stack" style={{ gap: 18, border: promo ? "1px solid var(--accent)" : undefined }}>
              <div className="section-head">
                <h2 className="display">
                  {promo ? `Promotion match · ${divisionName(season.division)} → ${divisionName(Math.max(0, season.division - 1))}` : `${divisionName(season.division)} season`}
                </h2>
                <span className="muted" style={{ fontSize: 13 }}>
                  {promo ? `Win ${promo.winsNeeded} of ${promo.matches} to go up` : "Win +3 · Draw +1 · Loss −1 chance"}
                </span>
              </div>
              {seasonLine ? <span className="text-2" style={{ fontSize: 14, marginTop: -8 }}>{seasonLine}</span> : null}
              {season.phase === "relegation" ? (
                <div className="card-strong" style={{ border: "1px solid var(--shame)" }}>
                  <strong className="display" style={{ fontSize: 22, color: "var(--shame)" }}>
                    Relegation match
                  </strong>
                  <div className="text-2" style={{ marginTop: 6 }}>
                    {`Out of chances. Win the next game to stay in ${divisionName(season.division)}; lose it and you go down.`}
                  </div>
                </div>
              ) : null}
              {promo ? (
                <div className="stack" style={{ gap: 16 }}>
                  <div className="row between" style={{ alignItems: "flex-end" }}>
                    <div className="stack" style={{ gap: 4 }}>
                      <span className="text-2">Wins</span>
                      <span className="display num" style={{ fontSize: 40, lineHeight: 1 }}>
                        {promo.wins}<span className="muted" style={{ fontSize: 24 }}>/{promo.winsNeeded}</span>
                      </span>
                    </div>
                    <div className="stack" style={{ gap: 4, textAlign: "right" }}>
                      <span className="text-2">Games left</span>
                      <span className="display num" style={{ fontSize: 40, lineHeight: 1 }}>{promo.matches - promo.played}</span>
                    </div>
                  </div>
                  <div className="series" style={{ ["--n" as string]: promo.matches }}>
                    {Array.from({ length: promo.matches }, (_, i) => {
                      const g = promo.games[i];
                      return g ? (
                        <a key={i} href={`/matches/${g.id}`} className={`series-slot is-${g.result}`}>
                          <span className="series-n">Game {i + 1}</span>
                          <ResultBadge r={g.result} />
                          <span className="num" style={{ fontWeight: 700 }}>{g.score}</span>
                          <span className="series-opp">{g.opp}</span>
                        </a>
                      ) : (
                        <div key={i} className={`series-slot${i === promo.played ? " is-next" : ""}`}>
                          <span className="series-n">Game {i + 1}</span>
                          <span className="series-empty">{i === promo.played ? "Next" : "–"}</span>
                        </div>
                      );
                    })}
                  </div>
                  <span className="text-2" style={{ fontSize: 14 }}>
                    {`${promo.winsNeeded - promo.wins} more win${promo.winsNeeded - promo.wins === 1 ? "" : "s"} from ${promo.matches - promo.played} game${promo.matches - promo.played === 1 ? "" : "s"} to go up to ${divisionName(Math.max(0, season.division - 1))}. Fall short and the club stays in ${divisionName(season.division)}.`}
                    {promo.confirmed ? "" : " (Series length not confirmed yet: check the lobby.)"}
                  </span>
                  <details>
                    <summary style={{ fontSize: 13 }}>Promotion match in every division</summary>
                    <table className="series-rules">
                      <tbody>
                        {[5, 4, 3, 2, 1].map((d) => {
                          const r = promotionRule(d);
                          return (
                            <tr key={d} aria-current={d === season.division ? "true" : undefined}>
                              <td>{divisionName(d)} → {divisionName(d - 1)}</td>
                              <td className="num">Win {r.wins} of {r.matches}</td>
                              <td className="muted">{r.confirmed ? "confirmed in the lobby" : "not confirmed yet"}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </details>
                </div>
              ) : (
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
                        : "Target reached"}
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
              )}
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
                        playoffs: "Reached the promotion match",
                        promoted: `Promoted to ${divisionName(e.division)}`,
                        "playoff-lost": "Missed promotion",
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

          <section className="grid grid-270">
            <DivisionLadder current={division} best={Number.isFinite(bestDivision) ? bestDivision : null} promotions={club.promotions} relegations={club.relegations} />
            <ReputationLadder tier={club.reputationTier} />
            {top100 ? <TopHundred clubs={top100.clubs} us={club.skillRating} /> : null}
          </section>
        </div>
      </section>

      <section className="band section-light">
        <div className="wrap">
          <section className="stack">
            <h2 className="display">Meet the gang</h2>
            <div className="grid" style={{ gridTemplateColumns: "repeat(3, minmax(0, 1fr))" }}>
              {playing.map((m) => (
                <a key={m.gamertag} className="card player-card" href={`/players/${encodeURIComponent(m.gamertag)}`}>
                  <div className="player-card-head">
                    {m.photo ? (
                      <img className="avatar" src={m.photo} alt="" width={56} height={56} />
                    ) : (
                      <div className="avatar" aria-hidden="true">
                        {m.gamertag.replace(/[^a-z0-9]/gi, "").slice(0, 2).toUpperCase()}
                      </div>
                    )}
                    <div className="player-card-who">
                      <strong title={m.gamertag}>{m.gamertag}</strong>
                      <span className="player-card-meta">
                        <Flag nation={m.nation} size={20} /> {m.proName} · <PosLabel position={m.position} role={m.role} />
                      </span>
                    </div>
                    <div className="player-card-ovr">
                      <span className="display num">{m.overall || "–"}</span>
                      <small>OVR</small>
                    </div>
                  </div>
                  {m.nickname ? <div className="display player-card-nick">“{m.nickname}”</div> : null}
                  <dl className="player-card-stats">
                    <div><dt>Games</dt><dd>{m.games}</dd></div>
                    <div><dt>Goals</dt><dd>{m.goals}</dd></div>
                    <div><dt>Assists</dt><dd>{m.assists}</dd></div>
                    <div><dt>MOTM</dt><dd>{m.motm}</dd></div>
                  </dl>
                  {/* the club's bio (config/settings.json), else a factual line from the latest games */}
                  {(m.bio ?? takes.get(m.gamertag)) ? <p className="player-card-bio">{m.bio ?? takes.get(m.gamertag)}</p> : null}
                </a>
              ))}
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
        </div>
      </section>

      <section className="band">
        <div className="wrap">
          <section className="row" style={{ alignItems: "stretch", gap: 24 }}>
            <div className="stack" style={{ flex: "2 1 560px" }}>
              <h2 className="display">Season awards</h2>
              <div className="grid" style={{ gridTemplateColumns: "repeat(2, minmax(0, 1fr))" }}>
                {[
                  { cat: "Golden boot", m: top("goals"), v: top("goals")?.goals },
                  { cat: "Chief playmaker", m: top("assists"), v: top("assists")?.assists },
                  { cat: "Big game player", m: top("motm"), v: top("motm")?.motm, sfx: " MOTM" },
                  { cat: "Most lethal", m: lethal, v: lethal ? ((lethal.goals + lethal.assists) / lethal.games).toFixed(2) : undefined, sfx: " G+A/game" },
                ].map((a) =>
                  a.m ? (
                    <a key={a.cat} className="card-strong stack" style={{ gap: 12 }} href={`/players/${encodeURIComponent(a.m.gamertag)}`}>
                      <span className="award-label">{a.cat}</span>
                      <div className="row between">
                        <span style={{ fontWeight: 700, fontSize: 19 }}>{a.m.gamertag}</span>
                        <span className="display accent num" style={{ fontSize: 44, fontWeight: 900 }}>{a.v}</span>
                      </div>
                    </a>
                  ) : null,
                )}
              </div>
              <div className="section-head" style={{ marginTop: 32 }}>
                <h2 className="display">Recent matches</h2>
                <a href="/seasons" style={{ fontWeight: 600 }}>All saved matches →</a>
              </div>
              <div className="stack" style={{ gap: 8 }}>
                {recent.map((m) => (
                  <a key={m.id} className="match-row" href={`/matches/${m.id}`}>
                    <ResultBadge r={m.result} />
                    <span className="muted" style={{ fontSize: 13, width: 130 }}>{when(m.ts)}</span>
                    <div className="row" style={{ gap: 12, flex: "1 1 280px", flexWrap: "nowrap" }}>
                      <Crest id={club.crestAssetId} size={30} />
                      <span className="score num">{m.goals_for}–{m.goals_against}</span>
                      <Crest id={m.opp_crest} size={30} />
                      <span style={{ fontWeight: 700 }}>{m.opp_name}</span>
                    </div>
                    {m.dnf ? <span className="chip chip-ghost">They quit</span> : null}
                    {m.we_quit ? <span className="chip chip-ghost">We quit</span> : null}
                  </a>
                ))}
                {!recent.length ? <p className="muted">No matches saved yet — the first check runs a few seconds after start-up.</p> : null}
              </div>
            </div>
            <div className="stack" style={{ flex: "1 1 320px" }}>
              <h2 className="display">Latest records</h2>
              <div className="card" style={{ padding: "4px 22px" }}>
                {[...records.matchRecords.slice(0, 3), ...records.shame.slice(0, 2)].map((r, i, all) => (
                  <div key={r.label} className="row between" style={{ padding: "14px 0", borderBottom: i < all.length - 1 ? "1px solid var(--line)" : undefined, flexWrap: "nowrap" }}>
                    <div>
                      <div style={{ fontWeight: 600 }}>{r.label}</div>
                      <div className="muted" style={{ fontSize: 13 }}>{r.who}</div>
                    </div>
                    <span className="num" style={{ fontSize: 28, fontWeight: 800, color: i < 3 ? "var(--accent)" : "var(--shame)" }}>{r.value}</span>
                  </div>
                ))}
                {!records.matchRecords.length ? <p className="muted">Records appear once the first matches are saved.</p> : null}
              </div>
              <a href="/records" style={{ fontWeight: 600 }}>Hall of fame &amp; hall of shame →</a>
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
        </div>
      </section>
    </main>
  );
}
