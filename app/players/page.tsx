import { Leaderboard } from "@/components/Leaderboard";
import { flagUrl } from "@/lib/ea-assets";
import { getMembers } from "@/lib/stats";

export const dynamic = "force-dynamic";
export const metadata = { title: "Players" };

export default async function PlayersPage() {
  const rows = (await getMembers())
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
        Players marked ANY run the CPU teammates, so EA adds the CPU&apos;s passes, tackles and cards to their line.
        Compare them on goals, assists, rating and MOTM.
      </p>
    </main>
  );
}
