import type { LookSettings } from "./config";
import type { Club } from "./stats";

/** The page ground the accent has to read on (keep in step with --bg in app/globals.css). */
const GROUND = "#121313";
/** WCAG AA for body text: the accent is used for links, tab underlines and small labels. */
const MIN_CONTRAST = 4.5;

type Rgb = [number, number, number];

const toRgb = (n: number): Rgb => [(n >> 16) & 255, (n >> 8) & 255, n & 255];
const fromHex = (hex: string): Rgb => toRgb(parseInt(hex.slice(1), 16));
const toHex = ([r, g, b]: Rgb) => "#" + [r, g, b].map((v) => Math.round(v).toString(16).padStart(2, "0")).join("");

function luminance([r, g, b]: Rgb) {
  const lin = (v: number) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

export function contrast(a: Rgb, b: Rgb) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** How colourful a colour is (spread between its strongest and weakest channel), 0..1. */
function chroma([r, g, b]: Rgb) {
  return (Math.max(r, g, b) - Math.min(r, g, b)) / 255;
}

function toHsl([r, g, b]: Rgb): [number, number, number] {
  const [rr, gg, bb] = [r / 255, g / 255, b / 255];
  const max = Math.max(rr, gg, bb), min = Math.min(rr, gg, bb), l = (max + min) / 2, d = max - min;
  if (!d) return [0, 0, l];
  const s = d / (1 - Math.abs(2 * l - 1));
  const h = max === rr ? ((gg - bb) / d) % 6 : max === gg ? (bb - rr) / d + 2 : (rr - gg) / d + 4;
  return [(h * 60 + 360) % 360, s, l];
}

function fromHsl([h, s, l]: [number, number, number]): Rgb {
  const c = (1 - Math.abs(2 * l - 1)) * s, x = c * (1 - Math.abs(((h / 60) % 2) - 1)), m = l - c / 2;
  const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  return [(r + m) * 255, (g + m) * 255, (b + m) * 255];
}

/** Raises a colour's lightness, keeping its hue and saturation, until it reads on the ground. */
function lift(c: Rgb, ground: Rgb): Rgb {
  const [h, s, l] = toHsl(c);
  for (let ll = l; ll <= 1; ll += 0.02) {
    const m = fromHsl([h, s, ll]);
    if (contrast(m, ground) >= MIN_CONTRAST) return m;
  }
  return [255, 255, 255];
}

/** Lowers a colour's lightness until it reads on a light ground (the light page bands). */
function sink(c: Rgb, ground: Rgb): Rgb {
  const [h, s, l] = toHsl(c);
  for (let ll = l; ll >= 0; ll -= 0.02) {
    const m = fromHsl([h, s, ll]);
    if (contrast(m, ground) >= MIN_CONTRAST) return m;
  }
  return [0, 0, 0];
}

/** The light band's ground (keep in step with --paper in app/globals.css). */
const PAPER = "#f4f4f1";

export type ClubTheme = { accent: string; onAccent: string; accentLight: string; club: string; onClub: string; win: string; onWin: string };

/** Reds read as losses next to the maroon L badge; a red club's wins get a neutral fill instead. */
const isRed = (c: Rgb) => {
  const [h, s] = toHsl(c);
  return s > 0.25 && (h < 25 || h > 335);
};

/** Black or white, whichever reads better on `c`. */
const inkOn = (c: Rgb) => (contrast(c, [255, 255, 255]) >= contrast(c, [0, 0, 0]) ? "#ffffff" : "#0b0c0c");

/**
 * The club's colours as site tokens. The accent is the most colourful of the crest colour and
 * the home-kit colours that reads on the dark ground (the most colourful one lightened if none
 * does), so every club gets a legible accent whatever it picked; the club colour is the shirt
 * body, used for fills. Colours the club set on /settings (look) win over EA's; an accent that
 * doesn't read on the ground is still lightened until it does.
 */
export function clubTheme(club: Pick<Club, "kits" | "crestColor">, look: LookSettings = {}): ClubTheme {
  const ground = fromHex(GROUND);
  const valid = (n: number | undefined): n is number => Number.isFinite(n) && (n as number) > 0;
  const hex = (v?: string) => (v && /^#[0-9a-f]{6}$/i.test(v) ? fromHex(v) : null);
  const kitHome = (club.kits.find((k) => k.name === "Home")?.colors ?? []).filter(valid).map(toRgb);
  const home = hex(look.club) ? [hex(look.club)!, ...kitHome] : kitHome;
  const candidates = hex(look.accent) ? [hex(look.accent)!] : [...(valid(club.crestColor) ? [toRgb(club.crestColor)] : []), ...home];
  if (!candidates.length)
    return { accent: "#e8e8e3", onAccent: "#0b0c0c", accentLight: "#2a2c2c", club: "#2a2c2c", onClub: "#ffffff", win: "#e8e8e3", onWin: "#0b0c0c" };

  const byColour = (a: Rgb, b: Rgb) => chroma(b) - chroma(a);
  const readable = candidates.filter((c) => contrast(c, ground) >= MIN_CONTRAST && chroma(c) > 0.08);
  const accent = readable.length ? readable.sort(byColour)[0] : lift([...candidates].sort(byColour)[0], ground);
  const body = home[0] ?? candidates[0];
  const win: Rgb = isRed(accent) ? [244, 244, 241] : accent;
  return {
    accent: toHex(accent),
    onAccent: inkOn(accent),
    accentLight: toHex(sink(accent, fromHex(PAPER))),
    club: toHex(body),
    onClub: inkOn(body),
    win: toHex(win),
    onWin: inkOn(win),
  };
}
