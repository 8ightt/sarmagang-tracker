import { Crest, when } from "@/components/bits";
import { CLUB_ID, PLATFORM } from "@/lib/config";
import { reputationName } from "@/lib/ea-assets";
import { divisionName, getClub, getTop100 } from "@/lib/stats";

export const dynamic = "force-dynamic";
export const metadata = { title: "World top 100" };

export default async function TopHundredPage() {
  const [club, top] = await Promise.all([getClub(), getTop100()]);
  const clubs = top?.clubs ?? [];
  const inIt = clubs.some((c) => c.clubId === CLUB_ID);
  const last = clubs[clubs.length - 1];

  return (
    <main className="bands">
      <section className="band band-club board-head">
        <div className="wrap" style={{ gap: 14 }}>
          <a href="/" className="back-link">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 2 4 7l5 5" /></svg>
            Club
          </a>
          <h1 className="display">World top 100</h1>
          <p className="text-2" style={{ margin: 0, fontSize: 17, maxWidth: "70ch" }}>
            The 100 clubs with the highest Skill Rating on {PLATFORM === "common-gen4" ? "PS4 and Xbox One" : PLATFORM === "nx" ? "Switch" : "PS5, Xbox Series and PC"}.
            {!inIt && last && club.skillRating !== null
              ? ` ${club.name} (${club.skillRating}) needs ${last.skillRating - club.skillRating} more to reach #100.`
              : ""}
            {top ? ` Updated ${when(top.updatedAt / 1000)}.` : ""}
          </p>
        </div>
      </section>

      <section className="band section-light">
        <div className="wrap" style={{ gap: 20 }}>

      {clubs.length ? (
        <div className="table-box">
          <table>
            <thead>
              <tr><th>#</th><th style={{ textAlign: "left" }}>Club</th><th>Skill rating</th><th>Division</th><th>W-D-L</th><th>Win %</th><th>Goals</th><th>Reputation</th></tr>
            </thead>
            <tbody>
              {clubs.map((c) => (
                <tr key={c.clubId} className={c.clubId === CLUB_ID ? "is-us" : undefined}>
                  <td className="num">{c.rank}</td>
                  <td style={{ textAlign: "left" }}>
                    <span className="row" style={{ gap: 10, flexWrap: "nowrap" }}>
                      <Crest id={c.crest} size={26} />
                      <strong>{c.name}</strong>
                    </span>
                  </td>
                  <td className="num" style={{ fontWeight: 700 }}>{c.skillRating}</td>
                  <td>{divisionName(c.division)}</td>
                  <td className="num">{c.wins}-{c.ties}-{c.losses}</td>
                  <td className="num">{c.games ? Math.round((c.wins / c.games) * 100) : 0}%</td>
                  <td className="num">{c.goals}–{c.goalsAgainst}</td>
                  <td>{reputationName(c.reputationTier)} <span className="muted">· level {c.reputationLevel}</span></td>
                </tr>
              ))}
              {!inIt ? (
                <tr className="is-us">
                  <td className="muted">–</td>
                  <td style={{ textAlign: "left" }}>
                    <span className="row" style={{ gap: 10, flexWrap: "nowrap" }}>
                      <Crest id={club.crestAssetId} size={26} />
                      <strong>{club.name}</strong>
                    </span>
                  </td>
                  <td className="num" style={{ fontWeight: 700 }}>{club.skillRating ?? "–"}</td>
                  <td colSpan={5} className="muted">Not in the top 100 yet</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="muted">Not loaded yet: the next EA check fetches it.</p>
      )}
      <p className="muted" style={{ fontSize: 13, margin: 0 }}>
        From EA&apos;s allTimeLeaderboard. Division is EA&apos;s own figure, which can lag behind the in-game lobby.
      </p>
        </div>
      </section>
    </main>
  );
}
