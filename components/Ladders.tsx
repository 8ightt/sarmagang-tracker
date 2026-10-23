import { clubId } from "@/lib/config";
import { REPUTATION_TIERS, divisionCrestUrl, reputationName, reputationUrl } from "@/lib/ea-assets";
import type { TopClub } from "@/lib/poller";
import { Crest } from "./bits";

/** Division 5 up to Elite (0), lowest first. */
const DIVISIONS = [5, 4, 3, 2, 1, 0];

export function DivisionLadder({ current, best, promotions, relegations }: { current: number | null; best: number | null; promotions: number; relegations: number }) {
  const at = current === null ? -1 : DIVISIONS.indexOf(current);
  const fill = at <= 0 ? 0 : (at / (DIVISIONS.length - 1)) * 100;
  return (
    <div className="card stack" style={{ gap: 18 }}>
      <div className="kpi-label">Division</div>
      <div className="ladder" style={{ ["--fill" as string]: fill }}>
        {DIVISIONS.map((d, i) => {
          const state = i === at ? "current" : i < at ? "done" : "ahead";
          return (
            <div key={d} className={`ladder-step ${state}`}>
              <img src={divisionCrestUrl(d)} alt="" width={44} height={44} className="ladder-badge" style={{ objectFit: "contain" }} />
              <span className="ladder-name">
                {d === 0 ? "Elite" : `Div ${d}`}
                {best === d && i !== at ? <em> best</em> : null}
              </span>
            </div>
          );
        })}
      </div>
      <div className="row" style={{ gap: 8 }}>
        <span className="ladder-tag up">↑ Promotions: {promotions}</span>
        <span className="ladder-tag down">↓ Relegations: {relegations}</span>
        {best !== null && best !== current ? <span className="ladder-tag">Best: {best === 0 ? "Elite" : `Division ${best}`}</span> : null}
      </div>
    </div>
  );
}

export function ReputationLadder({ tier }: { tier: number }) {
  const fill = (tier / (REPUTATION_TIERS.length - 1)) * 100;
  return (
    <div className="card stack" style={{ gap: 18 }}>
      <div className="kpi-label">Reputation</div>
      <div className="ladder" style={{ ["--fill" as string]: fill }}>
        {REPUTATION_TIERS.map((_, i) => {
          const state = i === tier ? "current" : i < tier ? "done" : "ahead";
          return (
            <div key={i} className={`ladder-step ${state}`}>
              <img src={reputationUrl(i)} alt="" width={44} height={44} className="ladder-badge" />
              <span className="ladder-name">{reputationName(i)}</span>
            </div>
          );
        })}
      </div>
      <span className="muted" style={{ fontSize: 13 }}>
        {tier < REPUTATION_TIERS.length - 1 ? `Next: ${reputationName(tier + 1)}` : "Top tier reached"}
      </span>
    </div>
  );
}

/** Where the club stands against EA's top 100 clubs by Skill Rating. */
export function TopHundred({ clubs, us }: { clubs: TopClub[]; us: number | null }) {
  const first = clubs[0];
  const last = clubs[clubs.length - 1];
  const mine = clubs.find((c) => c.clubId === clubId());
  const gap = us !== null && last ? last.skillRating - us : null;
  // our Skill Rating on a bar from 1000 up to #1
  const floor = 1000;
  const pct = (sr: number) => Math.max(0, Math.min(100, ((sr - floor) / Math.max(1, first.skillRating - floor)) * 100));
  return (
    <a className="card stack" href="/top-100" style={{ gap: 14, textDecoration: "none", color: "var(--text)", justifyContent: "space-between" }}>
      <div className="row between">
        <span className="kpi-label">World top 100</span>
        <span className="muted" style={{ fontSize: 13 }}>By Skill Rating →</span>
      </div>
      {mine ? (
        <span className="display num accent" style={{ fontSize: 40, lineHeight: 1 }}>#{mine.rank}</span>
      ) : (
        <div className="stack" style={{ gap: 8 }}>
          <span className="display num" style={{ fontSize: 28, lineHeight: 1.1 }}>
            {gap !== null ? `${gap} SR short` : "Not ranked"}
          </span>
          {last ? (
            <div className="row" style={{ gap: 8, flexWrap: "nowrap", fontSize: 13 }}>
              <span className="muted">To pass #100</span>
              <Crest id={last.crest} size={22} />
              <strong style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{last.name}</strong>
            </div>
          ) : null}
        </div>
      )}
      <div className="stack" style={{ gap: 6 }}>
        <div className="top100-bar">
          <div className="top100-zone" style={{ left: `${pct(last.skillRating)}%` }} />
          {us !== null ? <div className="top100-us" style={{ left: `${pct(us)}%` }} title={`You: ${us}`} /> : null}
        </div>
        <div className="row between muted" style={{ fontSize: 12 }}>
          <span>You: {us ?? "–"}</span>
          <span>#100: {last.skillRating}</span>
          <span>#1: {first.skillRating}</span>
        </div>
      </div>
      <div className="row" style={{ gap: 8, flexWrap: "nowrap", fontSize: 13 }}>
        <span className="muted">#1</span>
        <Crest id={first.crest} size={22} />
        <strong style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{first.name}</strong>
      </div>
    </a>
  );
}
