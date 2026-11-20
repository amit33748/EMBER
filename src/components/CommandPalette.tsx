import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'motion/react';
import { Search, MapPin, Building2, Layers3, Sun, Moon, Monitor, Home, Flame, Radar, Wind, Mountain, MapPinned, Clock, CornerDownLeft } from 'lucide-react';
import { useStore, provider, type Layers } from '../store';
import { ZONES } from '../geo/zones';
import { setThemePref } from '../theme';
import { BASEMAPS } from '../map/basemaps';
import { t } from '../i18n/en';

interface Item {
  id: string;
  group: 'Zones' | 'Stations' | 'Layers' | 'View' | 'Go';
  label: string;
  hint?: string;
  icon: typeof Search;
  run: () => void;
  color?: string;
}

/** Subsequence fuzzy score: higher is better, -1 = no match. */
function score(q: string, text: string): number {
  if (!q) return 0;
  const s = text.toLowerCase();
  const i0 = s.indexOf(q);
  if (i0 >= 0) return 100 - i0;
  let qi = 0, last = -1, gaps = 0;
  for (let i = 0; i < s.length && qi < q.length; i++) {
    if (s[i] === q[qi]) { if (last >= 0) gaps += i - last - 1; last = i; qi++; }
  }
  return qi === q.length ? 50 - gaps : -1;
}

const LAYER_META: Record<keyof Layers, { label: string; icon: typeof Search }> = {
  contours: { label: 'Contours', icon: Radar },
  zones3d: { label: '3D density', icon: Layers3 },
  incidents: { label: 'Incidents', icon: Flame },
  stations: { label: 'Stations', icon: Building2 },
  wind: { label: 'Wind flow · India & Indian Ocean (illustrative)', icon: Wind },
  terrain: { label: 'Terrain relief', icon: Mountain },
  boundary: { label: 'District boundary', icon: MapPinned },
};

