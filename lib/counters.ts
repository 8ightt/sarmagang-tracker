/**
 * Stats decoded from EA's hidden event counters (match_event_aggregate_0..3), each the sum of
 * one or more counter ids. Like the goal counter, they count only the human's own actions.
 * Mappings from github.com/Interactive-63/eafc-pro-clubs-api-research (51,395 player lines),
 * checked against in-game Player Performance screens; see docs/ea-data.json.
 */
export type CounterStat = {
  key: string;
  label: string;
  /** short column header */
  short: string;
  ids: number[];
  /** didn't match the in-game screen exactly yet */
  rough?: boolean;
  /** close to the in-game number but not exact; shown as ≈ with this as the tooltip */
  approx?: string;
};

export const COUNTER_STATS: CounterStat[] = [
  { key: "interceptions", label: "Interceptions", short: "Int", ids: [6] },
  { key: "keyPasses", label: "Key passes", short: "Key", ids: [114], approx: "Close to the in-game Key Passes but not exact: 5 of 7 checked lines match, off by one or two on the others" },
  { key: "secondAssists", label: "Second assists", short: "2nd A", ids: [115] },
  { key: "throughPasses", label: "Through passes", short: "Thru", ids: [152], rough: true },
  { key: "dribbles", label: "Dribbles completed", short: "Drib", ids: [174] },
  { key: "aerials", label: "Aerial duels won", short: "Air", ids: [265, 266] },
  { key: "fouls", label: "Fouls", short: "Fouls", ids: [2, 3] },
  { key: "yellows", label: "Yellow cards", short: "YC", ids: [95, 213] },
];

export type Counters = Record<string, number>;

export function counterStat(counters: Counters | null | undefined, stat: CounterStat): number {
  if (!counters) return 0;
  return stat.ids.reduce((s, id) => s + Number(counters[String(id)] ?? 0), 0);
}
