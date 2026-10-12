import { Leaderboard } from "@/components/Leaderboard";
import { flagUrl } from "@/lib/ea-assets";
import { getMembers, getTracked } from "@/lib/stats";

export const dynamic = "force-dynamic";
export const metadata = { title: "Players" };

export default async function PlayersPage() {
  const [members, tracked] = await Promise.all([getMembers(), getTracked()]);
  const rows = members
    .filter((m) => m.games > 0)
    .map((m) => ({
      gamertag: m.gamertag,
      proName: m.proName,
      position: m.position,
      role: m.role,
      flag: flagUrl(m.nation),
      overall: m.overall,
      games: m.games,
      goals: m.goals,
      assists: m.assists,
      ga: m.goals + m.assists,
      rating: m.rating,
      motm: m.motm,
      passPct: m.passPct,
      tackles: m.tackles,
      cleanSheets: tracked.get(m.gamertag)?.cleanSheets ?? 0,
      controlsCpu: m.controlsCpu,
    }));
  return (
    <main className="wrap">
      <div className="stack" style={{ gap: 8 }}>
        <span className="eyebrow">Season leaderboard</span>
        <h1 className="display">Who&apos;s carrying</h1>
      </div>
      <Leaderboard rows={rows} />
      <p className="muted" style={{ fontSize: 13, margin: 0 }}>
        Goals, assists, passes and tackles are each player&apos;s own: the CPU&apos;s share is taken out for every game this
        site saved. Games from before that still include it for players who ran the CPU (marked ANY), and EA keeps
        tackle success and red cards as one total.
      </p>
    </main>
  );
}
