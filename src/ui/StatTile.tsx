import type { ReactNode } from 'react';
import { ArrowDownRight, ArrowUpRight } from 'lucide-react';
import { Sparkline } from './Sparkline';

interface Props {
  label: string;
  value: ReactNode;
  unit?: string;
  delta?: number | null; // percent
  deltaGoodWhenDown?: boolean;
  spark?: number[];
  /** fixed y-domain for the sparkline (avoids exaggerating small changes) */
  sparkDomain?: [number, number];
  hint?: string;
  onClick?: () => void;
  /** set only for toggle tiles; drives aria-pressed */
  active?: boolean;
  accent?: string;
  /** value is a name, not a number — render in body type */
  textValue?: boolean;
  /** secondary line under the value (sample size, window, forecast value) */
  meta?: string;
  /** responsive priority (1 = always shown, 5 = widest screens only) */
  tier?: number;
  /** label used on phones */
  short?: string;
}

export function StatTile({ label, value, unit, delta, deltaGoodWhenDown = true, spark, sparkDomain, hint, onClick, active, accent, textValue, meta, tier, short }: Props) {
  const up = (delta ?? 0) > 0;
  const good = delta == null ? null : deltaGoodWhenDown ? !up : up;
  const body = (
    <>
      <div className="eyebrow st-label">
        {short ? (<><span className="st-long">{label}</span><span className="st-short" aria-hidden>{short}</span></>) : label}
      </div>
      <div className="st-row">
        <span className={textValue ? 'st-text' : 'mono st-value'}>{value}</span>
        {unit && <span className="mono st-unit">{unit}</span>}
        {delta != null && Number.isFinite(delta) && (
          <span className="mono st-delta" style={{ color: good ? 'var(--ok)' : 'var(--bad)' }} aria-label={`${up ? 'up' : 'down'} ${Math.abs(delta).toFixed(0)} percent`}>
            {up ? <ArrowUpRight size={12} aria-hidden /> : <ArrowDownRight size={12} aria-hidden />}
            {Math.abs(delta).toFixed(0)}%
          </span>
        )}
      </div>
      {meta && <div className="mono st-meta">{meta}</div>}
      {spark && (
        <div className="st-spark">
          <Sparkline values={spark} height={20} color={accent ?? 'var(--accent)'} min={sparkDomain?.[0]} max={sparkDomain?.[1]} />
        </div>
      )}
    </>
  );
  const style = { ['--tile-accent' as string]: accent ?? 'var(--accent)' } as React.CSSProperties;
  return onClick ? (
    <button
      type="button"
      onClick={onClick}
      title={hint}
      aria-pressed={active === undefined ? undefined : active}
      className="stat-tile text-left"
      data-tier={tier}
      data-active={active || undefined}
      style={style}
    >
      {body}
    </button>
  ) : (
    <div title={hint} className="stat-tile" data-tier={tier} style={style}>{body}</div>
  );
}
