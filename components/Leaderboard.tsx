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
  /** per game over the saved games with event counters (savedGames of them) */
  savedGames: number;
  interceptions: number;
  dribbles: number;
  keyPasses: number;
  secondAssists: number;
};

const METRICS = [
  { id: "goals", label: "Goals", perGame: true },
  { id: "assists", label: "Assists", perGame: true },
  { id: "ga", label: "G + A", perGame: true },
  { id: "rating", label: "Avg rating", fmt: (v: number) => v.toFixed(1) },
  { id: "motm", label: "MOTM" },
  { id: "passPct", label: "Pass %", fmt: (v: number) => `${v}%` },
  { id: "tackles", label: "Tackles", perGame: true, cpuSkewed: true },
  { id: "cleanSheets", label: "Clean sheets", note: "in saved games" },
  { id: "interceptions", label: "Interceptions", saved: true },
  { id: "dribbles", label: "Dribbles", saved: true },
  { id: "keyPasses", label: "Key passes", saved: true },
  { id: "secondAssists", label: "Second assists", saved: true },
] as const;

type MetricId = (typeof METRICS)[number]["id"];

export function Leaderboard({ rows }: { rows: BoardRow[] }) {
  const [metric, setMetric] = useState<MetricId>("goals");
  const m = METRICS.find((x) => x.id === metric)!;
  const sorted = [...rows].sort((a, b) => b[metric] - a[metric]);
  const max = Math.max(...sorted.map((r) => r[metric]), 1);
  return (
    <div className="stack" style={{ gap: 24 }}>
      <div className="tabs" role="group" aria-label="Rank players by">
        {METRICS.map((x) => (
          <button key={x.id} type="button" aria-pressed={x.id === metric} onClick={() => setMetric(x.id)}>
            {x.label}
          </button>
        ))}
      </div>
      <div className="stack" style={{ gap: 10 }}>
        {sorted.map((r, i) => {
          const v = r[metric];
          const skewed = "cpuSkewed" in m && m.cpuSkewed && r.controlsCpu;
          return (
            <a key={r.gamertag} className="card row" style={{ gap: 20, padding: "16px 22px" }} href={`/players/${encodeURIComponent(r.gamertag)}`}>
              <span className="display muted" style={{ fontSize: 36, width: 40 }}>{i + 1}</span>
              <div style={{ flex: "1 1 220px", minWidth: 0 }}>
                <div className="row" style={{ gap: 10 }}>
                  <img className="flag" src={r.flag} alt="" />
                  <span style={{ fontWeight: 700, fontSize: 19 }}>{r.gamertag}</span>
                </div>
                <div className="muted" style={{ fontSize: 14 }}>
                  {r.proName} · {r.position}{r.role ? ` · ${r.role}` : ""} · {r.games} games · OVR {r.overall}
                </div>
              </div>
              <div className="bar" style={{ flex: "2 1 260px", height: 12 }}>
                <div style={{ width: `${Math.round((v / max) * 100)}%`, opacity: skewed ? 0.45 : 1 }} />
              </div>
              <div style={{ minWidth: 120, textAlign: "right" }}>
                <div className="display num" style={{ fontSize: 36, fontWeight: 900 }}>{"saved" in m ? v.toFixed(1) : "fmt" in m ? m.fmt(v) : v}</div>
                <div className="muted" style={{ fontSize: 13 }}>
                  {"saved" in m
                    ? `per game · ${r.savedGames} saved`
                    : "perGame" in m && m.perGame && r.games
                      ? `${(v / r.games).toFixed(2)} per game`
                      : "note" in m
                        ? m.note
                        : m.label}
                  {skewed ? " · incl. CPU" : ""}
                </div>
              </div>
            </a>
          );
        })}
      </div>
    </div>
  );
}
