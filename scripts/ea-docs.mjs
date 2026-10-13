// Turns docs/ea-data.json into docs/ea-api.md, a readable map of every field EA's API sends.
//
//   node scripts/ea-docs.mjs            write docs/ea-api.md
//   node scripts/ea-docs.mjs <folder>   also list fields in saved EA responses that the doc misses
//
// The folder holds raw responses named after each endpoint's "sample" (matches-league.json,
// info.json, overall.json, search.json, leaderboard.json, members.json, career.json).
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const root = new URL("..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const doc = JSON.parse(readFileSync(join(root, "docs/ea-data.json"), "utf8"));

/** "kitColor1-4, kitId" → ["kitColor1", "kitColor2", "kitColor3", "kitColor4", "kitId"] */
function expand(key) {
  return key.split(",").flatMap((part) => {
    const name = part.trim();
    const m = name.match(/^(.*?)(\d+)-(\d+)(.*)$/);
    if (!m) return [name];
    const out = [];
    for (let i = Number(m[2]); i <= Number(m[3]); i++) out.push(`${m[1]}${i}${m[4]}`);
    return out;
  });
}

const esc = (s) => String(s).replace(/\|/g, "\\|").replace(/\n/g, " ");
const STATUS = { verified: "✅ verified", assumed: "🟡 assumed", unknown: "❓ unknown", useless: "⛔ useless", doubtful: "🟠 doubtful", wrong: "❌ wrong" };

function explain(f) {
  const parts = [f.meaning ?? ""];
  if (f.codes) parts.push(`Codes: ${Object.entries(f.codes).map(([k, v]) => `\`${k}\` ${v}`).join(", ")}.`);
  for (const k of ["note", "evidence", "confirmed", "source"]) if (f[k]) parts.push(`*${k[0].toUpperCase()}${k.slice(1)}:* ${f[k]}`);
  return esc(parts.filter(Boolean).join(" "));
}

const lines = [
  "# EA Pro Clubs API: every field",
  "",
  "<!-- generated from docs/ea-data.json by scripts/ea-docs.mjs; edit the JSON, not this file -->",
  "",
  `Everything EA's Pro Clubs API sends, what it means, how sure we are, and where the site uses it. Last checked ${doc.updated}.`,
  "",
  `- **Base URL:** \`${doc.api.base}\`, no login. ${doc.api.platform[0].toUpperCase()}${doc.api.platform.slice(1)}.`,
  `- **Bot filter:** ${doc.api.botFilter}.`,
  `- **Caching:** ${doc.api.caching}.`,
  `- **Values:** ${doc.api.values}.`,
  `- **Not available:** ${doc.api.notAvailable.join("; ")}.`,
  `- **Endpoints that don't exist:** ${doc.api.notFound}.`,
  "",
  "**How sure:** " + Object.entries(doc.status).map(([k, v]) => `${STATUS[k]}: ${v}`).join(" · "),
  "",
  "## Endpoints",
  "",
  ...Object.entries(doc.endpoints).map(([path, e]) => `- [\`${path}\`](#${path.toLowerCase().replace(/[^a-z0-9]+/g, "")}): ${e.about.split(". ")[0].replace(/\.$/, "")}.`),
  "",
];

for (const [path, e] of Object.entries(doc.endpoints)) {
    const query = e.query.startsWith("(") ? "" : `&${e.query.split(" (")[0]}`;
  const note = e.query.includes(" (") ? ` (${e.query.split(" (")[1]}` : "";
  lines.push(`## ${path}`, "", `\`GET ${doc.api.base}/${path}?platform=common-gen5${query}\`${note}`, "", e.about, "");
  for (const s of e.sections) {
    lines.push(`### ${s.title}`, "", `Path: \`${s.path}\`${s.about ? `. ${s.about}` : ""}`, "");
    lines.push("| Field | How sure | What it is | Used on the site |", "|---|---|---|---|");
    for (const [key, f] of Object.entries(s.fields)) {
      const name = key === "*" ? "*every field*" : key.split(",").map((k) => `\`${k.trim()}\``).join(", ");
      lines.push(`| ${name} | ${STATUS[f.status] ?? f.status} | ${explain(f)} | ${esc(f.usedFor ?? "")} |`);
    }
    lines.push("");
  }
}

