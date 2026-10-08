"use client";

import { useActionState, useState } from "react";
import { addTactic, removeTactic, type ActionState } from "@/lib/actions";
import type { Tactic } from "@/lib/stats";

function Msg({ state }: { state: ActionState }) {
  if (!state) return null;
  return <span className={`form-msg ${state.ok ? "ok" : "err"}`} role="status">{state.message}</span>;
}

function CopyCode({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className="ghost"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(code);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        } catch {
          /* clipboard blocked: the code is visible to copy by hand */
        }
      }}
    >
      {copied ? "Copied" : "Copy code"}
    </button>
  );
}

function RemoveTactic({ id }: { id: number }) {
  const [state, action, pending] = useActionState(removeTactic, null);
  return (
    <form action={action} className="inline-form">
      <input type="hidden" name="id" value={id} />
      <input type="password" name="password" placeholder="Club password" aria-label="Club password" style={{ width: 140 }} required />
      <button type="submit" className="ghost" disabled={pending}>Remove</button>
      <Msg state={state} />
    </form>
  );
}

export function Tactics({ tactics }: { tactics: Tactic[] }) {
  const [state, action, pending] = useActionState(addTactic, null);
  return (
    <div className="stack">
      {tactics.length ? (
        <div className="grid grid-270">
          {tactics.map((t) => (
            <div key={t.id} className="card stack" style={{ gap: 10 }}>
              <div className="row between">
                <span style={{ fontWeight: 700, fontSize: 18 }}>{t.name}</span>
                {t.formation ? <span className="chip">{t.formation}</span> : null}
              </div>
              <code className="display num" style={{ fontSize: 22, letterSpacing: "0.06em", textTransform: "none" }}>{t.code}</code>
              {t.note ? <span className="text-2" style={{ fontSize: 14 }}>{t.note}</span> : null}
              <div className="row" style={{ gap: 8 }}>
                <CopyCode code={t.code} />
              </div>
              <details>
                <summary style={{ fontSize: 13 }}>Remove{t.added_by ? ` · added by ${t.added_by}` : ""}</summary>
                <div style={{ marginTop: 8 }}><RemoveTactic id={t.id} /></div>
              </details>
            </div>
          ))}
        </div>
      ) : (
        <p className="muted" style={{ margin: 0 }}>No tactics saved yet. Share a tactic in-game, then add its code here.</p>
      )}
      <details>
        <summary>Add a tactic</summary>
        <form action={action} className="inline-form" style={{ marginTop: 12 }}>
          <input type="text" name="name" placeholder="Name, e.g. Full squad 4-3-3" aria-label="Tactic name" required />
          <input type="text" name="formation" placeholder="Formation" aria-label="Formation" style={{ width: 110 }} />
          <input type="text" name="code" placeholder="Share code" aria-label="Share code" style={{ width: 170 }} required />
          <input type="text" name="note" placeholder="When to use it" aria-label="Note" />
          <input type="text" name="by" placeholder="Your name" aria-label="Your name" style={{ width: 130 }} />
          <input type="password" name="password" placeholder="Club password" aria-label="Club password" style={{ width: 150 }} required />
          <button type="submit" disabled={pending}>Save tactic</button>
          <Msg state={state} />
        </form>
      </details>
    </div>
  );
}
