import { crestUrl, eaColor, flagUrl } from "@/lib/ea-assets";
import { TIMEZONE } from "@/lib/config";

export function Flag({ nation, size = 24 }: { nation?: string; size?: number }) {
  if (!nation) return null;
  return <img className="flag" src={flagUrl(nation)} alt="" width={size} height={Math.round(size * 0.6)} style={{ width: size, height: Math.round(size * 0.6) }} />;
}

export function Crest({ id, size = 30, alt = "" }: { id?: string | null; size?: number; alt?: string }) {
  return <img src={crestUrl(id)} alt={alt} width={size} height={size} style={{ width: size, height: size, objectFit: "contain" }} />;
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
