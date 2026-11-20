import { useId, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';

export interface MixSeg { key: string; label: string; value: number; color: string }

interface Props {
  segs: MixSeg[];
  size?: number;
  caption?: string;
  hideEmpty?: boolean;
}

const TAU = Math.PI * 2;

function arcPath(cx: number, cy: number, r: number, a0: number, a1: number) {
  const p = (a: number) => [cx + r * Math.sin(a), cy - r * Math.cos(a)];
  const [x0, y0] = p(a0);
  const [x1, y1] = p(a1);
  const large = a1 - a0 > Math.PI ? 1 : 0;
  return `M${x0.toFixed(2)},${y0.toFixed(2)} A${r},${r} 0 ${large} 1 ${x1.toFixed(2)},${y1.toFixed(2)}`;
}

/**
 * Categorical ring + legend. Rounded segments with gaps, soft glow,
 * draw-in animation; hovering a legend row (or segment) isolates it.
 */
export function IncidentMix({ segs, size = 120, caption = '24h', hideEmpty = false }: Props) {
  const id = useId().replace(/:/g, '');
  const reduce = useReducedMotion();
  const [hover, setHover] = useState<string | null>(null);
  const total = segs.reduce((a, s) => a + s.value, 0);
  const live = segs.filter((s) => s.value > 0);
  const stroke = Math.round(size * 0.12);
  const r = size / 2 - stroke / 2 - 4;
  const cx = size / 2;
  const gap = live.length > 1 ? 0.09 + stroke / r : 0; // radians, accounts for round caps

  let acc = 0;
  const arcs = live.map((s) => {
    const span = (s.value / total) * TAU;
    const a0 = acc + gap / 2;
    const a1 = acc + span - gap / 2;
    acc += span;
    return { ...s, a0, a1: Math.max(a1, a0 + 0.001) };
  });
  const hovered = hover ? segs.find((s) => s.key === hover) : null;
  const rows = hideEmpty ? live : segs;

  return (
    <div className="mix">
      <div className="mix-ring" style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={`Incident mix: ${segs.map((s) => `${s.label} ${s.value}`).join(', ')}`}>
          <defs>
            <filter id={`glow${id}`} x="-30%" y="-30%" width="160%" height="160%">
              <feGaussianBlur stdDeviation="3" result="b" />
              <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
          </defs>
          <circle cx={cx} cy={cx} r={r} fill="none" stroke="var(--line)" strokeWidth={stroke} />
          <circle cx={cx} cy={cx} r={r - stroke / 2 - 5} fill="none" stroke="var(--line)" strokeWidth={1} strokeDasharray="1 4" />
          {total === 0 && <circle cx={cx} cy={cx} r={r} fill="none" stroke="var(--line-strong)" strokeWidth={stroke} strokeDasharray="2 6" />}
          {arcs.map((a, i) => {
            const dim = hover && hover !== a.key;
            return (
              <motion.path
                key={a.key}
                d={live.length === 1 ? arcPath(cx, cx, r, 0, TAU - 0.0001) : arcPath(cx, cx, r, a.a0, a.a1)}
                fill="none"
                stroke={a.color}
                strokeWidth={hover === a.key ? stroke + 3 : stroke}
                strokeLinecap="round"
                filter={hover === a.key ? `url(#glow${id})` : undefined}
                initial={(reduce ? false : { pathLength: 0, opacity: 0 }) as never}
                animate={{ pathLength: 1, opacity: dim ? 0.22 : 1 } as never}
                transition={{ pathLength: { duration: 0.9, delay: 0.08 * i, ease: [0.16, 1, 0.3, 1] }, opacity: { duration: 0.2 } }}
                onMouseEnter={() => setHover(a.key)}
                onMouseLeave={() => setHover(null)}
                style={{ cursor: 'default', transition: 'stroke-width 160ms' }}
              />
            );
          })}
        </svg>
        <div className="mix-center" aria-hidden>
          <span className="mono mix-total" style={{ color: hovered ? hovered.color : undefined }}>{hovered ? hovered.value : total}</span>
          <span className="mix-cap">{hovered ? hovered.label : caption}</span>
        </div>
      </div>

      <ul className="mix-legend">
        {rows.map((s) => {
          const pct = total ? (s.value / total) * 100 : 0;
          return (
            <li
              key={s.key}
              tabIndex={0}
              data-dim={(hover && hover !== s.key) || undefined}
              data-zero={s.value === 0 || undefined}
              onMouseEnter={() => setHover(s.key)}
              onMouseLeave={() => setHover(null)}
              onFocus={() => setHover(s.key)}
              onBlur={() => setHover(null)}
              aria-label={`${s.label}: ${s.value} (${pct.toFixed(0)}%)`}
            >
              <span className="mix-dot" style={{ background: s.color, boxShadow: s.value ? `0 0 10px ${s.color}` : undefined }} />
              <span className="mix-label">{s.label}</span>
              <span className="mono mix-val">{s.value}</span>
              <span className="mono mix-pct">{pct.toFixed(0)}%</span>
              <span className="mix-bar"><span style={{ width: `${pct}%`, background: s.color }} /></span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
