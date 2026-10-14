import { Crest, Flag } from "@/components/bits";
import { getClub, getMembers, getRecords, getTracked, savedMatchCount } from "@/lib/stats";
import { when } from "@/components/bits";

export const dynamic = "force-dynamic";
export const metadata = { title: "Records" };

export default async function RecordsPage() {
  const [club, allMembers, rec, saved, tracked] = await Promise.all([getClub(), getMembers(), getRecords(), savedMatchCount(), getTracked()]);
  const members = allMembers.filter((m) => m.games > 0);
  const by = <K extends keyof (typeof members)[number]>(key: K, min = 0, dir: 1 | -1 = 1) =>
    [...members].filter((m) => m.games >= min).sort((a, b) => (Number(b[key]) - Number(a[key])) * dir);
  const nation = new Map(members.map((m) => [m.gamertag, m.nation]));
  // EA's totals for games from before the site saved matches can't have the CPU's share taken out
  const cpuWarn = (cpu: boolean | undefined, m: { cpuEarlyGames: number }) =>
    cpu && m.cpuEarlyGames ? (
      <span className="cpu-warn" style={{ fontSize: 13 }}>⚠ May include the CPU&apos;s from {m.cpuEarlyGames} earlier game{m.cpuEarlyGames === 1 ? "" : "s"}</span>
    ) : null;

  const fame = [
    { cat: "Top scorer", cpu: true, list: by("goals"), v: (m: any) => m.goals },
    { cat: "Top assister", cpu: true, list: by("assists"), v: (m: any) => m.assists },
    { cat: "Most appearances", list: by("games"), v: (m: any) => m.games },
    { cat: "Most man of the match", list: by("motm"), v: (m: any) => m.motm },
    { cat: "Highest average rating", note: "5+ games", list: by("rating", 5), v: (m: any) => m.rating.toFixed(1) },
    {
      cat: "Goal involvements per game", cpu: true,
      note: "10+ games",
      list: [...members].filter((m) => m.games >= 10).sort((a, b) => (b.goals + b.assists) / b.games - (a.goals + a.assists) / a.games),
      v: (m: any) => ((m.goals + m.assists) / m.games).toFixed(2),
    },
    { cat: "Best passer", cpu: true, note: "pass completion, 5+ games", list: by("passPct", 5), v: (m: any) => `${m.passPct}%` },
    { cat: "Most clinical", cpu: true, note: "shot success, 5+ games", list: by("shotPct", 5), v: (m: any) => `${m.shotPct}%` },
    {
      cat: "Most clean sheets",
      note: "saved games",
      list: [...members].filter((m) => tracked.get(m.gamertag)?.cleanSheets).sort((a, b) => tracked.get(b.gamertag)!.cleanSheets - tracked.get(a.gamertag)!.cleanSheets),
      v: (m: any) => tracked.get(m.gamertag)?.cleanSheets ?? 0,
    },
  ];

  const shame = [
    {
      cat: "Most red cards",
      cpu: true,
      list: by("reds").filter((m) => m.reds > 0),
      v: (m: any) => m.reds,
      // whole season, CPU cards taken out; every player with a red, not just the top one
      note: ["Season, CPU cards removed", by("reds").filter((m) => m.reds > 0).map((m) => `${m.gamertag} ${m.reds}`).join(" · ")].join(" · "),
    },
    { cat: "Worst pass completion", cpu: true, list: by("passPct", 5, -1), v: (m: any) => `${m.passPct}%` },
    { cat: "Worst tackle success", cpu: true, list: by("tacklePct", 5, -1).filter((m) => m.tackles >= 5), v: (m: any) => `${m.tacklePct}%` },
    { cat: "Lowest average rating", list: by("rating", 5, -1), v: (m: any) => m.rating.toFixed(1) },
  ];

  return (
    <main className="wrap">
      <section className="stack" style={{ gap: 10 }}>
        <span className="eyebrow">Records</span>
        <h1 className="display">Legends &amp; lowlights</h1>
        <span className="text-2" style={{ maxWidth: 760 }}>
          Season totals come from EA. Single-game records cover the {saved.count} games this site has saved
          {saved.since ? ` since ${when(saved.since)}` : ""}.
        </span>
      </section>

      <section className="stack">
        <h2 className="display">Hall of fame</h2>
        <div className="grid grid-270">
          {fame.map((f) => {
            const top = f.list[0];
            if (!top) return null;
            const runners = f.list.slice(1, 3).map((m) => `${m.gamertag} ${f.v(m)}`).join(" · ");
            return (
              <div key={f.cat} className="card stack" style={{ gap: 12 }}>
                <span className="eyebrow" style={{ letterSpacing: "0.12em" }}>{f.cat}</span>
                <div className="row between" style={{ flexWrap: "nowrap" }}>
                  <span className="row" style={{ gap: 10 }}><Flag nation={top.nation} /> <strong style={{ fontSize: 18 }}>{top.gamertag}</strong></span>
                  <span className="display accent num" style={{ fontSize: 40, fontWeight: 900 }}>{f.v(top)}</span>
                </div>
                <span className="muted" style={{ fontSize: 13 }}>{[f.note, runners].filter(Boolean).join(" · ")}</span>
                {cpuWarn("cpu" in f ? f.cpu : undefined, top)}
              </div>
            );
          })}
        </div>
      </section>

      <section className="stack">
        <h2 className="display">Single-game records</h2>
        <div className="card" style={{ padding: "4px 22px" }}>
          {rec.matchRecords.map((r) => (
            <a key={r.label} href={r.matchId ? `/matches/${r.matchId}` : undefined} className="row" style={{ gap: 16, padding: "16px 0", borderBottom: "1px solid var(--line)", textDecoration: "none", color: "var(--text)" }}>
              <strong style={{ flex: "1 1 220px" }}>{r.label}</strong>
              <span className="text-2" style={{ flex: "2 1 320px" }}>{r.who !== "Club" ? <>{r.who} · </> : null}{r.detail}</span>
              {r.crest ? <Crest id={r.crest} size={28} /> : null}
              <span className="display accent num" style={{ fontSize: 26, minWidth: 64, textAlign: "right" }}>{r.value}</span>
            </a>
          ))}
          {!rec.matchRecords.length ? <p className="muted">Appears once matches are saved.</p> : null}
        </div>
      </section>

      <section className="stack">
        <h2 className="display">Club milestones</h2>
        <div className="grid grid-170">
          {[
            { label: "Best division", value: club.bestDivision ?? "–", sub: `Now in ${club.division ?? "–"}` },
            { label: "Promotions", value: club.promotions, sub: `${club.relegations} relegations` },
            { label: "Longest win streak", value: rec.streaks.win, sub: "In saved games" },
            { label: "Longest unbeaten run", value: rec.streaks.unbeaten, sub: "In saved games" },
            { label: "League points", value: club.points ?? "–", sub: "This season" },
          ].map((k) => (
            <div key={k.label} className="card-strong">
              <div className="kpi-label">{k.label}</div>
              <div className="display kpi-value num" style={{ fontSize: 40 }}>{k.value}</div>
              <div className="kpi-sub">{k.sub}</div>
            </div>
          ))}
        </div>
      </section>

      {rec.captains.length ? (
        <section className="stack">
          <h2 className="display">Captaincies</h2>
          <div className="grid grid-170">
            {rec.captains.map((c) => (
              <div key={c.player} className="card row between">
                <span className="row" style={{ gap: 8 }}><Flag nation={nation.get(c.player)} /><strong>{c.player}</strong></span>
                <span className="display accent num" style={{ fontSize: 30 }}>{c.n}</span>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <section className="stack">
        <div className="section-head">
          <h2 className="display">Hall of shame</h2>
          <span className="muted" style={{ fontSize: 13 }}>With love</span>
        </div>
        <div className="grid grid-270">
          {shame.map((s) => {
            const top = s.list[0];
            if (!top) return null;
            return (
              <div key={s.cat} className="card-shame stack" style={{ gap: 12 }}>
                <span style={{ fontSize: 13, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--shame)", fontWeight: 600 }}>{s.cat}</span>
                <div className="row between" style={{ flexWrap: "nowrap" }}>
                  <strong style={{ fontSize: 17 }}>{top.gamertag}</strong>
                  <span className="display num" style={{ fontSize: 36, color: "var(--shame)" }}>{s.v(top)}</span>
                </div>
                {s.note ? <span className="muted" style={{ fontSize: 13 }}>{s.note}</span> : null}
                {cpuWarn("cpu" in s ? s.cpu : undefined, top)}
              </div>
            );
          })}
          {rec.shame.map((r) => (
            <a key={r.label} href={r.matchId ? `/matches/${r.matchId}` : undefined} className="card-shame stack" style={{ gap: 12, textDecoration: "none", color: "var(--text)" }}>
              <span style={{ fontSize: 13, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--shame)", fontWeight: 600 }}>{r.label}</span>
              <div className="row between" style={{ flexWrap: "nowrap" }}>
                <strong style={{ fontSize: 17 }}>{r.who}</strong>
                <span className="display num" style={{ fontSize: 36, color: "var(--shame)" }}>{r.value}</span>
              </div>
              <span className="muted" style={{ fontSize: 13 }}>{r.detail}</span>
            </a>
          ))}
          <div className="card-shame stack" style={{ gap: 12 }}>
            <span style={{ fontSize: 13, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--shame)", fontWeight: 600 }}>Longest losing run</span>
            <div className="row between"><strong>Club</strong><span className="display num" style={{ fontSize: 36, color: "var(--shame)" }}>{rec.streaks.losing}</span></div>
            <span className="muted" style={{ fontSize: 13 }}>In saved games</span>
          </div>
        </div>
      </section>
    </main>
  );
}
