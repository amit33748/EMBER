import type { ReactNode } from 'react';

export interface DonutSeg { key: string; label: string; value: number; color: string }

export function Donut({ segs, size = 96, thickness = 12, center }: { segs: DonutSeg[]; size?: number; thickness?: number; center?: ReactNode }) {
  const total = segs.reduce((a, s) => a + s.value, 0) || 1;
  const r = (size - thickness) / 2;
  const C = 2 * Math.PI * r;
  let acc = 0;
  return (
    <div style={{ position: 'relative', width: size, height: size, flex: 'none' }}>
      <svg width={size} height={size} role="img" aria-label={segs.map((s) => `${s.label} ${s.value}`).join(', ')}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--line)" strokeWidth={thickness} />
        {segs.filter((s) => s.value > 0).map((s) => {
          const len = (s.value / total) * C;
          const el = (
            <circle
              key={s.key}
              cx={size / 2}
              cy={size / 2}
              r={r}
              fill="none"
              stroke={s.color}
              strokeWidth={thickness}
              strokeDasharray={`${Math.max(0, len - 2)} ${C}`}
              strokeDashoffset={-acc}
              transform={`rotate(-90 ${size / 2} ${size / 2})`}
            />
          );
          acc += len;
          return el;
        })}
      </svg>
      {center && <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center' }}>{center}</div>}
    </div>
  );
}
