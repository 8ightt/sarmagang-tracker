"use client";

import { useActionState } from "react";
import { setCaptain, setSeasonCpuReds, toggleCpuRed, type ActionState } from "@/lib/actions";

function Msg({ state }: { state: ActionState }) {
  if (!state) return null;
  return <span className={`form-msg ${state.ok ? "ok" : "err"}`} role="status">{state.message}</span>;
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
