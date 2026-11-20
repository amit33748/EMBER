import { useId } from 'react';

interface Props {
  values: number[];
  width?: number;
  height?: number;
  color?: string;
  min?: number;
  max?: number;
  fill?: boolean;
  strokeWidth?: number;
  label?: string;
}

export function Sparkline({ values, width = 120, height = 32, color = 'var(--accent)', min, max, fill = true, strokeWidth = 1.5, label }: Props) {
  const id = useId().replace(/:/g, '');
  if (values.length < 2) return <svg width={width} height={height} aria-hidden />;
  const lo = min ?? Math.min(...values);
  const hi = max ?? Math.max(...values);
  const span = hi - lo || 1;
  const pad = strokeWidth + 1;
  const pts = values.map((v, i) => [
    (i / (values.length - 1)) * width,
    pad + (1 - (v - lo) / span) * (height - pad * 2),
  ]);
  const d = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join('');
  return (
    <svg
      width="100%"
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      style={{ display: 'block', overflow: 'visible' }}
    >
      <defs>
        <linearGradient id={`g${id}`} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor={color} stopOpacity="0.28" />
          <stop offset="1" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      {fill && <path d={`${d}L${width},${height}L0,${height}Z`} fill={`url(#g${id})`} />}
      <path d={d} fill="none" stroke={color} strokeWidth={strokeWidth} vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}
