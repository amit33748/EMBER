import { t } from '../i18n/en';

export function Legend({ title = 'Simulated density', compact = false }: { title?: string; compact?: boolean }) {
  return (
    <div className="glass" style={{ padding: compact ? '8px 10px' : '10px 14px', minWidth: compact ? 0 : 230 }}>
      <div className="eyebrow" style={{ marginBottom: 6 }}>{title}</div>
      <div
        style={{
          height: 8,
          borderRadius: 99,
          background: 'var(--ramp)',
          border: '1px solid var(--line)',
        }}
      />
      {!compact && (
        <div className="mono flex justify-between" style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 4, gap: 6 }}>
          {t.bands.map((b) => <span key={b}>{b.replace('Very ', 'V.')}</span>)}
        </div>
      )}
    </div>
  );
}
