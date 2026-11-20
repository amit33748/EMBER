import { create } from 'zustand';
import type { Snapshot, HistoryPoint } from './data/types';
import type { DataProvider } from './data/provider';
import { SimulatedProvider, type Scenario } from './data/SimulatedProvider';
import { ZONES } from './geo/zones';
import { computeKpis, RESPONSE_WINDOW_H, type Kpis } from './analysis/kpis';
import { DEFAULT_KDE, type KdeParams } from './map/density';
import { loadBasemapChoice, saveBasemapChoice, type BasemapId } from './map/basemaps';

/** Live binding: swapped when the scenario changes. */
export let provider: DataProvider = new SimulatedProvider(ZONES);

export type Surface = 'hazard' | 'incident';
export interface Layers { contours: boolean; zones3d: boolean; stations: boolean; incidents: boolean; boundary: boolean; wind: boolean; terrain: boolean }

/** Dev aid: ?tick=-3 starts 3 ticks (15 min) in the past. Future offsets are rejected (audit m6). */
function initialOffset(): number {
  if (typeof location === 'undefined') return 0;
  const v = new URLSearchParams(location.search).get('tick');
  return v ? Math.min(0, parseInt(v, 10) || 0) : 0;
}

interface State {
  offset: number;
  now: () => number;
  snapshot: Snapshot;
  history: HistoryPoint[];
  forecast: HistoryPoint[];
  kpis: Kpis;
  scenario: Scenario;
  setScenario: (s: Scenario) => void;
  selectedZone: string | null;
  surface: Surface;
  layers: Layers;
  kde: { ms: number; peak: [number, number] | null } | null;
  refresh: () => void;
  /** Called on real 5-minute boundaries. Keeps a paused replay on the same absolute time (audit m7). */
  tickBoundary: () => void;
  advance: (n?: number) => void;
  setOffset: (n: number) => void;
  playing: boolean;
  setPlaying: (v: boolean) => void;
  selectZone: (id: string | null) => void;
  setSurface: (s: Surface) => void;
  toggleLayer: (k: keyof Layers) => void;
  setKde: (k: { ms: number; peak: [number, number] | null }) => void;
  kdeParams: KdeParams;
  setKdeParams: (p: Partial<KdeParams>) => void;
  flyTarget: { lon: number; lat: number; zoom: number; key: number } | null;
  flyTo: (lon: number, lat: number, zoom?: number) => void;
  basemap: BasemapId;
  setBasemap: (b: BasemapId) => void;
  paletteOpen: boolean;
  setPaletteOpen: (v: boolean) => void;
}

const DAY = 24 * 3600 * 1000;
const prevCountCache = new Map<number, number>();

/**
 * Load state for an offset. When stepping forward by exactly one tick from `prev`
 * (replay playback), the 24 h history is shifted by one point instead of being
 * recomputed — O(1) instead of O(288) (audit M8).
 */
function load(offset: number, prev?: Pick<State, 'snapshot' | 'history'>) {
  const at = Date.now() + offset * provider.tickMs;
  const snapshot = provider.getSnapshot(at);
  const k = snapshot.tick;
  let history: HistoryPoint[];
  if (prev && prev.snapshot.tick === k - 1 && prev.history.length) {
    history = prev.history.slice(1);
    history.push(provider.getHistoryPoint(k));
  } else if (prev && prev.snapshot.tick === k) {
    history = prev.history;
  } else {
    history = provider.getHistory(at);
  }
  const prevTick = k - 288;
  let prevCount = prevCountCache.get(prevTick);
  if (prevCount === undefined) {
    prevCount = provider.getSnapshot(at - DAY).incidents.length;
    prevCountCache.set(prevTick, prevCount);
    if (prevCountCache.size > 3000) prevCountCache.delete(prevCountCache.keys().next().value!);
  }
  const forecast = provider.getForecast(at);
  return {
    snapshot,
    history,
    forecast,
    kpis: computeKpis(snapshot, provider.zones(), provider.stations(), {
      prev24hCount: prevCount,
      window: provider.getIncidentsWindow(at, RESPONSE_WINDOW_H),
      forecast,
    }),
  };
}

const off0 = initialOffset();

export const useStore = create<State>((set, get) => ({
  offset: off0,
  now: () => Date.now() + get().offset * provider.tickMs,
  ...load(off0),
  scenario: 'calendar',
  setScenario: (scenario) => {
    if (scenario === get().scenario) return;
    provider = new SimulatedProvider(ZONES, undefined, scenario);
    prevCountCache.clear();
    set({ scenario, ...load(get().offset) });
  },
  selectedZone: null,
  surface: 'hazard',
  layers: { contours: true, zones3d: false, stations: true, incidents: true, boundary: true, wind: false, terrain: false }, // wind off by default
  kde: null,
  refresh: () => set(load(get().offset, get())),
  tickBoundary: () => {
    const { offset, playing } = get();
    if (offset < 0 && !playing) set({ offset: offset - 1 }); // same absolute moment, nothing to recompute
    else if (offset >= 0) set(load(offset, get()));
  },
  advance: (n = 1) => {
    const offset = get().offset + n;
    set({ offset, ...load(offset, get()) });
  },
  setOffset: (n) => {
    const offset = Math.min(0, Math.round(n));
    if (offset === get().offset) return;
    set({ offset, ...load(offset, get()) });
  },
  playing: false,
  setPlaying: (playing) => set({ playing }),
  selectZone: (id) => set({ selectedZone: id }),
  setSurface: (surface) => set({ surface }),
  toggleLayer: (k) => set({ layers: { ...get().layers, [k]: !get().layers[k] } }),
  setKde: (kde) => set({ kde }),
  kdeParams: DEFAULT_KDE,
  setKdeParams: (p) => set({ kdeParams: { ...get().kdeParams, ...p } }),
  flyTarget: null,
  flyTo: (lon, lat, zoom = 13) => set({ flyTarget: { lon, lat, zoom, key: Date.now() } }),
  basemap: typeof window === 'undefined' ? 'auto' : loadBasemapChoice(),
  setBasemap: (basemap) => { saveBasemapChoice(basemap); set({ basemap }); },
  paletteOpen: false,
  setPaletteOpen: (paletteOpen) => set({ paletteOpen }),
}));
