"use client";

import { useState } from "react";

export type BoardRow = {
  gamertag: string;
  proName: string;
  position: string;
  role: string;
  flag: string;
  overall: number;
  games: number;
  goals: number;
  assists: number;
  ga: number;
  rating: number;
  motm: number;
  passPct: number;
  tackles: number;
  /** from the saved matches, not EA's season totals */
  cleanSheets: number;
  controlsCpu: boolean;
  /** games before the site saved matches whose EA totals may include the CPU's */
  cpuEarlyGames: number;
  /** per game over the saved games with event counters (savedGames of them) */
  savedGames: number;
  interceptions: number;
  dribbles: number;
  keyPasses: number;
  secondAssists: number;
};

const METRICS = [
  { id: "goals", label: "Goals", perGame: true, cpuSkewed: true },
  { id: "assists", label: "Assists", perGame: true, cpuSkewed: true },
  { id: "ga", label: "G + A", perGame: true, cpuSkewed: true },
  { id: "rating", label: "Avg rating", fmt: (v: number) => v.toFixed(1), cpuSkewed: true },
  { id: "motm", label: "MOTM" },
  { id: "passPct", label: "Pass %", fmt: (v: number) => `${v}%`, cpuSkewed: true },
  { id: "tackles", label: "Tackles", perGame: true, cpuSkewed: true },
  { id: "cleanSheets", label: "Clean sheets", note: "in saved games" },
  { id: "interceptions", label: "Interceptions", saved: true },
  { id: "dribbles", label: "Dribbles", saved: true },
  { id: "keyPasses", label: "≈ Key passes", saved: true, approx: "Close to the in-game Key Passes but not exact: 5 of 9 checked lines match, off by one to three on the others (mostly low)" },
  { id: "secondAssists", label: "Second assists", saved: true },
] as const;

type MetricId = (typeof METRICS)[number]["id"];

/**
 * The season leaderboard as two page bands: the title and metric toggles on the club's colour,
 * then the ranking on a light band, one row per player (rank, player, bar, value).
 */
export function Leaderboard({ rows, title, note }: { rows: BoardRow[]; title: React.ReactNode; note?: React.ReactNode }) {
  const [metric, setMetric] = useState<MetricId>("goals");
  const m = METRICS.find((x) => x.id === metric)!;
  const sorted = [...rows].sort((a, b) => b[metric] - a[metric]);
  const max = Math.max(...sorted.map((r) => r[metric]), 1);
  return (
    <>
      <section className="band band-club board-head">
        <div className="wrap" style={{ gap: 28 }}>
          {title}
          <div className="tabs" role="group" aria-label="Rank players by">
            {METRICS.map((x) => (
              <button key={x.id} type="button" title={"approx" in x ? x.approx : undefined} aria-pressed={x.id === metric} onClick={() => setMetric(x.id)}>
                {x.label}
              </button>
            ))}
          </div>
        </div>
      </section>
      <section className="band section-light">
        <div className="wrap" style={{ gap: 24 }}>
          <ol className="board">
            {sorted.map((r, i) => {
              const v = r[metric];
              const skewed = "cpuSkewed" in m && m.cpuSkewed && r.cpuEarlyGames > 0;
              return (
                <li key={r.gamertag}>
                  <a className={`board-row${i === 0 ? " is-lead" : ""}`} href={`/players/${encodeURIComponent(r.gamertag)}`}>
                    <span className="board-rank display num">{i + 1}</span>
                    <span className="board-who">
                      <span className="board-name">
                        <img className="flag" src={r.flag} alt="" />
                        <strong>{r.gamertag}</strong>
                      </span>
                      <span className="board-meta">
                        {r.proName} · {r.position}{r.role ? ` · ${r.role}` : ""} · {r.games} games · OVR {r.overall}
                      </span>
                      {skewed ? <span className="cpu-warn">May include the CPU&apos;s from {r.cpuEarlyGames} earlier games</span> : null}
                    </span>
                    <span className="bar board-bar" aria-hidden="true">
                      <span style={{ display: "block", width: `${Math.round((v / max) * 100)}%`, opacity: skewed ? 0.45 : 1 }} />
                    </span>
                    <span className="board-value">
                      <span className="num">{"saved" in m ? v.toFixed(1) : "fmt" in m ? m.fmt(v) : v}</span>
                      <small>
                        {"saved" in m
                          ? `per game · ${r.savedGames} saved`
                          : "perGame" in m && m.perGame && r.games
                            ? `${(v / r.games).toFixed(2)} per game`
                            : "note" in m
                              ? m.note
                              : m.label}
                      </small>
                    </span>
                  </a>
                </li>
              );
            })}
          </ol>
          {note}
        </div>
      </section>
    </>
  );
}
