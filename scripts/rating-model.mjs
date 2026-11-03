// Trains the rating estimate for +CPU lines (lib/rating-model.ts) and fills it in.
//
//   node --experimental-strip-types --env-file=.env.local scripts/rating-model.mjs <eafc_27_raw_player_data.csv>
//     learns from the research dataset's human-only lines (github.com/Interactive-63/eafc-pro-clubs-api-research,
//     data/eafc_27_raw_player_data.csv), tunes the result on our own games without the CPU, and rewrites the
//     generated block in lib/rating-model.ts. Add --also <env file> to tune on another club's games too
//     (e.g. --also .env.afcdws.local).
//   node --experimental-strip-types --env-file=.env.local scripts/rating-model.mjs --backfill
//     writes the estimate into match_players.rating_est for every +CPU line (needs migration 0017).
import fs from "node:fs";
import path from "node:path";
import { parseEnv } from "node:util";
import postgres from "postgres";
import { RATING_MODEL, estimateRating, ratingFeatures } from "../lib/rating-model.ts";

const MODEL_FILE = path.join(import.meta.dirname, "..", "lib", "rating-model.ts");
const MIN_SECONDS = 1800; // lines shorter than half a game rate oddly
const LAMBDA = 5;

const db = postgres(process.env.DATABASE_URL, { prepare: false, max: 1 });
const alsoAt = process.argv.indexOf("--also");
const others = alsoAt > 0
  ? [postgres(parseEnv(fs.readFileSync(process.argv[alsoAt + 1], "utf8")).DATABASE_URL, { prepare: false, max: 1 })]
  : [];
const n = (v) => (v === undefined || v === null || v === "" ? 0 : Number(v));

/** Our saved player lines from matches.raw, with whether the line ran the CPU and its in-game rating if entered. */
async function ourLines(from = db) {
  const matches = await from`select id::text, opp_id, raw from matches`;
  const cpu = new Set((await from`select match_id::text || '|' || player as k from match_players where controls_cpu`).map((r) => r.k));
  const fixed = new Map((await from`select match_id::text || '|' || player as k, rating from match_player_fixes where rating is not null`).map((r) => [r.k, Number(r.rating)]));
  return matches.flatMap((m) => {
    const key = Object.keys(m.raw.players ?? {}).find((k) => k !== m.opp_id);
    return Object.values(m.raw.players?.[key] ?? {}).map((p) => {
      const k = `${m.id}|${p.playername}`;
      return { matchId: m.id, line: p, cpu: cpu.has(k), ingame: fixed.get(k) ?? null };
    });
  });
}

/** Ridge regression: weights for y ≈ X·w, the first column (the constant) not shrunk. */
function ridge(X, y, lambda) {
  const d = X[0].length;
  const A = Array.from({ length: d }, () => new Float64Array(d + 1));
  for (let k = 0; k < X.length; k++) {
    const x = X[k];
    const nz = [];
    for (let i = 0; i < d; i++) if (x[i]) nz.push(i);
    for (const i of nz) {
      A[i][d] += x[i] * y[k];
      for (const j of nz) A[i][j] += x[i] * x[j];
    }
  }
  for (let i = 1; i < d; i++) A[i][i] += lambda;
  for (let c = 0; c < d; c++) {
    let p = c;
    for (let r = c + 1; r < d; r++) if (Math.abs(A[r][c]) > Math.abs(A[p][c])) p = r;
    [A[c], A[p]] = [A[p], A[c]];
    const v = A[c][c] || 1e-9;
    for (let r = 0; r < d; r++) {
      if (r === c || !A[r][c]) continue;
      const f = A[r][c] / v;
      for (let k = c; k <= d; k++) A[r][k] -= f * A[c][k];
    }
  }
  return A.map((row, i) => row[d] / (row[i] || 1e-9));
}

