/**
 * Stats decoded from EA's hidden event counters (match_event_aggregate_0..3), each the sum of
 * one or more counter ids. Like the goal counter, they count only the human's own actions.
 * Mappings from github.com/Interactive-63/eafc-pro-clubs-api-research (51,395 player lines);
 * see docs/ea-data.json.
 */
export type CounterStat = {
  key: string;
  label: string;
  /** short column header */
  short: string;
  ids: number[];
  /** the research says totals look low next to the in-game screen */
  rough?: boolean;
};

export const COUNTER_STATS: CounterStat[] = [
  { key: "interceptions", label: "Interceptions", short: "Int", ids: [6] },
  { key: "secondAssists", label: "Second assists", short: "2nd A", ids: [115] },
  { key: "throughPasses", label: "Through passes", short: "Thru", ids: [152] },
  { key: "dribbles", label: "Dribbles", short: "Drib", ids: [174] },
  { key: "aerials", label: "Aerial duels won", short: "Air", ids: [265, 266] },
  { key: "possessionWon", label: "Possession won", short: "Won", ids: [108, 109, 110], rough: true },
  { key: "possessionLost", label: "Possession lost", short: "Lost", ids: [105, 106, 107], rough: true },
  { key: "fouls", label: "Fouls", short: "Fouls", ids: [2, 3], rough: true },
  { key: "yellows", label: "Yellow cards", short: "YC", ids: [95, 213] },
];

export type Counters = Record<string, number>;

export function counterStat(counters: Counters | null | undefined, stat: CounterStat): number {
  if (!counters) return 0;
  return stat.ids.reduce((s, id) => s + Number(counters[String(id)] ?? 0), 0);
}
