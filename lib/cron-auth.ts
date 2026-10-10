import { NextResponse } from "next/server";
import { CRON_SECRET } from "./config";

/** Returns an error response unless the request carries `Authorization: Bearer <CRON_SECRET>`. */
export function checkCronAuth(req: Request): NextResponse | null {
  const expected = CRON_SECRET.trim();
  if (!expected) {
    return NextResponse.json(
      { error: "CRON_SECRET is not set on the server. Add it in Vercel → Settings → Environment Variables and redeploy." },
      { status: 503 },
    );
  }
  const given = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  if (given !== expected) {
    return NextResponse.json(
      { error: given ? "CRON_SECRET does not match the one set in Vercel." : "Missing Authorization header." },
      { status: 401 },
    );
  }
  return null;
}
