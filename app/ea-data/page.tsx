import type { Metadata } from "next";
import data from "@/docs/ea-data.json";
import { sql } from "@/lib/db";

// not linked from the nav; kept out of search engines
export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "EA data", robots: { index: false, follow: false } };

type Field = { status?: string; meaning?: string; usedFor?: string; note?: string; evidence?: string; codes?: Record<string, string>; source?: string; confirmed?: string };
type Section = { title: string; path: string; about?: string; fields: Record<string, Field> };
type Endpoint = { query: string; about: string; sections: Section[] };
type Counter = { meaning?: string; guess?: string; status?: string; evidence?: string; screen?: string; note?: string; usedIn?: string };

const STATUS_ICON: Record<string, string> = { verified: "✅", assumed: "🟡", unknown: "❓", useless: "⛔", doubtful: "🟠", wrong: "❌", guess: "🔍" };
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

/** "265, 266" → [265, 266]; "99-103, 219" → [99..103, 219] */
function ids(key: string): number[] {
  return key.split(",").flatMap((part) => {
    const [a, b] = part.trim().split("-").map(Number);
    if (!Number.isFinite(a)) return [];
    if (!Number.isFinite(b)) return [a];
    return Array.from({ length: b - a + 1 }, (_, i) => a + i);
  });
}

const COUNTER_GROUPS: { key: "decoded" | "fromResearch" | "candidates"; title: string; about: string }[] = [
  { key: "decoded", title: "Decoded by us", about: "Worked out from our own saved games and checked against EA's headline stats." },
  { key: "fromResearch", title: "From the research project", about: "Mappings published by Interactive-63/eafc-pro-clubs-api-research; the ones checked against in-game screens say so." },
  { key: "candidates", title: "Candidates", about: "Likely meaning, not proven." },
];

function counterIndex() {
  const c = data.matchEventCounters as unknown as Record<string, Record<string, Counter | string>>;
  const byId = new Map<number, { key: string; group: string; c: Counter }>();
  for (const g of COUNTER_GROUPS) {
    for (const [key, v] of Object.entries(c[g.key])) {
      if (typeof v !== "object") continue;
      for (const id of ids(key)) byId.set(id, { key, group: g.title, c: v });
    }
  }
  return byId;
}

async function countersSeen(): Promise<{ id: number; lines: number; total: number }[]> {
  try {
    const rows = await sql()`
      select key::int as id, count(*)::int as lines, sum(value::int)::int as total
      from match_players, jsonb_each_text(counters)
      where counters is not null and key ~ '^[0-9]+$' and value ~ '^[0-9]+$'
      group by 1 order by 1`;
    return rows as unknown as { id: number; lines: number; total: number }[];
  } catch {
    return [];
  }
}

function Status({ s }: { s?: string }) {
  if (!s) return null;
  return <span className="nowrap">{STATUS_ICON[s] ?? ""} {s}</span>;
}

function Detail({ f }: { f: Field | Counter }) {
  const x = f as Field & Counter;
  return (
    <>
      {x.meaning ?? x.guess}
      {x.codes && (
        <div className="muted small">
          Codes: {Object.entries(x.codes).map(([k, v], i) => <span key={k}>{i ? ", " : ""}<code>{k}</code> {v}</span>)}
        </div>
      )}
      {x.note && <div className="muted small"><strong>Note:</strong> {x.note}</div>}
      {(x.evidence || x.screen) && <div className="muted small"><strong>Evidence:</strong> {x.evidence ?? x.screen}</div>}
      {x.source && <div className="muted small"><strong>Source:</strong> {x.source}</div>}
      {x.confirmed && <div className="muted small"><strong>Confirmed:</strong> {x.confirmed}</div>}
    </>
  );
}

