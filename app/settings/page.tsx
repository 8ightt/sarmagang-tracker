import { ConnectBotForm } from "@/components/Forms";
import { SettingsForms } from "@/components/SettingsForms";
import { clubTheme } from "@/lib/club-theme";
import { CLUB_PASSWORD, loadSettings } from "@/lib/config";
import { crestUrl } from "@/lib/ea-assets";
import { TELEGRAM_TOKEN } from "@/lib/telegram";
import { getClub, getMembers } from "@/lib/stats";

export const dynamic = "force-dynamic";
export const metadata = { title: "Settings" };

export default async function SettingsPage() {
  const [club, members] = await Promise.all([getClub(), getMembers()]);
  const settings = loadSettings();
  // what the site shows with nothing set: EA's crest and the colours worked out from EA's kit
  const ea = clubTheme(club);
  const players = members
    .filter((m) => m.games > 0)
    .map((m) => {
      const s = settings.players[m.gamertag] ?? {};
      return {
        gamertag: m.gamertag,
        nickname: s.nickname ?? "",
        bio: s.bio ?? "",
        position: s.position ?? "",
        role: s.role ?? "",
        photo: s.photo ?? "",
        eaPosition: m.eaPosition,
      };
    });

  return (
    <main className="bands">
      <section className="band band-club board-head">
        <div className="wrap" style={{ gap: 14 }}>
          <h1 className="display">Settings</h1>
          <p className="text-2" style={{ margin: 0, fontSize: 17, maxWidth: "70ch" }}>
            How {club.name} looks and how the site counts. Anyone can read this page; saving needs the club password.
          </p>
          <nav className="row" aria-label="Settings sections" style={{ gap: 8 }}>
            {[["club", "Club"], ["look", "Look"], ["players", "Players"], ["seasons", "Seasons"], ["league", "League rules"], ["bot", "Telegram bot"]].map(([id, label]) => (
              <a key={id} className="pill" href={`#${id}`}>{label}</a>
            ))}
          </nav>
        </div>
      </section>
      <section className="band section-light">
        <div className="wrap" style={{ gap: 24 }}>
          <SettingsForms
            editingOn={Boolean(CLUB_PASSWORD)}
            clubName={club.name}
            tagline={settings.tagline ?? ""}
            look={settings.look}
            defaults={{ crest: crestUrl(club.crestAssetId), club: ea.club, accent: ea.accent }}
            players={players}
            seasons={settings.seasons}
            league={settings.league}
          />
          <div id="bot" className="settings-form">
            <h2 className="display">Telegram bot</h2>
            <p className="text-2" style={{ margin: 0, maxWidth: "70ch" }}>
              {TELEGRAM_TOKEN
                ? "The bot's token is set. Press Connect once (and again if the site's address changes) so Telegram sends the bot's messages here. Then players can /iam their gamertag, /rr their rating after a CPU game and send screenshots."
                : "No bot yet: make one with @BotFather in Telegram, add its token as TELEGRAM_TOKEN in this site's Vercel environment variables, redeploy, then come back and press Connect."}
            </p>
            {TELEGRAM_TOKEN ? <ConnectBotForm /> : null}
          </div>
          <p className="muted small" style={{ margin: 0, maxWidth: "75ch" }}>
            Saved settings are stored in the database and win over config/settings.json, which stays as the starting values. The Discord
            webhook, the Telegram bot and the club password itself are set in Vercel&apos;s environment variables.
          </p>
        </div>
      </section>
    </main>
  );
}
