"use client";

import { useActionState } from "react";
import { checkNow, saveStatFixes, setCaptain, setSeasonCpuReds, setSeasonState, toggleCpuRed, type ActionState } from "@/lib/actions";

function Msg({ state }: { state: ActionState }) {
  if (!state) return null;
  return <span className={`form-msg ${state.ok ? "ok" : "err"}`} role="status">{state.message}</span>;
}

/** Fetches from EA right away (at most once a minute, see checkNow). */
export function CheckNowButton() {
  const [state, action, pending] = useActionState(checkNow, null);
  return (
    <form action={action} className="inline-form" style={{ display: "inline-flex", gap: 8, alignItems: "center" }}>
      <button type="submit" className="pill" disabled={pending}>
        {pending ? "Checking EA…" : "Check now"}
      </button>
      <Msg state={state} />
    </form>
  );
}

export function CpuRedButton({ matchId, player, isCpu }: { matchId: string; player: string; isCpu: boolean }) {
  const [state, action, pending] = useActionState(toggleCpuRed, null);
  return (
    <form action={action} className="inline-form" style={{ justifyContent: "flex-end" }}>
      <input type="hidden" name="matchId" value={matchId} />
      <input type="hidden" name="player" value={player} />
      <label className="muted" style={{ fontSize: 13 }}>
        <span className="sr-only" style={{ position: "absolute", left: -9999 }}>Club password</span>
        <input type="password" name="password" placeholder="Club password" aria-label="Club password" style={{ width: 150 }} required />
      </label>
      <button type="submit" className={isCpu ? "ghost" : "danger"} disabled={pending}>
        {isCpu ? "CPU card · undo" : "His card · mark as CPU"}
      </button>
      <Msg state={state} />
    </form>
  );
}

export function CaptainForm({ matchId, players, current }: { matchId: string; players: string[]; current?: string | null }) {
  const [state, action, pending] = useActionState(setCaptain, null);
  return (
    <form action={action} className="inline-form">
      <input type="hidden" name="matchId" value={matchId} />
      <label className="row" style={{ gap: 8 }}>
        <span className="text-2">Captain</span>
        <select name="captain" defaultValue={current ?? ""}>
          <option value="">Not set</option>
          {players.map((p) => (
            <option key={p} value={p}>{p}</option>
          ))}
        </select>
      </label>
      <input type="password" name="password" placeholder="Club password" aria-label="Club password" style={{ width: 150 }} required />
      <button type="submit" disabled={pending}>Save</button>
      <Msg state={state} />
    </form>
  );
}

export function SeasonRedsForm({ player, current }: { player: string; current: number }) {
  const [state, action, pending] = useActionState(setSeasonCpuReds, null);
  return (
    <form action={action} className="inline-form">
      <input type="hidden" name="player" value={player} />
      <label className="row" style={{ gap: 8 }}>
        <span className="text-2">Earlier red cards that were the CPU&apos;s</span>
        <input type="number" name="amount" min={0} max={50} defaultValue={current} style={{ width: 80 }} />
      </label>
      <input type="password" name="password" placeholder="Club password" aria-label="Club password" style={{ width: 150 }} required />
      <button type="submit" disabled={pending}>Save</button>
      <Msg state={state} />
    </form>
  );
}

export type FixRow = {
  player: string;
  fixed: boolean;
  position: string | null;
  rating: number;
  goals: number;
  assists: number;
  shots: number;
  passes: number;
  tackles: number;
  motm: boolean;
};

const POSITION_OPTIONS = ["", "GK", "LB", "LCB", "CB", "RCB", "RB", "LWB", "RWB", "CDM", "LCM", "CM", "RCM", "CAM", "LM", "RM", "LW", "RW", "CF", "ST"];

/** Lets the club type in the real lines from the in-game "Player Performance" screen. */
export function FixStatsForm({ matchId, rows }: { matchId: string; rows: FixRow[] }) {
  const [state, action, pending] = useActionState(saveStatFixes, null);
  const num = { width: 64 } as const;
  return (
    <form action={action} className="stack" style={{ gap: 12 }}>
      <input type="hidden" name="matchId" value={matchId} />
      <div className="table-box">
        <table>
          <thead>
            <tr>
              <th>Correct</th><th>Player</th><th>Pos</th><th>Rating</th><th>G</th><th>A</th><th>Shots</th><th>Passes</th><th>Tackles</th><th>MOTM</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.player}>
                <td>
                  <input type="hidden" name={`player_${i}`} value={r.player} />
                  <input type="checkbox" name={`fix_${i}`} defaultChecked={r.fixed} aria-label={`Correct ${r.player}`} style={{ width: 20, height: 20 }} />
                </td>
                <td style={{ fontWeight: 700 }}>{r.player}</td>
                <td>
                  <select name={`position_${i}`} defaultValue={r.position ?? ""} aria-label={`${r.player} position`}>
                    {POSITION_OPTIONS.map((p) => <option key={p} value={p}>{p || "–"}</option>)}
                  </select>
                </td>
                <td><input type="text" inputMode="decimal" name={`rating_${i}`} defaultValue={r.rating ? r.rating.toFixed(1) : ""} aria-label={`${r.player} rating`} style={num} /></td>
                <td><input type="number" min={0} name={`goals_${i}`} defaultValue={r.goals} aria-label={`${r.player} goals`} style={num} /></td>
                <td><input type="number" min={0} name={`assists_${i}`} defaultValue={r.assists} aria-label={`${r.player} assists`} style={num} /></td>
                <td><input type="number" min={0} name={`shots_${i}`} defaultValue={r.shots} aria-label={`${r.player} shots`} style={num} /></td>
                <td><input type="number" min={0} name={`passes_${i}`} defaultValue={r.passes} aria-label={`${r.player} passes`} style={num} /></td>
                <td><input type="number" min={0} name={`tackles_${i}`} defaultValue={r.tackles} aria-label={`${r.player} tackles`} style={num} /></td>
                <td><input type="radio" name="motm" value={r.player} defaultChecked={r.motm} aria-label={`${r.player} man of the match`} style={{ width: 20, height: 20 }} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="inline-form">
        <input type="text" name="by" placeholder="Your name" aria-label="Your name" style={{ width: 140 }} />
        <input type="password" name="password" placeholder="Club password" aria-label="Club password" style={{ width: 150 }} required />
        <button type="submit" disabled={pending}>Save real stats</button>
        <Msg state={state} />
      </div>
    </form>
  );
}

export function SeasonForm({ division, points, target, chances }: { division: number; points: number; target: number; chances: number }) {
  const [state, action, pending] = useActionState(setSeasonState, null);
  const field = { width: 72 } as const;
  return (
    <form action={action} className="inline-form">
      <label className="row" style={{ gap: 6 }}><span className="text-2">Division</span><input type="number" name="division" min={1} max={10} defaultValue={division} style={field} /></label>
      <label className="row" style={{ gap: 6 }}><span className="text-2">Points</span><input type="number" name="points" min={0} defaultValue={points} style={field} /></label>
      <label className="row" style={{ gap: 6 }}><span className="text-2">of</span><input type="number" name="target" min={1} defaultValue={target} style={field} /></label>
      <label className="row" style={{ gap: 6 }}><span className="text-2">Chances</span><input type="number" name="chances" min={0} max={3} defaultValue={chances} style={field} /></label>
      <input type="password" name="password" placeholder="Club password" aria-label="Club password" style={{ width: 150 }} required />
      <button type="submit" disabled={pending}>Save</button>
      <Msg state={state} />
    </form>
  );
}
