"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

const REFRESH_MS = 30_000;

function ago(ms: number | null, now: number) {
  if (!ms) return "waiting for first check";
  const s = Math.max(0, Math.round((now - ms) / 1000));
  if (s < 60) return "updated just now";
  const m = Math.round(s / 60);
  if (m < 60) return `updated ${m} min ago`;
  const h = Math.round(m / 60);
  return h < 48 ? `updated ${h} h ago` : `updated ${Math.round(h / 24)} days ago`;
}

/**
 * Keeps the open page fresh: re-renders it from the server every 30 s while the tab
 * is visible, and flashes when a new match has been saved since the last refresh.
 */
export function LiveBadge({ lastCheck, matchCount }: { lastCheck: number | null; matchCount: number }) {
  const router = useRouter();
  const [now, setNow] = useState(() => Date.now());
  const [flash, setFlash] = useState(false);
  const seen = useRef(matchCount);

  useEffect(() => {
    const tick = setInterval(() => setNow(Date.now()), 15_000);
    const refresh = setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, REFRESH_MS);
    const onVisible = () => document.visibilityState === "visible" && router.refresh();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(tick);
      clearInterval(refresh);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [router]);

  useEffect(() => {
    if (matchCount > seen.current) {
      setFlash(true);
      const t = setTimeout(() => setFlash(false), 8000);
      seen.current = matchCount;
      return () => clearTimeout(t);
    }
    seen.current = matchCount;
  }, [matchCount]);

  const fresh = lastCheck !== null && now - lastCheck < 15 * 60_000;
  return (
    <span className={`live-badge${flash ? " live-badge--flash" : ""}`} role="status" aria-live="polite">
      <span className={`live-dot${fresh ? "" : " live-dot--idle"}`} aria-hidden="true" />
      {flash ? "New result" : fresh ? "Live" : "Idle"}
      <span className="live-ago">· {ago(lastCheck, now)}</span>
    </span>
  );
}
