"use client";

import { useState } from "react";
import type { FoundClub } from "@/lib/ea-remote";

const PLATFORMS = [
  { id: "common-gen5", label: "PS5 · Xbox Series · PC" },
  { id: "nx", label: "Switch" },
];

type Step = "password" | "find" | "load";
type Loaded = { ok: boolean; newMatches: number; message: string };

/** First visit: the club password set at deploy, then find and pick the club, then the first load. */
export function Setup({ current, editingOn }: { current: { name: string } | null; editingOn: boolean }) {
  const [step, setStep] = useState<Step>("password");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [platform, setPlatform] = useState("common-gen5");
  const [clubs, setClubs] = useState<FoundClub[] | null>(null);
  const [picked, setPicked] = useState<FoundClub | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [loaded, setLoaded] = useState<Loaded | null>(null);

  async function search(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setPicked(null);
    try {
      const res = await fetch(`/api/setup?${new URLSearchParams({ name, platform })}`);
      const body = (await res.json()) as { clubs?: FoundClub[]; error?: string };
      if (!res.ok) throw new Error(body.error ?? "The search didn't work.");
      setClubs(body.clubs ?? []);
    } catch (err) {
      setError((err as Error).message);
      setClubs(null);
    } finally {
      setBusy(false);
    }
  }

  async function pick() {
    if (!picked) return;
    setStep("load");
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password, clubId: picked.clubId, clubName: picked.clubName, platform: picked.platform || platform }),
      });
      const body = (await res.json()) as Loaded;
      if (res.status === 403 || res.status === 409 || res.status === 400) {
        setError(body.message);
        setStep(res.status === 403 ? "password" : "find");
        return;
      }
      setLoaded(body);
    } catch (err) {
      setError((err as Error).message);
      setStep("find");
    } finally {
      setBusy(false);
    }
  }

  const steps: { id: Step; label: string }[] = [
    { id: "password", label: "1 · Password" },
    { id: "find", label: "2 · Find your club" },
    { id: "load", label: "3 · First load" },
  ];

  return (
    <>
      <section className="band band-club setup-hero">
        <div className="wrap" style={{ gap: 0 }}>
          <nav className="setup-steps" aria-label="Setup steps">
            {steps.map((s) => (
              <span key={s.id} aria-current={s.id === step ? "step" : undefined}>{s.label}</span>
            ))}
          </nav>

          {step === "password" ? (
            <form
              className="setup-center"
              onSubmit={(e) => {
                e.preventDefault();
                setError("");
                setStep("find");
              }}
            >
              <h1 className="display">{current ? "Change club" : "Set up your club"}</h1>
              <p className="text-2 setup-lede">
                {current
                  ? `This site follows ${current.name}. Following another club only works on a site with no saved games yet.`
                  : "Enter the club password you chose when you deployed. It's also what you'll use to fix stats and change settings."}
              </p>
              {!editingOn ? <p className="form-msg err">There's no club password yet: add CLUB_PASSWORD in Vercel's environment variables, then reload.</p> : null}
              <div className="setup-search">
                <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Club password" aria-label="Club password" autoComplete="current-password" required />
                <button type="submit" disabled={!password || !editingOn}>Next</button>
              </div>
              {error ? <p className="form-msg err" role="alert">{error}</p> : null}
            </form>
          ) : null}

          {step === "find" ? (
            <form className="setup-center" onSubmit={search}>
              <h1 className="display">Find your club</h1>
              <p className="text-2 setup-lede">
                Type the name <em className="serif">exactly</em> as it shows in Clubs (the start is enough), then pick your club from what EA finds.
              </p>
              <div className="setup-search">
                <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Club name" aria-label="Club name" minLength={2} maxLength={40} required autoFocus />
                <button type="submit" disabled={busy || name.trim().length < 2}>{busy ? "Searching…" : "Search"}</button>
              </div>
              <div className="setup-platforms tabs" role="group" aria-label="Platform">
                {PLATFORMS.map((p) => (
                  <button key={p.id} type="button" aria-pressed={platform === p.id} onClick={() => { setPlatform(p.id); setClubs(null); setPicked(null); }}>
                    {p.label}
                  </button>
                ))}
              </div>
              {error ? <p className="form-msg err" role="alert">{error}</p> : null}
            </form>
          ) : null}

          {step === "load" ? (
            <div className="setup-center" aria-live="polite">
              <h1 className="display">{loaded ? (loaded.ok ? "You're in" : "Nearly there") : "Loading your games"}</h1>
              <p className="text-2 setup-lede">
                {loaded
                  ? loaded.ok
                    ? `Saved ${loaded.newMatches} game${loaded.newMatches === 1 ? "" : "s"} from EA, with the squad and season totals. From now on every game is saved, so nothing drops off.`
                    : `The club is set up, but the first load had a problem: ${loaded.message} The regular check tries again within minutes.`
                  : `Getting ${picked?.clubName ?? "your club"}'s last games, squad and season totals from EA. This takes up to a minute.`}
              </p>
              {busy ? <div className="setup-progress" role="progressbar" aria-label="Loading from EA"><span /></div> : null}
              {loaded ? <a className="setup-go" href="/">Open the club page</a> : null}
            </div>
          ) : null}
        </div>
      </section>

      {step === "find" && clubs ? (
        <section className="band section-light">
          <div className="wrap" style={{ gap: 20 }}>
            <div className="section-head">
              <h2 className="display">{clubs.length ? `${clubs.length} club${clubs.length === 1 ? "" : "s"} found` : "No clubs found"}</h2>
              <span className="muted">EA keeps each club&apos;s last 10 games of each type. The site saves every game from then on.</span>
            </div>
            {clubs.length ? (
              <div className="table-box">
                <table className="setup-results">
                  <thead>
                    <tr><th>Club</th><th>Games</th><th>W · D · L</th></tr>
                  </thead>
                  <tbody>
                    {clubs.map((c) => (
                      <tr key={c.clubId} className={picked?.clubId === c.clubId ? "is-us" : undefined} onClick={() => setPicked(c)}>
                        <td>
                          <label className="setup-pick">
                            <input type="radio" name="club" checked={picked?.clubId === c.clubId} onChange={() => setPicked(c)} />
                            <strong>{c.clubName}</strong>
                          </label>
                        </td>
                        <td>{c.games}</td>
                        <td>{c.wins} · {c.draws} · {c.losses}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-2" style={{ margin: 0 }}>Check the spelling and the platform, or type just the start of the name.</p>
            )}
            {picked ? (
              <div className="setup-confirm">
                <div>
                  <strong>{picked.clubName}</strong>
                  <span>{picked.games} games · {picked.wins}-{picked.draws}-{picked.losses}. Next, the site loads its games and squad from EA.</span>
                </div>
                <button type="button" onClick={pick} disabled={busy}>This is us</button>
              </div>
            ) : null}
          </div>
        </section>
      ) : null}
    </>
  );
}
