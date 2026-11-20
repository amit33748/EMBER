import { useEffect, useRef, useState } from 'react';
import { animate, useReducedMotion } from 'motion/react';
import { BAND_CUTS, bandOf } from '../analysis/hazard';

/**
 * Semicircular 0–100 gauge with band-coloured track segments.
 *
 * The needle is rotated with an SVG `rotate(angle cx cy)` attribute so it always
 * pivots on the hub. (A CSS/Motion `rotate` on an SVG element uses the element's
 * own bounding box as origin, which detached the needle at large angles.)
 */
export function Gauge({ value, size = 200, label }: { value: number; size?: number; label?: string }) {
  const reduce = useReducedMotion();
  const r = size / 2 - 12;
  const cx = size / 2;
  const cy = size / 2;
  const arc = (a0: number, a1: number) => {
    const p = (a: number) => [cx - r * Math.cos(Math.PI * a), cy - r * Math.sin(Math.PI * a)];
    const [x0, y0] = p(a0);
    const [x1, y1] = p(a1);
    return `M${x0},${y0} A${r},${r} 0 0 1 ${x1},${y1}`;
  };
  const cuts = [0, ...BAND_CUTS, 100];
  const v = Math.max(0, Math.min(100, value)) / 100;
  const band = bandOf(value);
  const target = v * 180 - 90; // -90 = pointing left (0), +90 = right (100)

  const [angle, setAngle] = useState(target);
  const current = useRef(target);
  useEffect(() => {
    if (reduce) { current.current = target; setAngle(target); return; }
    const c = animate(current.current, target, {
      type: 'spring',
      stiffness: 60,
      damping: 14,
      onUpdate: (a) => { current.current = a; setAngle(a); },
    });
    return () => c.stop();
  }, [target, reduce]);

  return (
    <svg width="100%" viewBox={`0 0 ${size} ${size / 2 + 10}`} role="img" aria-label={label ?? `Hazard score ${value.toFixed(0)} of 100`}>
      {cuts.slice(0, -1).map((c, i) => (
        <path
          key={i}
          d={arc(c / 100 + 0.006, cuts[i + 1] / 100 - 0.006)}
          stroke={`var(--hz-${i})`}
          strokeOpacity={i <= band ? 0.95 : 0.2}
          strokeWidth={9}
          fill="none"
        />
      ))}
      <g transform={`rotate(${angle.toFixed(2)} ${cx} ${cy})`}>
        <line x1={cx} y1={cy} x2={cx} y2={cy - r + 18} stroke="var(--text)" strokeWidth={2.2} strokeLinecap="round" />
      </g>
      <circle cx={cx} cy={cy} r={6} fill="var(--surface-solid)" stroke="var(--text)" strokeWidth={2} />
    </svg>
  );
}
