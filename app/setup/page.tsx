import { Setup } from "@/components/Setup";
import { CLUB_PASSWORD, clubId, loadSettings, refreshSettings } from "@/lib/config";

export const dynamic = "force-dynamic";
export const metadata = { title: "Set up" };

export default async function SetupPage() {
  await refreshSettings();
  const current = clubId() ? { name: loadSettings().club?.name ?? "this club" } : null;
  return (
    <main className="bands">
      <Setup current={current} editingOn={Boolean(CLUB_PASSWORD)} />
    </main>
  );
}
