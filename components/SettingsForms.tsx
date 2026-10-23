"use client";

import { useActionState, useState } from "react";
import { saveSettings, type ActionState, type SettingsSection } from "@/lib/actions";
import type { ClubSeason, LeagueRules, LookSettings } from "@/lib/config";

export type SettingsPlayer = { gamertag: string; nickname: string; bio: string; position: string; role: string; photo: string; eaPosition: string };

type Props = {
  editingOn: boolean;
  clubName: string;
  tagline: string;
  look: LookSettings;
  /** what the site uses when nothing is set: EA's crest and the colours worked out from EA's kit */
  defaults: { crest: string; club: string; accent: string };
  players: SettingsPlayer[];
  seasons: ClubSeason[];
  league: LeagueRules;
};

const DIVISIONS = [5, 4, 3, 2, 1];
/** biggest side of an uploaded crest, in pixels: keeps it small enough to store */
const CREST_PX = 256;

function Msg({ state }: { state: ActionState }) {
  if (!state) return null;
  return <span className={`form-msg ${state.ok ? "ok" : "err"}`} role="status">{state.message}</span>;
}

/** One section's form: the shared club password, the section name and its value as JSON. */
function Section({ section, password, payload, children }: { section: SettingsSection; password: string; payload: unknown; children: React.ReactNode }) {
  const [state, action, pending] = useActionState(saveSettings, null);
  return (
    <form action={action} className="settings-form">
      <input type="hidden" name="section" value={section} />
      <input type="hidden" name="password" value={password} />
      <input type="hidden" name="payload" value={JSON.stringify(payload)} />
      {children}
      <div className="inline-form">
        <button type="submit" disabled={pending || !password}>{pending ? "Saving…" : "Save"}</button>
        {!password ? <span className="muted small">Enter the club password above to save.</span> : null}
        <Msg state={state} />
      </div>
    </form>
  );
}

/** Black or white, whichever reads better on a colour (same rule as lib/club-theme.ts, simplified). */
function inkOn(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  const lin = (c: number) => ((c /= 255) <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  const l = 0.2126 * lin((n >> 16) & 255) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255);
  return 1.05 / (l + 0.05) >= (l + 0.05) / 0.05 ? "#ffffff" : "#0b0c0c";
}

/** Shows a colour on the whole page right away, before it's saved (the server works out the final one). */
function preview(name: "--club" | "--accent", value: string) {
  const root = document.documentElement.style;
  root.setProperty(name, value);
  root.setProperty(name === "--club" ? "--on-club" : "--on-accent", inkOn(value));
  if (name === "--accent") root.setProperty("--win", value);
}

/** A local datetime-local value for an ISO time, in the browser's own time zone. */
const toLocal = (iso?: string) => {
  if (!iso) return "";
  const d = new Date(iso);
  return Number.isFinite(d.getTime()) ? new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 16) : "";
};

