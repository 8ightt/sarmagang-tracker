import { crestUrl, eaColor, flagUrl } from "@/lib/ea-assets";
import { TIMEZONE } from "@/lib/config";

export function Flag({ nation, size = 24 }: { nation?: string; size?: number }) {
  if (!nation) return null;
  return <img className="flag" src={flagUrl(nation)} alt="" width={size} height={Math.round(size * 0.6)} style={{ width: size, height: Math.round(size * 0.6) }} />;
}

/** A club crest from EA by asset id, or from `src` (our own crest, which may be an upload). */
export function Crest({ id, src, size = 30, alt = "" }: { id?: string | null; src?: string; size?: number; alt?: string }) {
  return <img src={src ?? crestUrl(id)} alt={alt} width={size} height={size} style={{ width: size, height: size, objectFit: "contain" }} />;
}

export function ResultBadge({ r }: { r: "W" | "D" | "L" }) {
  return (
    <span className={`badge badge-${r}`} aria-label={{ W: "Win", D: "Draw", L: "Loss" }[r]}>
      {r}
    </span>
  );
}

export function when(ts: number) {
  return new Date(ts * 1000).toLocaleString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: TIMEZONE,
  });
}

export function ago(ms: number | null | undefined) {
  if (!ms) return "never";
  const m = Math.round((Date.now() - ms) / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  return h < 48 ? `${h} h ago` : `${Math.round(h / 24)} days ago`;
}

/** Simple shirt drawn from EA's kit colours (EA doesn't publish kit images). */
export function KitShirt({ colors, size = 150 }: { colors: number[]; size?: number }) {
  const [body, trim, sleeve] = [eaColor(colors[0]), eaColor(colors[1]), eaColor(colors[2] ?? colors[1])];
  return (
    <svg viewBox="0 0 120 120" width={size} height={size} aria-hidden="true">
      <path d="M38 14 L22 20 L4 40 L18 56 L28 48 L28 110 L92 110 L92 48 L102 56 L116 40 L98 20 L82 14 C78 22 70 26 60 26 C50 26 42 22 38 14 Z" fill={body} stroke={trim} strokeWidth={2} />
      <path d="M4 40 L18 56 L28 48 L28 40 L12 30 Z" fill={sleeve} />
      <path d="M116 40 L102 56 L92 48 L92 40 L108 30 Z" fill={sleeve} />
      <path d="M38 14 C42 22 50 26 60 26 C70 26 78 22 82 14 L76 12 C72 18 66 20 60 20 C54 20 48 18 44 12 Z" fill={trim} />
      <rect x="28" y="100" width="64" height="10" fill={trim} />
    </svg>
  );
}

export function PosLabel({ position, role }: { position: string; role?: string }) {
  return (
    <span className="accent" style={{ fontWeight: 800, letterSpacing: "0.04em" }}>
      {position || "—"}
      {role ? <span className="muted" style={{ fontWeight: 600 }}> · {role}</span> : null}
    </span>
  );
}

const EST_NOTE =
  "Estimated from this player's own stats: EA averages the CPU teammates' ratings into theirs. Send the in-game rating to the bot (/rr) or use Fix stats to replace it.";

/**
 * A match rating. On a +CPU line without a fix EA's (averaged with the CPU's) isn't the player's:
 * the estimate is shown as "≈ 6.9 est.", or "–" without one, with EA's small.
 */
export function Rating({ rating, ea, est }: { rating: number | null; ea?: number | null; est?: number | null }) {
  if (rating !== null && rating !== undefined) return <>{Number(rating).toFixed(1)}</>;
  if (est !== null && est !== undefined)
    return (
      <span title={`${EST_NOTE}${ea ? ` EA's figure incl. CPU: ${Number(ea).toFixed(1)}.` : ""}`}>
        ≈ {Number(est).toFixed(1)}<span className="muted" style={{ fontSize: 12, fontWeight: 400 }}> est.</span>
      </span>
    );
  return (
    <span className="muted" title="EA averages the CPU teammates' ratings into this player's. Fix stats can enter the in-game RR.">
      –{ea ? <span style={{ fontSize: 12, fontWeight: 400 }}> EA {Number(ea).toFixed(1)} incl. CPU</span> : null}
    </span>
  );
}
