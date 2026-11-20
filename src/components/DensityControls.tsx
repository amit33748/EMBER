import { useEffect, useState } from 'react';
import { SlidersHorizontal, ChevronDown } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useStore } from '../store';
import { t } from '../i18n/en';

/** Legend + KDE parameter controls (bandwidth, time window, weighting). */
export function DensityControls() {
  const surface = useStore((s) => s.surface);
  const params = useStore((s) => s.kdeParams);
  const setParams = useStore((s) => s.setKdeParams);
  const kde = useStore((s) => s.kde);
  const [open, setOpen] = useState(false);
  const [bw, setBw] = useState(params.bandwidthKm);

  // debounce slider → store (each change re-runs the KDE worker)
  useEffect(() => {
    if (bw === params.bandwidthKm) return;
    const id = setTimeout(() => setParams({ bandwidthKm: bw }), 140);
    return () => clearTimeout(id);
  }, [bw, params.bandwidthKm, setParams]);

  const effBw = surface === 'hazard' ? bw : bw * 1.3;
  const title = surface === 'hazard' ? 'Hazard density' : `Incident density · ${params.windowH}h`;
  const scenario = useStore((s) => s.scenario);
  const setScenario = useStore((s) => s.setScenario);

  return (
    <div className="glass dc">
      <button type="button" className="dc-head" onClick={() => setOpen((v) => !v)} aria-expanded={open} aria-controls="dc-body">
        <span className="eyebrow">{title}</span>
        <span className="dc-toggle">
          <SlidersHorizontal size={13} />
          <ChevronDown size={13} style={{ transform: open ? 'rotate(180deg)' : undefined, transition: 'transform var(--t-fast)' }} />
        </span>
      </button>
      <div className="dc-ramp" />
      <div className="mono flex justify-between dc-labels">
        {t.bands.map((b) => <span key={b}>{b.replace('Very ', 'V.')}</span>)}
      </div>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            id="dc-body"
            className="dc-body"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
          >
            <label className="dc-row">
              <span className="flex justify-between">
                <span>Kernel bandwidth</span>
                <span className="mono">{effBw.toFixed(1)} km</span>
              </span>
              <input
                type="range"
                min={0.5}
                max={3}
                step={0.1}
                value={bw}
                onChange={(e) => setBw(parseFloat(e.target.value))}
                aria-valuetext={`${effBw.toFixed(1)} kilometres`}
              />
            </label>

            <div className="dc-row" aria-disabled={surface === 'hazard' || undefined}>
              <span>Incident window {surface === 'hazard' && <em className="dc-note">incident surface only</em>}</span>
              <div role="radiogroup" aria-label="Incident time window" className="seg dc-seg">
                {([1, 6, 24] as const).map((h) => (
                  <button key={h} type="button" role="radio" aria-checked={params.windowH === h} data-on={params.windowH === h || undefined}
                    className="seg-btn" disabled={surface === 'hazard'} onClick={() => setParams({ windowH: h })}>
                    {h}h
                  </button>
                ))}
              </div>
            </div>

            <div className="dc-row" aria-disabled={surface === 'hazard' || undefined}>
              <span>Weighting</span>
              <div role="radiogroup" aria-label="Incident weighting" className="seg dc-seg">
                {(['severity', 'count'] as const).map((w) => (
                  <button key={w} type="button" role="radio" aria-checked={params.weighting === w} data-on={params.weighting === w || undefined}
                    className="seg-btn" disabled={surface === 'hazard'} onClick={() => setParams({ weighting: w })}>
                    {w === 'severity' ? 'Severity × recency' : 'Count'}
                  </button>
                ))}
              </div>
            </div>

            <div className="dc-row">
              <span>Season scenario</span>
              <div role="radiogroup" aria-label="Season scenario" className="seg dc-seg">
                {([['calendar', 'Calendar'], ['summer', 'Summer peak (May)']] as const).map(([v, l]) => (
                  <button key={v} type="button" role="radio" aria-checked={scenario === v} data-on={scenario === v || undefined} className="seg-btn" onClick={() => setScenario(v)}>
                    {l}
                  </button>
                ))}
              </div>
            </div>

            <div className="mono dc-foot">
              Quartic kernel · 200 m grid{kde ? ` · ${kde.ms.toFixed(0)} ms in worker` : ''}
              <br />Wind: illustrative seasonal circulation over India &amp; the Indian Ocean, blended with the simulated local wind near Gurugram.
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
