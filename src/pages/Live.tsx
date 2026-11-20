import { useEffect, useState } from 'react';
import { MapView } from '../map/MapView';
import { ErrorBoundary } from '../ui/ErrorBoundary';
import { TopBar } from '../components/TopBar';
import { KpiRow } from '../components/KpiRow';
import { DistrictPanel } from '../components/DistrictPanel';
import { ZoneDetail } from '../components/ZoneDetail';
import { IncidentTicker } from '../components/IncidentTicker';
import { DensityControls } from '../components/DensityControls';
import { CommandPalette } from '../components/CommandPalette';
import { TimeMachine } from '../components/TimeMachine';
import { useStore } from '../store';
import { t } from '../i18n/en';

export default function Live() {
  const selectZone = useStore((s) => s.selectZone);
  const advance = useStore((s) => s.advance);
  const replay = useStore((s) => s.offset < 0);

  useEffect(() => {
    document.title = 'Live map · Ember Gurugram';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !useStore.getState().paletteOpen) selectZone(null);
      if (import.meta.env.DEV && e.key === ']' && e.altKey) advance(1); // dev: jump one tick
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selectZone, advance]);

  const padding = useMapPadding();
  return (
    <main className="live-root" data-replay={replay || undefined}>
      <h1 className="sr-only">Gurugram live fire hazard map</h1>
      <ErrorBoundary>
        <MapView variant="full" padding={padding} />
      </ErrorBoundary>
      <TopBar />
      <KpiRow />
      <DistrictPanel />
      <ZoneDetail />
      <div className="live-bottom">
        <div className="live-bottom-main">
          <TimeMachine />
          <IncidentTicker />
        </div>
        <DensityControls />
      </div>
      <div className="watermark mono" aria-hidden>{t.simulated}</div>
      <CommandPalette />
    </main>
  );
}

/** Map padding that keeps the district clear of panels on every screen shape. */
function computePadding() {
  const w = window.innerWidth, h = window.innerHeight;
  if (w >= 1600) return { left: 380, right: 60, top: 190, bottom: 70 };
  if (w >= 1280) return { left: 350, right: 60, top: 180, bottom: 70 };
  if (w >= 900) return { left: 320, right: 50, top: 170, bottom: 70 };
  if (h <= 520) return { left: 20, right: 20, top: 110, bottom: 110 }; // landscape phone
  if (w >= 600) return { left: 410, right: 20, top: 200, bottom: 40 }; // tablet portrait, card on the left
  return { left: 16, right: 16, top: 190, bottom: 230 }; // phone
}

function useMapPadding() {
  const [p, setP] = useState(computePadding);
  useEffect(() => {
    const on = () => setP(computePadding());
    window.addEventListener('resize', on);
    window.addEventListener('orientationchange', on);
    return () => { window.removeEventListener('resize', on); window.removeEventListener('orientationchange', on); };
  }, []);
  return p;
}