export function CommandPalette() {
  const open = useStore((s) => s.paletteOpen);
  const setOpen = useStore((s) => s.setPaletteOpen);
  const snap = useStore((s) => s.snapshot);
  const layers = useStore((s) => s.layers);
  const nav = useNavigate();
  const [q, setQ] = useState('');
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const returnFocus = useRef<HTMLElement | null>(null);

  // global shortcut
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = e.target instanceof Element && e.target.closest('input, textarea, [contenteditable]');
      if ((e.key === 'k' || e.key === 'K') && (e.ctrlKey || e.metaKey)) { e.preventDefault(); setOpen(!useStore.getState().paletteOpen); }
      else if (e.key === '/' && !typing && !useStore.getState().paletteOpen) { e.preventDefault(); setOpen(true); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [setOpen]);

  useEffect(() => {
    if (open) {
      returnFocus.current = document.activeElement as HTMLElement;
      setQ('');
      setActive(0);
      requestAnimationFrame(() => inputRef.current?.focus());
    } else {
      returnFocus.current?.focus?.();
    }
  }, [open]);

  const items = useMemo<Item[]>(() => {
    const st = useStore.getState();
    const fhs = Object.fromEntries(snap.zones.map((z) => [z.zoneId, z]));
    const zoneItems: Item[] = ZONES.map((z) => ({
      id: `z-${z.id}`, group: 'Zones', label: z.name, icon: MapPin,
      hint: `${Math.round(fhs[z.id].fhs)} · ${t.bands[fhs[z.id].band]}`,
      color: `var(--hz-ink-${fhs[z.id].band})`,
      run: () => st.selectZone(z.id),
    }));
    const stationItems: Item[] = provider.stations().map((s) => ({
      id: `s-${s.id}`, group: 'Stations', label: s.name, icon: Building2,
      hint: `${s.units} units${s.source === 'approx' ? ' · approx.' : ''}`,
      run: () => { st.selectZone(null); st.flyTo(s.lon, s.lat, 13.5); },
    }));
    const layerItems: Item[] = (Object.keys(LAYER_META) as (keyof Layers)[]).map((k) => ({
      id: `l-${k}`, group: 'Layers', label: `${layers[k] ? 'Hide' : 'Show'} ${LAYER_META[k].label.toLowerCase()}`, icon: LAYER_META[k].icon,
      run: () => st.toggleLayer(k),
    }));
    const view: Item[] = [
      { id: 'v-haz', group: 'View', label: 'Hazard density surface', icon: Radar, run: () => st.setSurface('hazard') },
      { id: 'v-inc', group: 'View', label: 'Incident density surface', icon: Flame, run: () => st.setSurface('incident') },
      ...[1, 6, 24].map((h) => ({ id: `v-w${h}`, group: 'View' as const, label: `Incident window: last ${h}h`, icon: Clock, run: () => { st.setSurface('incident'); st.setKdeParams({ windowH: h as 1 | 6 | 24 }); } })),
      { id: 'v-summer', group: 'View', label: 'Scenario: summer peak (May weather)', icon: Sun, run: () => st.setScenario('summer') },
      { id: 'v-cal', group: 'View', label: 'Scenario: calendar (real date)', icon: Clock, run: () => st.setScenario('calendar') },
      { id: 'bm-auto', group: 'View', label: 'Basemap: Auto (follows theme)', icon: MapPinned, run: () => st.setBasemap('auto') },
      ...BASEMAPS.map((b) => ({ id: `bm-${b.id}`, group: 'View' as const, label: `Basemap: ${b.label}`, hint: b.note.split(' — ')[0], icon: MapPinned, run: () => st.setBasemap(b.id) })),
      { id: 'v-light', group: 'View', label: 'Light theme', icon: Sun, run: () => setThemePref('light') },
      { id: 'v-dark', group: 'View', label: 'Dark theme', icon: Moon, run: () => setThemePref('dark') },
      { id: 'v-sys', group: 'View', label: 'System theme', icon: Monitor, run: () => setThemePref('system') },
    ];
    const go: Item[] = [
      { id: 'g-live', group: 'Go', label: 'Go live (exit replay)', icon: Clock, run: () => { st.setPlaying(false); st.setOffset(0); } },
      { id: 'g-24h', group: 'Go', label: 'Replay from 24 hours ago', icon: Clock, run: () => { st.setOffset(-288); st.setPlaying(true); } },
      { id: 'g-7d', group: 'Go', label: 'Replay from 7 days ago', icon: Clock, run: () => { st.setOffset(-2016); st.setPlaying(true); } },
      { id: 'g-home', group: 'Go', label: 'Landing page', icon: Home, run: () => nav('/') },
      { id: 'g-dist', group: 'Go', label: 'Whole district', icon: MapPinned, run: () => { st.selectZone(null); st.flyTo(76.95, 28.37, 9.6); } },
    ];
    return [...zoneItems, ...stationItems, ...layerItems, ...view, ...go];
  }, [snap, layers, nav]);

  const results = useMemo(() => {
    const qq = q.trim().toLowerCase();
    const scored = items.map((it) => ({ it, s: score(qq, `${it.label} ${it.group}`) })).filter((x) => x.s >= 0);
    if (qq) scored.sort((a, b) => b.s - a.s);
    return scored.map((x) => x.it).slice(0, qq ? 40 : 60);
  }, [items, q]);

  useEffect(() => { setActive(0); }, [q]);
  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>(`[data-idx="${active}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  const runItem = (it: Item) => { setOpen(false); it.run(); };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(results.length - 1, a + 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(0, a - 1)); }
    else if (e.key === 'Enter') { e.preventDefault(); const it = results[active]; if (it) runItem(it); }
    else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); setOpen(false); }
    else if (e.key === 'Tab') { e.preventDefault(); } // keep focus inside
  };

  let lastGroup = '';
  return (
    <AnimatePresence>
      {open && (
        <motion.div className="cp-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }} onMouseDown={() => setOpen(false)}>
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="Command palette"
            className="cp glass"
            initial={{ opacity: 0, y: -12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.98 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            onMouseDown={(e) => e.stopPropagation()}
            onKeyDown={onKeyDown}
          >
            <div className="cp-input">
              <Search size={16} />
              <input
                ref={inputRef}
                autoFocus
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search zones, stations, layers, actions…"
                role="combobox"
                aria-expanded="true"
                aria-controls="cp-list"
                aria-activedescendant={results[active] ? `cp-${results[active].id}` : undefined}
                aria-autocomplete="list"
              />
              <kbd className="mono">Esc</kbd>
            </div>
            <ul id="cp-list" role="listbox" ref={listRef} className="cp-list scroll-thin">
              {results.length === 0 && <li className="cp-empty">No matches for “{q}”.</li>}
              {results.map((it, i) => {
                const header = it.group !== lastGroup ? it.group : null;
                lastGroup = it.group;
                const Icon = it.icon;
                return (
                  <li key={it.id} role="presentation">
                    {header && <div className="cp-group eyebrow" role="presentation">{header}</div>}
                    <div
                      id={`cp-${it.id}`}
                      role="option"
                      aria-selected={i === active}
                      data-idx={i}
                      className="cp-item"
                      onMouseMove={() => setActive(i)}
                      onClick={() => runItem(it)}
                    >
                      <Icon size={15} style={{ color: it.color ?? 'var(--text-3)' }} />
                      <span className="cp-label">{it.label}</span>
                      {it.hint && <span className="cp-hint mono" style={{ color: it.color }}>{it.hint}</span>}
                      {i === active && <CornerDownLeft size={13} className="cp-enter" />}
                    </div>
                  </li>
                );
              })}
            </ul>
            <div className="cp-foot mono">
              <span><kbd>↑</kbd><kbd>↓</kbd> navigate</span>
              <span><kbd>↵</kbd> select</span>
              <span><kbd>Ctrl</kbd><kbd>K</kbd> / <kbd>/</kbd> open</span>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
