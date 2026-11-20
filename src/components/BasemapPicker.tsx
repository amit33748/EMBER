import { Check } from 'lucide-react';
import { useStore } from '../store';
import { BASEMAPS, AUTO_BASEMAP, type BasemapId } from '../map/basemaps';
import { ThemeToggle } from '../ui/ThemeToggle';

/** Grid of basemap cards. Used inside the top-bar popover. */
export function BasemapPicker({ onPick }: { onPick?: () => void }) {
  const choice = useStore((s) => s.basemap);
  const setBasemap = useStore((s) => s.setBasemap);
  const pick = (id: BasemapId) => { setBasemap(id); onPick?.(); };
  const options = [
    { id: AUTO_BASEMAP.id, label: AUTO_BASEMAP.label, note: AUTO_BASEMAP.note, swatch: 'linear-gradient(135deg,#efe8dc 0 50%,#14110e 50% 100%)' },
    ...BASEMAPS.map(({ id, label, note, swatch }) => ({ id, label, note, swatch })),
  ];
  return (
    <div className="bm" role="radiogroup" aria-label="Basemap">
      <div className="eyebrow bm-h">Basemap</div>
      <div className="bm-grid">
        {options.map((o) => (
          <button
            key={o.id}
            type="button"
            role="radio"
            aria-checked={choice === o.id}
            data-on={choice === o.id || undefined}
            className="bm-card"
            title={o.note}
            onClick={() => pick(o.id as BasemapId)}
          >
            <span className="bm-thumb" style={{ background: o.swatch }} aria-hidden>
              {/* real preview of Gurugram rendered by scripts/gen-thumbs.mjs; swatch shows while loading */}
              <img src={`${import.meta.env.BASE_URL}basemaps/${o.id}.jpg`} alt="" loading="lazy" decoding="async" draggable={false} />
              {choice === o.id && <span className="bm-check"><Check size={12} /></span>}
            </span>
            <span className="bm-label">{o.label}</span>
          </button>
        ))}
      </div>
      {/* on phones the top bar has no room for the theme switch, so it lives here */}
      <div className="bm-theme">
        <span className="eyebrow">Theme</span>
        <ThemeToggle />
      </div>
      <p className="bm-note">All open: OpenFreeMap (© OpenStreetMap), Sentinel-2 cloudless by EOX, OpenTopoMap.</p>
    </div>
  );
}