const c = doc.matchEventCounters;
lines.push(
  "## Hidden event counters",
  "",
  `\`match_event_aggregate_0\` to \`_3\` on each player line. ${c.format}. ${c.distinctIdsSeen} different ids seen so far.`,
  "",
  c.keyFinding,
  "",
  "| Counter | How sure | What it counts | Evidence | Used for |",
  "|---|---|---|---|---|",
  ...Object.entries(c.decoded).map(([id, f]) => `| \`${id}\` | ${STATUS[f.status]} | ${esc(f.meaning)} | ${esc(f.evidence)}${f.screen ? `. In game: ${esc(f.screen)}` : ""} | ${esc(f.usedIn)} |`),
  "",
  "### From the EA FC Pro Clubs API research project",
  "",
  c.fromResearch.about,
  "",
  "| Counter | How sure | What it counts | Used for |",
  "|---|---|---|---|",
  ...Object.entries(c.fromResearch)
    .filter(([id]) => id !== "about")
    .map(([id, f]) => `| \`${id}\` | ${STATUS[f.status]} | ${esc(f.meaning)}${f.note ? ` *Note:* ${esc(f.note)}` : ""}${f.screen ? ` *In game:* ${esc(f.screen)}` : ""} | ${esc(f.usedIn ?? "")} |`),
  "",
  "Guesses not proven yet:",
  "",
  ...Object.entries(c.candidates).map(([id, f]) => `- \`${id}\`: ${f.guess} (${f.evidence})`),
  "",
  `Not decoded yet: ${c.notYetDecoded}`,
  "",
  "Derived:",
  "",
  ...Object.entries(c.derived).map(([k, v]) => `- **${k}**: ${v}.`),
  "",
  "## Thanks",
  "",
  ...doc.thanks.map((t) => `- [${t.project}](${t.url}) (\`${t.file}\`): ${t.usedFor}. ${t.thanks}`),
  "",
);

writeFileSync(join(root, "docs/ea-api.md"), lines.join("\n"));
console.log("wrote docs/ea-api.md");

// coverage: every field in the saved responses should be documented
const dir = process.argv[2];
if (dir) {
  const norm = (k) => (/^\d{4,}$/.test(k) ? "{id}" : k);
  const walk = (o, p, out) => {
    if (Array.isArray(o)) for (const v of o) walk(v, `${p}[]`, out);
    else if (o && typeof o === "object") for (const [k, v] of Object.entries(o)) walk(v, p ? `${p}.${norm(k)}` : norm(k), out);
    else out.add(p);
    return out;
  };
  let missing = 0;
  for (const [path, e] of Object.entries(doc.endpoints)) {
    const file = join(dir, `${e.sample}.json`);
    if (!existsSync(file)) {
      console.log(`${path}: no ${e.sample}.json in ${dir}, skipped`);
      continue;
    }
    const seen = walk(JSON.parse(readFileSync(file, "utf8")), "", new Set());
    const known = new Set();
    const wild = [];
    for (const s of e.sections)
      for (const key of Object.keys(s.fields)) {
        if (key === "*") wild.push(`${s.path}.`);
        else for (const name of expand(key)) known.add(`${s.path}.${name}`);
      }
    const gaps = [...seen].filter((p) => !known.has(p) && !wild.some((w) => p.startsWith(w)));
    missing += gaps.length;
    console.log(`${path}: ${seen.size} fields, ${gaps.length} undocumented${gaps.length ? `\n  ${gaps.join("\n  ")}` : ""}`);
  }
  process.exitCode = missing ? 1 : 0;
}
