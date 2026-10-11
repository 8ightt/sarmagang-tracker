import { Crest, when } from "@/components/bits";
import { CLUB_ID } from "@/lib/config";
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
    <main className="wrap">
      <a href="/" style={{ fontWeight: 600 }}>← Club</a>
      <div className="stack" style={{ gap: 8 }}>
        <span className="eyebrow">EA leaderboard · PS5 / Xbox Series</span>
        <h1 className="display">World top 100</h1>
        <span className="text-2">
          The 100 clubs with the highest Skill Rating.
          {!inIt && last && club.skillRating !== null
            ? ` Sarma gang (${club.skillRating}) needs ${last.skillRating - club.skillRating} more to reach #100.`
            : ""}
          {top ? ` Updated ${when(top.updatedAt / 1000)}.` : ""}
        </span>
      </div>

      {clubs.length ? (
        <div className="table-box">
          <table>
            <thead>
              <tr><th>#</th><th style={{ textAlign: "left" }}>Club</th><th>Skill rating</th><th>Division</th><th>W-D-L</th><th>Win %</th><th>Goals</th><th>Reputation</th></tr>
            </thead>
            <tbody>
              {clubs.map((c) => (
                <tr key={c.clubId} style={c.clubId === CLUB_ID ? { outline: "1px solid var(--accent)" } : undefined}>
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
                <tr style={{ outline: "1px solid var(--accent)" }}>
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
    </main>
  );
}
