import { useState } from 'react';
import { Thermometer, Droplets, Wind, Gauge as GaugeIcon, ChevronUp } from 'lucide-react';
import { useStore } from '../store';
import { ZONE_BY_ID } from '../geo/zones';
import { Gauge } from '../ui/Gauge';
import { BandChip } from '../ui/BandChip';
import { CountUp } from '../ui/CountUp';
import { IncidentMix } from '../ui/IncidentMix';
import { useKpiTiles } from './KpiRow';
import { t } from '../i18n/en';
import type { IncidentType } from '../data/types';

export const TYPE_COLORS: Record<IncidentType, string> = {
  building: 'var(--cat-building)',
  electrical: 'var(--cat-electrical)',
  industrial: 'var(--cat-industrial)',
  vehicle: 'var(--cat-vehicle)',
  garbage: 'var(--cat-garbage)',
  scrub: 'var(--cat-scrub)',
};

const compass = (deg: number) => ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'][Math.round(deg / 45) % 8];

export function DistrictPanel() {
  const k = useStore((s) => s.kpis);
  const snap = useStore((s) => s.snapshot);
  const selectZone = useStore((s) => s.selectZone);
  const selected = useStore((s) => s.selectedZone);
  const [open, setOpen] = useState(false); // mobile sheet
  const tiles = useKpiTiles();
  const w = snap.weather;
  const ranked = [...snap.zones].sort((a, b) => b.fhs - a.fhs);
  const time = new Date(snap.t).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' });

  return (
    <aside className="panel-left glass" data-open={open || undefined} aria-label="District overview">
      <button type="button" className="sheet-handle" onClick={() => setOpen((v) => !v)} aria-expanded={open} aria-label={open ? 'Collapse district panel' : 'Expand district panel'}>
        <span />
        <ChevronUp size={14} style={{ transform: open ? 'rotate(180deg)' : undefined }} />
      </button>

      <div className="panel-hero">
        <div className="flex items-center justify-between">
          <h2 className="eyebrow" style={{ margin: 0 }}>Gurugram district · {time} IST</h2>
          <BandChip band={k.districtBand} />
        </div>
        <div className="flex items-end gap-4" style={{ marginTop: 10 }}>
          <div className="fhs-num" style={{ color: `var(--hz-ink-${k.districtBand})` }}>
            <CountUp value={k.districtFhs} />
          </div>
          <div style={{ paddingBottom: 10 }}>
            <div className="mono" style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-3)' }}>FIRE HAZARD SCORE</div>
            <div className="mono" style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-3)' }}>/ 100 · prototype</div>
          </div>
        </div>
        <div className="gauge-wrap" style={{ maxWidth: 260, marginTop: 4 }}>
          <Gauge value={k.districtFhs} />
        </div>
        <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-2)', marginTop: 6 }}>{t.bandAdvice[k.districtBand]}</p>
      </div>

      <div className="panel-body scroll-thin">
        <div className="wx-strip">
          <div><Thermometer size={14} /><span className="mono">{w.tempC.toFixed(1)}°C</span></div>
          <div><Droplets size={14} /><span className="mono">{Math.round(w.rh)}%</span></div>
          <div title={`Wind from ${compass(w.windDir)} — simulated local value; the map's wind layer (off by default) shows an illustrative seasonal circulation, not a forecast`}>
            <Wind size={14} />
            <span className="mono">{w.windKmh.toFixed(0)} km/h</span>
            <svg width="12" height="12" viewBox="0 0 24 24" style={{ transform: `rotate(${w.windDir + 180}deg)` }} aria-hidden>
              <path d="M12 2l5 9h-4v11h-2V11H7z" fill="currentColor" />
            </svg>
          </div>
          <div title="Fosberg Fire Weather Index"><GaugeIcon size={14} /><span className="mono">FFWI {w.ffwi.toFixed(0)}</span></div>
        </div>

        {/* KPIs that don't fit the strip at this screen width (CSS decides per tier) */}
        <div className="panel-section all-kpis">
          <h3 className="eyebrow sec-h">More indicators</h3>
          <dl>
            {tiles.map((k) => (
              <div key={k.key} data-tier={k.tier} className="ak-row" title={k.hint}>
                <dt>{k.label}</dt>
                <dd className={k.textValue ? '' : 'mono'}>
                  {k.value}
                  {k.unit && <span className="ak-unit"> {k.unit}</span>}
                  {k.meta && <span className="ak-meta">{k.meta}</span>}
                </dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="panel-section">
          <h3 className="eyebrow sec-h">Incident mix · 24h</h3>
          <IncidentMix
            size={124}
            segs={(Object.keys(k.typeMix) as IncidentType[]).map((ty) => ({ key: ty, label: t.types[ty], value: k.typeMix[ty], color: TYPE_COLORS[ty] }))}
          />
        </div>

        <div className="panel-section">
          <h3 className="eyebrow sec-h">Zones by hazard</h3>
          <ol className="zone-list">
            {ranked.map((z, i) => (
              <li key={z.zoneId}>
                <button type="button" onClick={() => selectZone(z.zoneId)} data-on={selected === z.zoneId || undefined} aria-current={selected === z.zoneId || undefined}>
                  <span className="mono zl-rank">{String(i + 1).padStart(2, '0')}</span>
                  <span className="zl-name">
                    {ZONE_BY_ID[z.zoneId].name}
                    <span className="zl-bar"><span style={{ width: `${z.fhs}%`, background: `var(--hz-${z.band})` }} /></span>
                  </span>
                  <span className="mono zl-val" style={{ color: `var(--hz-ink-${z.band})` }}>{Math.round(z.fhs)}</span>
                </button>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </aside>
  );
}