async function train(csvPath) {
  const text = fs.readFileSync(csvPath, "utf8").split(/\r?\n/).filter(Boolean);
  const head = text[0].split(",");
  const col = Object.fromEntries(head.map((h, i) => [h, i]));
  const counterIds = head.filter((h) => /^event_\d+$/.test(h)).map((h) => Number(h.slice(6)));
  const rows = text.slice(1).map((l) => l.split(","));
  const get = (r) => (k) => n(r[col[k]]);
  const cnt = (r) => (id) => n(r[col[`event_${id}`]]);
  // human-only lines: EA's headline numbers equal the player's own counters, so nobody's CPU is in them
  const human = rows.filter((r) => {
    const h = get(r);
    return h("secondsPlayed") >= MIN_SECONDS && h("userResult") !== 6 && h("rating") > 0 &&
      h("goals") === h("event_214") && h("assists") === h("event_11") && h("shots") === h("event_217") + h("event_218") &&
      Math.abs(h("passesmade") - (h("event_215") + h("event_153"))) <= 2 && h("tacklesmade") === h("event_164");
  });
  const feats = (r) => ratingFeatures(get(r), cnt(r), r[col.pos], counterIds, false);
  const names = Object.keys(feats(human[0]));
  const X = human.map((r) => { const f = feats(r); return names.map((k) => f[k]); });
  const y = human.map((r) => n(r[col.rating]));

  // check on games it didn't see (every 5th match), then learn from all
  const test = human.map((r) => Number(r[col.matchId].slice(-3)) % 5 === 0);
  const wTest = ridge(X.filter((_, i) => !test[i]), y.filter((_, i) => !test[i]), LAMBDA);
  const errs = X.flatMap((x, i) => (test[i] ? [Math.abs(Math.min(10, Math.max(3, x.reduce((s, v, j) => s + v * wTest[j], 0))) - y[i])] : []));
  console.log(`research: ${human.length} human-only lines; on unseen games MAE ${(errs.reduce((a, b) => a + b, 0) / errs.length).toFixed(2)}, ${Math.round((100 * errs.filter((e) => e <= 0.5).length) / errs.length)}% within 0.5`);
  const w = ridge(X, y, LAMBDA);
  const weights = Object.fromEntries(names.map((k, i) => [k, Math.round(w[i] * 1e5) / 1e5]).filter(([, v]) => v !== 0));

  // tune on our own games: rating ≈ a + b · model (+ cpu on a +CPU line). Without the CPU EA's rating is
  // the player's own; with it only the in-game ratings entered (/rr, Fix stats, screenshots) count
  const raw = (line, cpu) => {
    const c = new Map();
    for (const i of [0, 1, 2, 3]) for (const part of String(line[`match_event_aggregate_${i}`] ?? "").split(",")) {
      const [id, v] = part.split(":");
      if (id && Number.isFinite(Number(v))) c.set(id, (c.get(id) ?? 0) + Number(v));
    }
    const f = ratingFeatures((k) => n(line[k]), (id) => c.get(id) ?? 0, String(line.pos ?? ""), counterIds, cpu);
    return Math.min(10, Math.max(3, Object.entries(weights).reduce((s, [k, v]) => s + v * (f[k] ?? 0), 0)));
  };
  const all = (await Promise.all([db, ...others].map((d) => ourLines(d)))).flat()
    .filter((l) => n(l.line.secondsPlayed) >= MIN_SECONDS && n(l.line.userResult) !== 6 && n(l.line.rating) > 0);
  const ours = [
    ...all.filter((l) => !l.cpu).map((l) => ({ x: raw(l.line, false), cpu: 0, y: n(l.line.rating) })),
    ...all.filter((l) => l.cpu && l.ingame !== null).map((l) => ({ x: raw(l.line, true), cpu: 1, y: l.ingame, name: l.line.playername })),
  ];
  const fit = (set) => ridge(set.map((o) => [1, o.x, o.cpu]), set.map((o) => o.y), 0.1);
  const est = ([a, b, c], o) => Math.round(Math.min(10, Math.max(3, a + b * o.x + c * o.cpu)) * 10) / 10;
  const [a, b, cpu] = fit(ours);
  const mae = (errs) => (errs.reduce((x, y2) => x + y2, 0) / errs.length).toFixed(2);
  const cpuLines = ours.filter((o) => o.cpu);
  console.log(`tuned on ${ours.length} of our lines (${cpuLines.length} +CPU with the in-game rating): a ${a.toFixed(3)}, b ${b.toFixed(3)}, cpu ${cpu.toFixed(3)}`);
  console.log(`  MAE without the CPU ${mae(ours.filter((o) => !o.cpu).map((o) => Math.abs(est([a, b, cpu], o) - o.y)))}`);
  // each +CPU line estimated by a tune that didn't see it
  const loo = cpuLines.map((o) => Math.abs(est(fit(ours.filter((p) => p !== o)), o) - o.y));
  console.log(`  +CPU lines, each left out of its own tune: MAE ${mae(loo)}, max ${Math.max(...loo).toFixed(1)}`);

  const model = {
    trained: new Date().toISOString().slice(0, 10),
    lines: human.length,
    tunedOn: ours.length,
    counterIds,
    weights,
    tune: { a: Math.round(a * 1e4) / 1e4, b: Math.round(b * 1e4) / 1e4, cpu: Math.round(cpu * 1e4) / 1e4 },
  };
  const src = fs.readFileSync(MODEL_FILE, "utf8");
  const start = src.indexOf("// ---- generated by");
  const end = src.indexOf("// ---- end generated ----");
  const block = `// ---- generated by scripts/rating-model.mjs: do not edit by hand ----
export const RATING_MODEL: {
  trained: string;
  lines: number;
  tunedOn: number;
  counterIds: number[];
  weights: Record<string, number> | null;
  tune: { a: number; b: number; cpu?: number };
} = ${JSON.stringify(model, null, 2)};
`;
  fs.writeFileSync(MODEL_FILE, src.slice(0, start) + block + src.slice(end));
  console.log(`wrote ${path.relative(process.cwd(), MODEL_FILE)}: ${Object.keys(weights).length} weights`);
}

async function backfill() {
  if (!RATING_MODEL.weights) throw new Error("No model yet: train it first.");
  const lines = (await ourLines()).filter((l) => l.cpu);
  let set = 0;
  for (const l of lines) {
    const est = estimateRating(l.line, true);
    await db`update match_players set rating_est = ${est} where match_id = ${l.matchId} and player = ${l.line.playername}`;
    if (est !== null) set++;
  }
  console.log(`rating_est on ${set} of ${lines.length} +CPU lines`);
  const check = await db`
    select m.opp_name, f.player, f.rating as ingame, mp.rating_est, mp.rating as ea
    from match_player_fixes f join match_players mp using (match_id, player) join matches m on m.id = f.match_id
    where mp.controls_cpu and f.rating is not null order by m.ts`;
  for (const r of check) console.log(`  ${r.opp_name}: in-game ${r.ingame}, estimate ${r.rating_est}, EA incl. CPU ${r.ea}`);
}

try {
  if (process.argv[2] === "--backfill") await backfill();
  else if (process.argv[2]) await train(process.argv[2]);
  else console.log("usage: scripts/rating-model.mjs <research csv> | --backfill");
} finally {
  await Promise.all([db, ...others].map((d) => d.end()));
}