async function shrinkCrest(file: File): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((ok, fail) => {
      const i = new Image();
      i.onload = () => ok(i);
      i.onerror = fail;
      i.src = url;
    });
    const scale = Math.min(1, CREST_PX / Math.max(img.width, img.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(img.width * scale);
    canvas.height = Math.round(img.height * scale);
    canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/png");
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function SettingsForms(p: Props) {
  const [password, setPassword] = useState("");
  const [tagline, setTagline] = useState(p.tagline);
  const [look, setLook] = useState<LookSettings>(p.look);
  const [crestError, setCrestError] = useState("");
  const [players, setPlayers] = useState(p.players);
  const [seasons, setSeasons] = useState(p.seasons.map((s) => ({ ...s, endsAt: toLocal(s.endsAt), playoffsStart: toLocal(s.playoffsStart) })));
  const [league, setLeague] = useState(() => ({
    chances: p.league.chances,
    chancesAfterSurviving: p.league.chancesAfterSurviving,
    divisions: Object.fromEntries(
      DIVISIONS.map((d) => [
        d,
        {
          target: p.league.targets[d] ?? "",
          matches: p.league.promotion[d]?.matches ?? "",
          wins: p.league.promotion[d]?.wins ?? "",
          confirmed: p.league.promotion[d]?.confirmed ?? false,
          pointsAfterMissed: p.league.pointsAfterMissedPromotion[d] ?? "",
        },
      ]),
    ) as Record<number, { target: number | string; matches: number | string; wins: number | string; confirmed: boolean; pointsAfterMissed: number | string }>,
  }));

  const setPlayer = (i: number, key: keyof SettingsPlayer, value: string) => setPlayers((list) => list.map((x, j) => (j === i ? { ...x, [key]: value } : x)));
  const setSeason = (i: number, key: string, value: string) => setSeasons((list) => list.map((x, j) => (j === i ? { ...x, [key]: value } : x)));
  const setDivision = (d: number, key: string, value: string | boolean) =>
    setLeague((l) => ({ ...l, divisions: { ...l.divisions, [d]: { ...l.divisions[d], [key]: value } } }));

  return (
    <div className="settings">
      <div className="card settings-password">
        <label className="stack" style={{ gap: 6 }}>
          <strong>Club password</strong>
          <span className="muted small">The same one that unlocks Fix stats. It's checked again on every save.</span>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Club password" autoComplete="current-password" style={{ maxWidth: 320 }} />
        </label>
        {!p.editingOn ? <p className="form-msg err" style={{ margin: 0 }}>Editing is switched off: set CLUB_PASSWORD in Vercel.</p> : null}
      </div>

      <section className="card stack" id="club">
        <h2 className="card-title">Club</h2>
        <Section section="club" password={password} payload={{ tagline }}>
          <label className="stack" style={{ gap: 6 }}>
            <span className="text-2">Tagline under the club name</span>
            <input type="text" value={tagline} maxLength={120} onChange={(e) => setTagline(e.target.value)} placeholder={`A line about ${p.clubName}`} />
          </label>
        </Section>
      </section>

      <section className="card stack" id="look">
        <h2 className="card-title">Look</h2>
        <p className="muted small" style={{ margin: 0 }}>
          The site takes its colours and crest from EA. Change them here if EA's don't look right; colours repaint the page as you pick
          them, and the accent is lightened if it wouldn't read on the dark background.
        </p>
        <Section section="look" password={password} payload={look}>
          <div className="settings-look">
            <label className="settings-colour">
              <span className="text-2">Shirt colour</span>
              <input type="color" value={look.club || p.defaults.club} onChange={(e) => { setLook({ ...look, club: e.target.value }); preview("--club", e.target.value); }} />
              {look.club ? <button type="button" className="ghost" onClick={() => { setLook({ ...look, club: undefined }); preview("--club", p.defaults.club); }}>Use EA's</button> : <span className="muted small">EA's</span>}
            </label>
            <label className="settings-colour">
              <span className="text-2">Accent</span>
              <input type="color" value={look.accent || p.defaults.accent} onChange={(e) => { setLook({ ...look, accent: e.target.value }); preview("--accent", e.target.value); }} />
              {look.accent ? <button type="button" className="ghost" onClick={() => { setLook({ ...look, accent: undefined }); preview("--accent", p.defaults.accent); }}>Use EA's</button> : <span className="muted small">EA's</span>}
            </label>
            <div className="settings-crest">
              <span className="text-2">Crest</span>
              <img src={look.crest || p.defaults.crest} alt="" width={72} height={72} />
              <label className="pill" style={{ cursor: "pointer" }}>
                Upload image
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  style={{ position: "absolute", width: 1, height: 1, opacity: 0 }}
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    if (file.size > 5_000_000) return setCrestError("That image is over 5 MB.");
                    setCrestError("");
                    setLook({ ...look, crest: await shrinkCrest(file) });
                  }}
                />
              </label>
              {look.crest ? <button type="button" className="ghost" onClick={() => setLook({ ...look, crest: undefined })}>Use EA's</button> : null}
              {crestError ? <span className="form-msg err">{crestError}</span> : null}
            </div>
          </div>
        </Section>
      </section>

      <section className="card stack" id="players">
        <h2 className="card-title">Players</h2>
        <p className="muted small" style={{ margin: 0 }}>
          Nickname and bio show on the club page and the player's page. Leave the bio empty for a line worked out from their latest games.
          Position overrides EA's broad one (e.g. CAM); role shows next to it (e.g. ANY).
        </p>
        <Section section="players" password={password} payload={Object.fromEntries(players.map(({ gamertag, eaPosition: _, ...rest }) => [gamertag, rest]))}>
          <div className="settings-players">
            {players.map((x, i) => (
              <fieldset key={x.gamertag} className="settings-player">
                <legend>{x.gamertag}</legend>
                <label><span>Nickname</span><input type="text" value={x.nickname} maxLength={40} onChange={(e) => setPlayer(i, "nickname", e.target.value)} /></label>
                <label><span>Position</span><input type="text" value={x.position} maxLength={6} placeholder={x.eaPosition} onChange={(e) => setPlayer(i, "position", e.target.value)} /></label>
                <label><span>Role</span><input type="text" value={x.role} maxLength={10} placeholder="ANY" onChange={(e) => setPlayer(i, "role", e.target.value)} /></label>
                <label className="wide"><span>Bio</span><textarea value={x.bio} maxLength={240} rows={2} onChange={(e) => setPlayer(i, "bio", e.target.value)} /></label>
                <label className="wide"><span>Photo link</span><input type="text" value={x.photo} maxLength={300} placeholder="https://…" onChange={(e) => setPlayer(i, "photo", e.target.value)} /></label>
              </fieldset>
            ))}
          </div>
        </Section>
      </section>

      <section className="card stack" id="seasons">
        <h2 className="card-title">Seasons</h2>
        <p className="muted small" style={{ margin: 0 }}>
          Copy these from the in-game Season Info screen. Times are in your own time zone. The Playoffs start is when the end-of-season
          Playoffs open; league points pause from then until the season ends.
        </p>
        <Section section="seasons" password={password} payload={seasons}>
          <div className="table-box">
            <table className="settings-table">
              <thead>
                <tr><th>Name</th><th>First day</th><th>Last day</th><th>Ends at</th><th>Playoffs start</th><th>Playoff games</th><th></th></tr>
              </thead>
              <tbody>
                {seasons.map((s, i) => (
                  <tr key={i}>
                    <td><input type="text" value={s.name} onChange={(e) => setSeason(i, "name", e.target.value)} style={{ width: 130 }} /></td>
                    <td><input type="date" value={s.start} onChange={(e) => setSeason(i, "start", e.target.value)} /></td>
                    <td><input type="date" value={s.end} onChange={(e) => setSeason(i, "end", e.target.value)} /></td>
                    <td><input type="datetime-local" value={s.endsAt ?? ""} onChange={(e) => setSeason(i, "endsAt", e.target.value)} /></td>
                    <td><input type="datetime-local" value={s.playoffsStart ?? ""} onChange={(e) => setSeason(i, "playoffsStart", e.target.value)} /></td>
                    <td><input type="number" min={1} max={50} value={s.playoffsMatches ?? ""} onChange={(e) => setSeason(i, "playoffsMatches", e.target.value)} style={{ width: 90 }} /></td>
                    <td><button type="button" className="ghost" onClick={() => setSeasons((list) => list.filter((_, j) => j !== i))}>Remove</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button type="button" className="ghost" style={{ alignSelf: "flex-start" }} onClick={() => setSeasons((list) => [...list, { name: `Season ${list.length + 1}`, start: "", end: "", endsAt: "", playoffsStart: "" }])}>
            Add a season
          </button>
        </Section>
      </section>

      <section className="card stack" id="league">
        <h2 className="card-title">League rules</h2>
        <p className="muted small" style={{ margin: 0 }}>
          How the season tracker on the club page counts: points to reach the promotion match in each division, how long that series is,
          and the chances you get. Tick “confirmed” once you've seen a series in the lobby.
        </p>
        <Section
          section="league"
          password={password}
          payload={league}
        >
          <div className="inline-form" style={{ gap: 20 }}>
            <label className="row" style={{ gap: 8 }}><span className="text-2">Chances per season</span><input type="number" min={1} max={10} value={league.chances} onChange={(e) => setLeague({ ...league, chances: Number(e.target.value) })} style={{ width: 90 }} /></label>
            <label className="row" style={{ gap: 8 }}><span className="text-2">Chances back after surviving</span><input type="number" min={0} max={10} value={league.chancesAfterSurviving} onChange={(e) => setLeague({ ...league, chancesAfterSurviving: Number(e.target.value) })} style={{ width: 90 }} /></label>
          </div>
          <div className="table-box">
            <table className="settings-table">
              <thead>
                <tr><th>Division</th><th>Points target</th><th>Series games</th><th>Wins needed</th><th>Confirmed</th><th>Points kept after missing</th></tr>
              </thead>
              <tbody>
                {DIVISIONS.map((d) => {
                  const r = league.divisions[d];
                  return (
                    <tr key={d}>
                      <td><strong>Division {d}</strong></td>
                      <td><input type="number" min={1} max={99} value={r.target} onChange={(e) => setDivision(d, "target", e.target.value)} style={{ width: 90 }} /></td>
                      <td><input type="number" min={1} max={9} value={r.matches} onChange={(e) => setDivision(d, "matches", e.target.value)} style={{ width: 90 }} /></td>
                      <td><input type="number" min={1} max={9} value={r.wins} onChange={(e) => setDivision(d, "wins", e.target.value)} style={{ width: 90 }} /></td>
                      <td><input type="checkbox" checked={r.confirmed} onChange={(e) => setDivision(d, "confirmed", e.target.checked)} aria-label={`Division ${d} series confirmed`} /></td>
                      <td><input type="number" min={0} max={99} value={r.pointsAfterMissed} onChange={(e) => setDivision(d, "pointsAfterMissed", e.target.value)} style={{ width: 90 }} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="muted small" style={{ margin: 0 }}>Empty fields use the built-in rule (one more win per division; points kept = one win short of the target).</p>
        </Section>
      </section>
    </div>
  );
}
