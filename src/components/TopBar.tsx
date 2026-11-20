import { useEffect, useRef, useState } from 'react';
import { Layers3, Flame, Radar, Building2, MapPinned, SlidersHorizontal, X, Wind, Mountain, Search, Map as MapIcon } from 'lucide-react';
import { BasemapPicker } from './BasemapPicker';
import { useStore, type Layers } from '../store';
import { useCountdown } from '../data/useLiveData';
import { Wordmark } from '../ui/Wordmark';
import { ThemeToggle } from '../ui/ThemeToggle';
import { t } from '../i18n/en';

const LAYER_OPTS: { k: keyof Layers; label: string; icon: typeof Flame }[] = [
  { k: 'contours', label: 'Contours', icon: Radar },
  { k: 'zones3d', label: '3D density', icon: Layers3 },
  { k: 'incidents', label: 'Incidents', icon: Flame },
  { k: 'stations', label: 'Stations', icon: Building2 },
  { k: 'wind', label: 'Wind', icon: Wind },
  { k: 'terrain', label: 'Terrain', icon: Mountain },
  { k: 'boundary', label: 'Boundary', icon: MapPinned },
];

export function LiveBadge() {
  const left = useCountdown();
  const offset = useStore((s) => s.offset);
  const summer = useStore((s) => s.scenario === 'summer');
  if (offset < 0) {
    return (
      <div className="live-badge" data-replay title="Viewing simulated history">
        <span className="live-dot replay" aria-hidden />
        <span className="mono">REPLAY</span>
        <span className="live-sep" aria-hidden />
        <span className="mono live-sim">{summer ? 'SIM·MAY' : 'SIM'}</span>
      </div>
    );
  }
  const mm = String(Math.floor(left / 60)).padStart(2, '0');
  const ss = String(left % 60).padStart(2, '0');
  return (
    <div className="live-badge" title={t.simulated}>
      <span className="live-dot" aria-hidden />
      <span className="mono">{t.live}</span>
      <span className="live-sep" aria-hidden />
      <span className="mono live-sim" title={summer ? 'Summer-peak scenario (May weather)' : undefined}>{summer ? 'SIM·MAY' : 'SIM'}</span>
      <span className="live-sep" aria-hidden />
      <span className="mono" aria-label={`${t.nextUpdate} in ${mm} minutes ${ss} seconds`}>
        <span className="live-next">{t.nextUpdate} </span>{mm}:{ss}
      </span>
    </div>
  );
}

export function TopBar() {
  const surface = useStore((s) => s.surface);
  const setSurface = useStore((s) => s.setSurface);
  const layers = useStore((s) => s.layers);
  const toggle = useStore((s) => s.toggleLayer);
  const [open, setOpen] = useState(false);
  const [bmOpen, setBmOpen] = useState(false);
  const setPaletteOpen = useStore((s) => s.setPaletteOpen);
  const ref = useRef<HTMLElement>(null);
  // publish the real bar height so the KPI strip never sits under a wrapped bar (audit C4)
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(() => document.documentElement.style.setProperty('--topbar-bottom', `${Math.round(el.getBoundingClientRect().bottom)}px`));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // layers popover: close on outside tap or Escape
  useEffect(() => {
    if (!open && !bmOpen) return;
    const close = () => { setOpen(false); setBmOpen(false); };
    const onDown = (e: PointerEvent) => { if (!ref.current?.contains(e.target as Node)) close(); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    window.addEventListener('pointerdown', onDown);
    window.addEventListener('keydown', onKey);
    return () => { window.removeEventListener('pointerdown', onDown); window.removeEventListener('keydown', onKey); };
  }, [open, bmOpen]);

  const layerButtons = LAYER_OPTS.map(({ k, label, icon: Icon }) => (
    <button
      key={k}
      type="button"
      className="chip"
      aria-pressed={layers[k]}
      data-on={layers[k] || undefined}
      data-paused={(k === 'wind' && layers.wind && (layers.terrain || layers.zones3d)) || undefined}
      title={k === 'wind' && (layers.terrain || layers.zones3d) ? 'Wind streaks pause in 3D views (they are 2D overlays)' : undefined}
      onClick={() => toggle(k)}
    >
      <Icon size={14} />
      <span>{label}</span>
    </button>
  ));

  return (
    <header ref={ref} className="topbar glass">
      <div className="flex items-center gap-3 min-w-0">
        <Wordmark />
        <div className="topbar-title">
          <span>{t.product}</span>
          <span className="eyebrow">Haryana · India</span>
        </div>
      </div>

      <div role="radiogroup" aria-label="Density surface" className="seg seg-text">
        <button type="button" role="radio" aria-checked={surface === 'hazard'} data-on={surface === 'hazard' || undefined} className="seg-btn" onClick={() => setSurface('hazard')}>
          Hazard density
        </button>
        <button type="button" role="radio" aria-checked={surface === 'incident'} data-on={surface === 'incident' || undefined} className="seg-btn" onClick={() => setSurface('incident')}>
          Incident density
        </button>
      </div>

      <div className="topbar-layers">{layerButtons}</div>

      <div className="flex items-center gap-2">
        <button type="button" className="search-btn" onClick={() => setPaletteOpen(true)} aria-label="Search zones, stations and actions" aria-keyshortcuts="Control+K Meta+K">
          <Search size={14} />
          <span>Search</span>
          <kbd className="mono">Ctrl K</kbd>
        </button>
        <LiveBadge />
        <ThemeToggle />
        <button type="button" className="icon-btn" aria-label="Basemap" title="Basemap" aria-expanded={bmOpen} data-on={bmOpen || undefined} onClick={() => { setBmOpen((v) => !v); setOpen(false); }}>
          <MapIcon size={16} />
        </button>
        <button type="button" className="icon-btn topbar-menu" aria-label="Map layers" aria-expanded={open} onClick={() => { setOpen((v) => !v); setBmOpen(false); }}>
          {open ? <X size={16} /> : <SlidersHorizontal size={16} />}
        </button>
      </div>

      {open && <div className="layers-pop glass">{layerButtons}</div>}
      {bmOpen && <div className="layers-pop bm-pop glass"><BasemapPicker /></div>}
    </header>
  );
}