export default async function EaDataPage() {
  const endpoints = data.endpoints as unknown as Record<string, Endpoint>;
  const counters = data.matchEventCounters as unknown as Record<string, unknown>;
  const seen = await countersSeen();
  const known = counterIndex();

  return (
    <main className="wrap ea-doc">
      <section className="stack">
        <h1 className="display">EA data</h1>
        <p className="muted">
          Every field EA&apos;s Pro Clubs API sends, what each one means, how sure we are and where the site uses it. Last updated {data.updated}.
          Source: <code>docs/ea-data.json</code>.
        </p>
        <nav className="row" aria-label="On this page">
          <a href="#api">The API</a>
          {Object.keys(endpoints).map((k) => <a key={k} href={`#${slug(k)}`}>{k}</a>)}
          <a href="#counters">Hidden counters</a>
          <a href="#seen">Counters in our games</a>
          <a href="#thanks">Thanks</a>
        </nav>
        <p className="muted small">
          {Object.entries(data.status).map(([k, v]) => <span key={k} className="nowrap" style={{ marginRight: 16 }}>{STATUS_ICON[k]} <strong>{k}</strong>: {v}</span>)}
        </p>
      </section>

      <section id="api" className="stack">
        <h2 className="display">The API</h2>
        <div className="card stack">
          <div><strong>Base URL:</strong> <code>{data.api.base}</code> · no login</div>
          <div><strong>Platform:</strong> {data.api.platform}</div>
          <div><strong>Bot filter:</strong> {data.api.botFilter}</div>
          <div><strong>Caching:</strong> {data.api.caching}</div>
          <div><strong>Values:</strong> {data.api.values}</div>
          <div><strong>What we keep:</strong> {data.evidence.note}</div>
          <div><strong>Not available:</strong> {data.api.notAvailable.join("; ")}.</div>
          <div><strong>Endpoints that don&apos;t exist:</strong> {data.api.notFound}</div>
        </div>
      </section>

      {Object.entries(endpoints).map(([name, ep]) => (
        <section key={name} id={slug(name)} className="stack">
          <h2 className="display">{name}</h2>
          <p className="muted">{ep.about}</p>
          <p className="small"><code>GET {data.api.base}/{name}?platform=common-gen5&amp;{ep.query}</code></p>
          {ep.sections.map((s) => (
            <div key={s.title} className="stack">
              <h3>{s.title} <span className="muted small"><code>{s.path}</code></span></h3>
              {s.about && <p className="muted small">{s.about}</p>}
              <div className="table-box">
                <table>
                  <thead><tr><th>Field</th><th>How sure</th><th>What it is</th><th>Used on the site</th></tr></thead>
                  <tbody>
                    {Object.entries(s.fields).map(([field, f]) => (
                      <tr key={field}>
                        <td><code>{field}</code></td>
                        <td><Status s={f.status} /></td>
                        <td><Detail f={f} /></td>
                        <td className="muted">{f.usedFor}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </section>
      ))}

      <section id="counters" className="stack">
        <h2 className="display">Hidden counters</h2>
        <div className="card stack">
          <div><strong>Format:</strong> {String(counters.format)}</div>
          <div><strong>Key finding:</strong> {String(counters.keyFinding)}</div>
          <div><strong>Method:</strong> {String(counters.method)}</div>
          <div><strong>Not decoded yet:</strong> {String(counters.notYetDecoded)}</div>
        </div>
        {COUNTER_GROUPS.map((g) => {
          const entries = Object.entries(counters[g.key] as Record<string, Counter | string>);
          const about = entries.find(([k]) => k === "about")?.[1];
          return (
            <div key={g.key} className="stack">
              <h3>{g.title}</h3>
              <p className="muted small">{typeof about === "string" ? about : g.about}</p>
              <div className="table-box">
                <table>
                  <thead><tr><th>Counter</th><th>How sure</th><th>What it counts</th><th>Used on the site</th></tr></thead>
                  <tbody>
                    {entries.filter(([, v]) => typeof v === "object").map(([k, v]) => {
                      const c = v as Counter;
                      return (
                        <tr key={k}>
                          <td><code>{k}</code></td>
                          <td><Status s={c.status ?? (c.guess ? "guess" : undefined)} /></td>
                          <td><Detail f={c} /></td>
                          <td className="muted">{c.usedIn}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })}
        <h3>Worked out from the counters</h3>
        <div className="card stack">
          {Object.entries(counters.derived as Record<string, string>).map(([k, v]) => (
            <div key={k}><strong>{k}:</strong> {v}</div>
          ))}
        </div>
      </section>

      <section id="seen" className="stack">
        <h2 className="display">Counters in our games</h2>
        <p className="muted">
          Every counter id in the games the site has saved, live from the database: on how many player lines it appears and its total.
          Ids without a meaning are still to decode.
        </p>
        {seen.length === 0 ? (
          <p className="muted">No counters saved yet.</p>
        ) : (
          <div className="table-box">
            <table>
              <thead><tr><th>Counter</th><th>Lines</th><th>Total</th><th>Meaning</th></tr></thead>
              <tbody>
                {seen.map((r) => {
                  const k = known.get(r.id);
                  return (
                    <tr key={r.id}>
                      <td><code>{r.id}</code></td>
                      <td className="num">{r.lines}</td>
                      <td className="num">{r.total}</td>
                      <td className={k ? undefined : "muted"}>
                        {k ? <>{STATUS_ICON[k.c.status ?? "guess"]} {k.c.meaning ?? k.c.guess} <span className="muted small">({k.group})</span></> : "❓ unknown"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section id="thanks" className="stack">
        <h2 className="display">Thanks</h2>
        {data.thanks.map((t) => (
          <div key={t.project} className="card stack">
            <div><a href={t.url}><strong>{t.project}</strong></a> · <span className="muted">{t.file}</span></div>
            <div>{t.thanks}</div>
            <div className="muted small">Used for: {t.usedFor}</div>
          </div>
        ))}
      </section>
    </main>
  );
}
