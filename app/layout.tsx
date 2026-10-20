import type { Metadata } from "next";
import { Anybody, Gloock, Hanken_Grotesk } from "next/font/google";
import "./globals.css";
import { Nav } from "@/components/Nav";
import { LiveBadge } from "@/components/LiveBadge";
import { getClub, lastPoll, savedMatchCount } from "@/lib/stats";
import { crestUrl } from "@/lib/ea-assets";
import { clubTheme } from "@/lib/club-theme";

export const dynamic = "force-dynamic";
// a page that can't finish should fail quickly, not hang for minutes
export const maxDuration = 20;

// display: heavy and wide, uppercase (see .display in globals.css)
const display = Anybody({ subsets: ["latin"], axes: ["wdth"], variable: "--font-display" });
const body = Hanken_Grotesk({ subsets: ["latin", "latin-ext"], variable: "--font-body" });
// one emphasised word at a time, never a heading or a paragraph; not preloaded until a page uses .serif
const accent = Gloock({ subsets: ["latin"], weight: "400", variable: "--font-accent", preload: false });

export async function generateMetadata(): Promise<Metadata> {
  const club = await getClub();
  return {
    title: { default: `${club.name} · Clubs stats`, template: `%s · ${club.name}` },
    description: `Live EA FC Clubs stats for ${club.name}.`,
    icons: club.crestAssetId ? { icon: crestUrl(club.crestAssetId) } : undefined,
  };
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const [club, poll, saved] = await Promise.all([getClub(), lastPoll(), savedMatchCount()]);
  const theme = clubTheme(club);
  const vars = {
    "--accent": theme.accent,
    "--on-accent": theme.onAccent,
    "--accent-light": theme.accentLight,
    "--club": theme.club,
    "--on-club": theme.onClub,
    "--win": theme.win,
    "--on-win": theme.onWin,
  } as React.CSSProperties;
  return (
    <html lang="en" className={`${display.variable} ${body.variable} ${accent.variable}`} style={vars}>
      <body>
        <header className="site-header">
          <div className="wrap">
            <a className="brand" href="/">
              <img src={crestUrl(club.crestAssetId)} alt="" width={36} height={36} style={{ objectFit: "contain" }} />
              <span className="display">{club.name}</span>
            </a>
            <LiveBadge lastCheck={poll?.at ?? null} matchCount={saved.count} />
            <Nav />
          </div>
        </header>
        {children}
        <footer className="site-footer">
          <div className="wrap">
            <span className="display">FC Clubs Tracker</span>
            <span>Stats, crests and flags from EA&apos;s Clubs data, checked every 2 minutes while you play. Fan site, not affiliated with EA.</span>
          </div>
        </footer>
      </body>
    </html>
  );
}
