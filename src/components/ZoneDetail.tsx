import { AnimatePresence, motion } from 'motion/react';
import { X, Building2, Clock } from 'lucide-react';
import { useStore, provider } from '../store';
import { ZONE_BY_ID } from '../geo/zones';
import { Gauge } from '../ui/Gauge';
import { BandChip } from '../ui/BandChip';
import { CountUp } from '../ui/CountUp';
import { HAZARD_WEIGHTS, FUEL_CAP } from '../analysis/hazard';
import { BandTrend } from '../ui/BandTrend';
import { nearestStation } from '../sim/incidents';
import { t } from '../i18n/en';
import { TYPE_COLORS } from './DistrictPanel';

const fmtTime = (ms: number) => new Date(ms).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' });

export function ZoneDetail() {
  const id = useStore((s) => s.selectedZone);
  const snap = useStore((s) => s.snapshot);
  const history = useStore((s) => s.history);
  const forecast = useStore((s) => s.forecast);
  const kpis = useStore((s) => s.kpis);
  const close = useStore((s) => s.selectZone);

  return (
    <AnimatePresence>
      {id && (() => {
        const z = ZONE_BY_ID[id];
        const st = snap.zones.find((s) => s.zoneId === id)!;
        const series = history.filter((_, i) => i % 3 === 2).map((h) => h.zoneFhs[id]);
        const incs = snap.incidents.filter((i) => i.zoneId === id).sort((a, b) => b.reportedAt - a.reportedAt);
        const { st: station, km } = nearestStation(provider.stations(), z.lon, z.lat);
        const load = kpis.stationLoad[station.id];
        const parts = [
          { label: 'Weather (FFWI)', v: st.weather * HAZARD_WEIGHTS.weather, max: 100 * HAZARD_WEIGHTS.weather },
          { label: `Fuel × activity · ${t.landUse[z.landUse]}`, v: st.fuel * 100 * HAZARD_WEIGHTS.fuel, max: Math.round(FUEL_CAP * 100 * HAZARD_WEIGHTS.fuel) },
          { label: 'Ignition pressure', v: st.ignition * HAZARD_WEIGHTS.ignition, max: 100 * HAZARD_WEIGHTS.ignition },
        ];
        return (
          <motion.aside
            key={id}
            className="panel-right glass"
            aria-label={`${z.name} details`}
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 40 }}
            transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="eyebrow">{t.landUse[z.landUse]} · {z.urban ? 'Urban' : 'Rural'}</div>
                <h2 style={{ fontSize: 'var(--fs-xl)', marginTop: 6 }}>{z.name}</h2>
              </div>
              <button type="button" className="icon-btn" onClick={() => close(null)} aria-label="Close zone details"><X size={16} /></button>
            </div>

            <div className="panel-body scroll-thin" style={{ marginTop: 12 }}>
              <div className="flex items-center gap-4">
                <div style={{ width: 150 }}><Gauge value={st.fhs} size={160} /></div>
                <div>
                  <div className="mono" style={{ fontSize: 'var(--fs-2xl)', color: `var(--hz-ink-${st.band})`, lineHeight: 1 }}><CountUp value={st.fhs} /></div>
                  <div style={{ marginTop: 8 }}><BandChip band={st.band} /></div>
                </div>
              </div>

              <div className="panel-section">
                <h3 className="eyebrow sec-h">Score breakdown</h3>
                {parts.map((p) => (
                  <div key={p.label} className="breakdown">
                    <div className="flex justify-between"><span>{p.label}</span><span className="mono">{p.v.toFixed(1)}<span style={{ color: 'var(--text-3)' }}> / {p.max}</span></span></div>
                    <div className="bd-bar"><span style={{ width: `${(p.v / p.max) * 100}%` }} /></div>
                  </div>
                ))}
              </div>

              <div className="panel-section">
                <h3 className="eyebrow sec-h flex justify-between"><span>FHS · last 24h → next 24h</span><span>{Math.round(Math.min(...series))}–{Math.round(Math.max(...series))}</span></h3>
                <BandTrend
                  values={series}
                  future={forecast.map((f) => f.zoneFhs[id])}
                  color={`var(--hz-${st.band})`}
                  label={`Hazard score for ${z.name}, last 24 hours and outlook`}
                  xLabels={['−24h', 'now', '+24h']}
                />
              </div>

              <div className="panel-section">
                <h3 className="eyebrow sec-h">Nearest station</h3>
                <div className="station-card">
                  <Building2 size={16} />
                  <div style={{ flex: 1 }}>
                    <div>{station.name}</div>
                    <div className="mono" style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-3)' }}>
                      {km.toFixed(1)} km straight-line · ≈{Math.round((km * 1.35) / (z.urban ? 34 : 45) * 60 + 2)} min est. · {load?.deployed ?? 0}/{station.units} units out{station.source === 'approx' ? ' · approx. location' : ''}
                    </div>
                  </div>
                </div>
              </div>

              <div className="panel-section">
                <h3 className="eyebrow sec-h">Incidents · 24h ({incs.length})</h3>
                {incs.length === 0 && <p style={{ color: 'var(--text-3)', fontSize: 'var(--fs-sm)' }}>No incidents recorded in this zone.</p>}
                <ul className="inc-list">
                  {incs.map((i) => (
                    <li key={i.id}>
                      <span className="dot" style={{ background: TYPE_COLORS[i.type] }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div className="flex justify-between gap-2">
                          <span>{t.types[i.type]}</span>
                          <span className={`status s-${i.status}`}>{t.status[i.status]}</span>
                        </div>
                        <div className="mono" style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-3)' }}>
                          <Clock size={10} style={{ display: 'inline', verticalAlign: '-1px' }} /> {fmtTime(i.reportedAt)} · sev {i.severity} · {i.id}
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </motion.aside>
        );
      })()}
    </AnimatePresence>
  );
}
