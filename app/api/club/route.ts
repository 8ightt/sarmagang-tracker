import { NextResponse } from "next/server";
import { clubId, loadSettings, platform, refreshSettings } from "@/lib/config";

export const dynamic = "force-dynamic";

/** The club this site follows, for the regular EA check (scripts/fetch-ea.py). Public: it's on every page anyway. */
export async function GET() {
  await refreshSettings();
  return NextResponse.json({ id: clubId() || null, platform: platform(), name: loadSettings().club?.name ?? null });
}
