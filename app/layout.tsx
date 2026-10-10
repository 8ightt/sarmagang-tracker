import type { Metadata } from "next";
import "./globals.css";
import { Nav } from "@/components/Nav";
import { getClub } from "@/lib/stats";
import { crestUrl } from "@/lib/ea-assets";

export const dynamic = "force-dynamic";
// a page that can't finish should fail quickly, not hang for minutes
export const maxDuration = 20;

export async function generateMetadata(): Promise<Metadata> {
  const club = await getClub();
  return {
    title: { default: `${club.name} · Clubs stats`, template: `%s · ${club.name}` },
    description: `Live EA FC Clubs stats for ${club.name}.`,
    icons: club.crestAssetId ? { icon: crestUrl(club.crestAssetId) } : undefined,
  };
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const club = await getClub();
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@100..125,400..900&display=swap"
        />
      </head>
      <body>
        <header className="site-header">
          <div className="wrap">
            <a className="brand" href="/">
              <img src={crestUrl(club.crestAssetId)} alt="" width={36} height={36} style={{ objectFit: "contain" }} />
              <span className="display">{club.name}</span>
            </a>
            <Nav />
          </div>
        </header>
        {children}
      </body>
    </html>
  );
}
