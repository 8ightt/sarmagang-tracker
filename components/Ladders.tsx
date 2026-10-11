import { REPUTATION_TIERS, reputationName, reputationUrl } from "@/lib/ea-assets";

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
              <span className="shield">{d === 0 ? "E" : d}</span>
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
              <img src={reputationUrl(i)} alt="" width={44} height={44} className="rep-badge" />
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
