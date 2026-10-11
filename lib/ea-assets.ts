const CONTENT = "https://eafc24.content.easports.com/fifa/fltOnlineAssets/24B23FDE-7835-41C2-87A2-F453DFDB2E82/2024";
const MEDIA = "https://media.contentapi.ea.com/content/dam/eacom/fc/pro-clubs";

export const crestUrl = (crestAssetId?: string | number | null) =>
  crestAssetId ? `${CONTENT}/fcweb/crests/256x256/l${crestAssetId}.png` : `${MEDIA}/notfound-crest.png`;

export const flagUrl = (nationId?: string | number | null) =>
  nationId ? `${CONTENT}/fut/items/images/mobile/flags/card/${nationId}.png` : "";

export const reputationUrl = (tier?: string | number | null) =>
  `${MEDIA}/reputation-tier${Math.max(0, Math.min(3, Number(tier ?? 0)))}.png`;

/** Club reputation tiers, lowest first (EA's reputationtier 0-3). Only names seen in-game are filled in. */
export const REPUTATION_TIERS: (string | null)[] = ["Hometown Heroes", null, null, null];
export const reputationName = (tier: number) => REPUTATION_TIERS[tier] ?? `Tier ${tier + 1}`;

export const DEFAULT_MEMBER_IMG = `${MEDIA}/default-member.png`;

/** EA's standard position numbering (the member stats `proPos` field). */
const POSITIONS = [
  "GK", "SW", "RWB", "RB", "RCB", "CB", "LCB", "LB", "LWB", "RDM", "CDM", "LDM", "RM", "RCM",
  "CM", "LCM", "LM", "RAM", "CAM", "LAM", "RF", "CF", "LF", "RW", "RS", "ST", "LS", "LW",
];
export const positionName = (proPos?: string | number | null) => {
  const n = Number(proPos);
  return Number.isFinite(n) && POSITIONS[n] ? POSITIONS[n] : "";
};

/** FC 27 archetypes by EA's `archetypeid` (from frdceri/clubs-hub, confirmed by the club). */
const ARCHETYPES = [
  "", "Shot Stopper", "Sweeper Keeper", "Progressor", "Boss", "Marauder", "Disruptor",
  "Recycler", "Maestro", "Creator", "Spark", "Magician", "Finisher", "Target",
];
export const archetypeName = (id?: number | null) => (id && ARCHETYPES[id]) || (id ? `Archetype ${id}` : "Unknown");

/** Broad group EA records per match. */
export const groupShort = (pos?: string) =>
  ({ goalkeeper: "GK", defender: "DEF", midfielder: "MID", forward: "FWD" } as Record<string, string>)[pos ?? ""] ?? "";

/** EA colour ints -> CSS hex. */
export const eaColor = (n?: string | number | null) =>
  n === undefined || n === null || n === "" ? "#333333" : "#" + Number(n).toString(16).padStart(6, "0");
