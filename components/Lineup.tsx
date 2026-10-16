"use client";

import { useState } from "react";

type Result = "W" | "D" | "L";
export type LineupPickGame = { id: string; date: string; result: Result; gf: number; ga: number; opp: string; players: string[] };
type Pick = "any" | "with" | "without";

const POINTS: Record<Result, number> = { W: 3, D: 1, L: 0 };
const NEXT: Record<Pick, Pick> = { any: "with", with: "without", without: "any" };
/** games listed under the record */
const SHOW = 8;

function record(games: LineupPickGame[]) {
  const n = games.length;
  const count = (r: Result) => games.filter((g) => g.result === r).length;
  const sum = (f: (g: LineupPickGame) => number) => games.reduce((s, g) => s + f(g), 0);
  return {
    games: n,
    w: count("W"),
    d: count("D"),
    l: count("L"),
    ppg: n ? sum((g) => POINTS[g.result]) / n : 0,
    gf: n ? sum((g) => g.gf) / n : 0,
    ga: n ? sum((g) => g.ga) / n : 0,
  };
}

const signed = (v: number) => {
  const r = Number(v.toFixed(2));
  return `${r > 0 ? "+" : ""}${r.toFixed(2)}`;
};

/** Pick players in and out; shows how the club did in the games that match. */
export function Lineup({ players, games }: { players: string[]; games: LineupPickGame[] }) {
  const [picks, setPicks] = useState<Record<string, Pick>>({});
  const pick = (p: string) => picks[p] ?? "any";
  const withs = players.filter((p) => pick(p) === "with");
  const withouts = players.filter((p) => pick(p) === "without");
  const matching = games.filter((g) => withs.every((p) => g.players.includes(p)) && !withouts.some((p) => g.players.includes(p)));
  const all = record(games);
  const rec = record(matching);
  const picked = withs.length + withouts.length > 0;

  return (
    <div className="card stack" style={{ gap: 18 }}>
      <div className="stack" style={{ gap: 8 }}>
        <span className="muted" style={{ fontSize: 13 }}>Tap a player: once for with, twice for without, again to clear.</span>
        <div className="filter-group">
          {players.map((p) => {
            const v = pick(p);
            return (
              <button
                key={p}
                type="button"
                className="pill"
                aria-current={v === "with" ? "true" : undefined}
                aria-label={`${p}: ${v === "any" ? "either" : v}`}
                style={v === "without" ? { background: "var(--shame-line)", borderColor: "var(--shame-line)", color: "var(--shame)" } : { background: v === "with" ? undefined : "transparent" }}
                onClick={() => setPicks({ ...picks, [p]: NEXT[v] })}
              >
                {v === "with" ? "✓ " : v === "without" ? "✗ " : ""}
                {p}
              </button>
            );
          })}
          {picked ? (
            <button type="button" className="ghost" style={{ minHeight: 36, padding: "6px 14px" }} onClick={() => setPicks({})}>
              Clear
            </button>
          ) : null}
        </div>
      </div>

      <div className="row" style={{ gap: 28, alignItems: "flex-end" }}>
        <div className="stack" style={{ gap: 4 }}>
          <span className="kpi-label">
            {picked
              ? [withs.length ? `With ${withs.join(", ")}` : "", withouts.length ? `without ${withouts.join(", ")}` : ""].filter(Boolean).join(", ").replace(/^w/, "W")
              : "All games"}
          </span>
          <span className="display num" style={{ fontSize: 44 }}>{rec.games ? rec.ppg.toFixed(2) : "–"}</span>
          <span className="kpi-sub">
            {rec.games ? `points per game · ${rec.w}-${rec.d}-${rec.l} in ${rec.games}` : "no games with this lineup"}
          </span>
        </div>
        {rec.games ? (
          <div className="stack" style={{ gap: 4 }}>
            <span className="kpi-label">Goals for / against</span>
            <span className="display num" style={{ fontSize: 28 }}>{rec.gf.toFixed(1)} / {rec.ga.toFixed(1)}</span>
            <span className="kpi-sub">per game</span>
          </div>
        ) : null}
        {picked && rec.games ? (
          <div className="stack" style={{ gap: 4 }}>
            <span className="kpi-label">vs all {all.games} games</span>
            <span className="display num" style={{ fontSize: 28, color: rec.ppg - all.ppg >= 0 ? "var(--accent)" : "var(--shame)" }}>{signed(rec.ppg - all.ppg)}</span>
            <span className="kpi-sub">points per game ({all.ppg.toFixed(2)})</span>
          </div>
        ) : null}
      </div>
      {picked && rec.games > 0 && rec.games < 3 ? <span className="muted" style={{ fontSize: 13 }}>Only {rec.games} game{rec.games === 1 ? "" : "s"}: says very little.</span> : null}

      {picked && rec.games ? (
        <div className="stack" style={{ gap: 0 }}>
          {matching.slice(0, SHOW).map((g) => (
            <a key={g.id} href={`/matches/${g.id}`} className="row" style={{ gap: 12, padding: "10px 0", borderTop: "1px solid var(--line)", textDecoration: "none", color: "var(--text)", flexWrap: "nowrap" }}>
              <span className={`badge badge-${g.result}`} style={{ width: 28, height: 28, flexBasis: 28, fontSize: 13 }}>{g.result}</span>
              <span className="num" style={{ fontWeight: 700, minWidth: 40 }}>{g.gf}–{g.ga}</span>
              <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{g.opp}</span>
              <span className="muted" style={{ fontSize: 13, whiteSpace: "nowrap" }}>{g.date}</span>
            </a>
          ))}
          {matching.length > SHOW ? <span className="muted" style={{ fontSize: 13, paddingTop: 8 }}>+ {matching.length - SHOW} older</span> : null}
        </div>
      ) : null}
    </div>
  );
}
