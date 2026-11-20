import type { Band } from '../data/types';
import { t } from '../i18n/en';

export function BandChip({ band, size = 'sm' }: { band: Band; size?: 'sm' | 'md' }) {
  return (
    <span
      className="mono inline-flex items-center gap-1.5 whitespace-nowrap"
      style={{
        fontSize: size === 'sm' ? 'var(--fs-xs)' : 'var(--fs-sm)',
        letterSpacing: '0.08em',
        textTransform: 'uppercase',
        padding: size === 'sm' ? '2px 8px' : '4px 10px',
        borderRadius: 'var(--r-pill)',
        color: `var(--hz-ink-${band})`,
        background: `color-mix(in oklab, var(--hz-${band}) 14%, transparent)`,
        border: `1px solid color-mix(in oklab, var(--hz-${band}) 35%, transparent)`,
      }}
    >
      <span aria-hidden style={{ width: 6, height: 6, borderRadius: 99, background: `var(--hz-${band})`, boxShadow: band >= 3 ? `0 0 8px var(--hz-${band})` : undefined }} />
      {t.bands[band]}
    </span>
  );
}
