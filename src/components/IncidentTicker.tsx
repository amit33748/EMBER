import { useState } from 'react';
import { Pause, Play } from 'lucide-react';
import { useStore } from '../store';
import { ZONE_BY_ID } from '../geo/zones';
import { t } from '../i18n/en';
import { TYPE_COLORS } from './DistrictPanel';

const fmt = (ms: number) => new Date(ms).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' });

/**
 * Scrolling incident feed. WCAG 2.2.2: an explicit pause button, plus pause on
 * hover and keyboard focus; the duplicated loop copy is hidden from AT (audit M2).
 */
export function IncidentTicker() {
  const incs = useStore((s) => s.snapshot.incidents);
  const selectZone = useStore((s) => s.selectZone);
  const [paused, setPaused] = useState(false);
  const list = [...incs].sort((a, b) => b.reportedAt - a.reportedAt).slice(0, 14);
  const latest = list[0];
  if (!list.length) return null;
  const items = (copy: boolean) =>
    list.map((i) => (
      <button
        type="button"
        key={`${copy ? 'b' : 'a'}${i.id}`}
        className="tk-item"
        onClick={() => selectZone(i.zoneId)}
        tabIndex={copy ? -1 : 0}
        aria-label={copy ? undefined : `${t.types[i.type]} at ${fmt(i.reportedAt)} in ${ZONE_BY_ID[i.zoneId].name}, ${t.status[i.status]}. Open zone.`}
      >
        <span className="dot" style={{ background: TYPE_COLORS[i.type] }} />
        <span className="mono tk-time">{fmt(i.reportedAt)}</span>
        <span>{t.types[i.type]}</span>
        <span className="tk-zone">{ZONE_BY_ID[i.zoneId].name}</span>
        <span className={`status s-${i.status}`}>{t.status[i.status]}</span>
      </button>
    ));
  return (
    <section className="ticker glass" aria-labelledby="tk-h" data-paused={paused || undefined}>
      <h2 id="tk-h" className="ticker-label mono">Feed</h2>
      <button type="button" className="tk-pause" onClick={() => setPaused((p) => !p)} aria-pressed={paused} aria-label={paused ? 'Resume incident feed' : 'Pause incident feed'}>
        {paused ? <Play size={12} /> : <Pause size={12} />}
      </button>
      <div className="ticker-track">
        <div className="ticker-inner">
          <div className="ticker-set">{items(false)}</div>
          <div className="ticker-set" aria-hidden="true">{items(true)}</div>
        </div>
      </div>
      <div className="sr-only" aria-live="polite">
        {latest ? `Latest: ${t.types[latest.type]} in ${ZONE_BY_ID[latest.zoneId].name}, ${t.status[latest.status]}` : ''}
      </div>
    </section>
  );
}
