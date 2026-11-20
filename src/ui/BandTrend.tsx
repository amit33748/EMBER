import { useId } from 'react';
import { BAND_CUTS } from '../analysis/hazard';

interface Props {
  values: number[];
  height?: number;
  color?: string;
  label: string;
  /** x-axis labels, left → right */
  xLabels?: string[];
  /** optional dashed continuation (e.g. forecast) appended after values */
  future?: number[];
}

/**
 * Hazard trend on an honest fixed 0–100 axis with faint band stripes,
 * so a 6-point wobble looks like a 6-point wobble (audit M11).
 */
export function BandTrend({ values, height = 72, color = 'var(--accent)', label, xLabels = ['−24h', '−12h', 'now'], future }: Props) {
  const id = useId().replace(/:/g, '');
  const W = 300;
  const n = values.length + (future?.length ?? 0);
  const x = (i: number) => (i / Math.max(1, n - 1)) * W;
  const y = (v: number) => height - (Math.max(0, Math.min(100, v)) / 100) * height;
  const d = values.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join('');
  const fd = future?.length
    ? [values[values.length - 1], ...future].map((v, i) => `${i ? 'L' : 'M'}${x(values.length - 1 + i).toFixed(1)},${y(v).toFixed(1)}`).join('')
    : '';
  const cuts = [0, ...BAND_CUTS, 100];
  const lo = Math.min(...values), hi = Math.max(...values);
  return (
    <div className="bt">
      <div className="bt-plot">
        <svg viewBox={`0 0 ${W} ${height}`} preserveAspectRatio="none" width="100%" height={height} role="img" aria-label={`${label}: range ${Math.round(lo)} to ${Math.round(hi)} on a 0 to 100 scale`}>
          <defs>
            <linearGradient id={`bt${id}`} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0" stopColor={color} stopOpacity="0.3" />
              <stop offset="1" stopColor={color} stopOpacity="0" />
            </linearGradient>
          </defs>
          {cuts.slice(0, -1).map((c, i) => (
            <rect key={c} x={0} width={W} y={y(cuts[i + 1])} height={y(c) - y(cuts[i + 1])} fill={`var(--hz-${i})`} opacity={0.07} />
          ))}
          {BAND_CUTS.map((c) => <line key={c} x1={0} x2={W} y1={y(c)} y2={y(c)} stroke="var(--line)" strokeDasharray="2 4" vectorEffect="non-scaling-stroke" />)}
          <path d={`${d}L${x(values.length - 1)},${height}L0,${height}Z`} fill={`url(#bt${id})`} />
          <path d={d} fill="none" stroke={color} strokeWidth={1.8} vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
          {fd && <path d={fd} fill="none" stroke={color} strokeWidth={1.5} strokeDasharray="3 4" opacity={0.7} vectorEffect="non-scaling-stroke" />}
        </svg>
        <div className="bt-y mono" aria-hidden><span>100</span><span>0</span></div>
      </div>
      <div className="bt-x mono" aria-hidden>{xLabels.map((l) => <span key={l}>{l}</span>)}</div>
    </div>
  );
}
