import type { StyleSpecification } from 'maplibre-gl';

/**
 * Open basemaps only (no API keys, open licences).
 * `tone` tells overlays (density colours, wind, veil) whether the map underneath is light or dark.
 * `warm` = apply Ember's paper/soot tint (only to the neutral OpenFreeMap styles).
 */
export interface Basemap {
  id: BasemapId;
  label: string;
  note: string;
  tone: 'light' | 'dark';
  warm?: boolean;
  /** CSS background used for the picker thumbnail */
  swatch: string;
  style: string | StyleSpecification;
}

export type BasemapId = 'auto' | 'positron' | 'dark' | 'liberty' | 'bright' | 'fiord' | 'satellite' | 'topo';

const raster = (tiles: string[], attribution: string, maxzoom: number, tileSize = 256): StyleSpecification => ({
  version: 8,
  sources: { base: { type: 'raster', tiles, tileSize, maxzoom, attribution } },
  layers: [
    { id: 'background', type: 'background', paint: { 'background-color': '#0b0f14' } },
    { id: 'base', type: 'raster', source: 'base', paint: { 'raster-fade-duration': 150 } },
  ],
});

export const BASEMAPS: Basemap[] = [
  { id: 'positron', label: 'Paper', note: 'OpenFreeMap Positron, warm-tinted', tone: 'light', warm: true,
    swatch: 'linear-gradient(135deg,#efe8dc 0 60%,#d6dcdc 60% 100%)', style: 'https://tiles.openfreemap.org/styles/positron' },
  { id: 'dark', label: 'Soot', note: 'OpenFreeMap Dark, warm-tinted', tone: 'dark', warm: true,
    swatch: 'linear-gradient(135deg,#14110e 0 60%,#10161a 60% 100%)', style: 'https://tiles.openfreemap.org/styles/dark' },
  { id: 'liberty', label: 'Liberty', note: 'OpenFreeMap Liberty — full colour streets', tone: 'light',
    swatch: 'linear-gradient(135deg,#f6f1e6 0 40%,#c9e3b4 40% 62%,#a8d1ea 62% 100%)', style: 'https://tiles.openfreemap.org/styles/liberty' },
  { id: 'bright', label: 'Bright', note: 'OpenFreeMap Bright — OSM classic', tone: 'light',
    swatch: 'linear-gradient(135deg,#f8f4f0 0 45%,#f9d9a6 45% 60%,#aad3df 60% 100%)', style: 'https://tiles.openfreemap.org/styles/bright' },
  { id: 'fiord', label: 'Fiord', note: 'OpenFreeMap Fiord — night blue', tone: 'dark',
    swatch: 'linear-gradient(135deg,#45516e 0 55%,#38415a 55% 100%)', style: 'https://tiles.openfreemap.org/styles/fiord' },
  { id: 'satellite', label: 'Satellite', note: 'Sentinel-2 cloudless 2020 by EOX (CC BY-NC-SA 4.0) — prototype use', tone: 'dark',
    swatch: 'linear-gradient(135deg,#5b6b3e 0 35%,#8b7a55 35% 65%,#2f4a5c 65% 100%)',
    style: raster(
      ['https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless-2020_3857/default/g/{z}/{y}/{x}.jpg'],
      '<a href="https://s2maps.eu" target="_blank" rel="noreferrer">Sentinel-2 cloudless 2020</a> by EOX IT Services GmbH (contains modified Copernicus Sentinel data 2020)',
      14,
    ) },
  { id: 'topo', label: 'Topographic', note: 'OpenTopoMap (CC BY-SA) — contours & relief', tone: 'light',
    swatch: 'repeating-radial-gradient(circle at 30% 70%,#e9e4c8 0 6px,#d9cfa5 6px 7px),#e9e4c8',
    style: raster(
      ['https://a.tile.opentopomap.org/{z}/{x}/{y}.png', 'https://b.tile.opentopomap.org/{z}/{x}/{y}.png', 'https://c.tile.opentopomap.org/{z}/{x}/{y}.png'],
      'Map data © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors, SRTM · Style © <a href="https://opentopomap.org" target="_blank" rel="noreferrer">OpenTopoMap</a> (CC BY-SA)',
      17,
    ) },
];

export const AUTO_BASEMAP = { id: 'auto' as const, label: 'Auto', note: 'Paper in light theme, Soot in dark theme' };

/** Resolve the effective basemap for a choice + UI theme. */
export function resolveBasemap(choice: BasemapId, theme: 'light' | 'dark'): Basemap {
  if (choice === 'auto') return BASEMAPS.find((b) => b.id === (theme === 'dark' ? 'dark' : 'positron'))!;
  return BASEMAPS.find((b) => b.id === choice) ?? BASEMAPS[0];
}

const KEY = 'ember-basemap';
export function loadBasemapChoice(): BasemapId {
  try {
    const v = localStorage.getItem(KEY) as BasemapId | null;
    if (v && (v === 'auto' || BASEMAPS.some((b) => b.id === v))) return v;
  } catch { /* ignore */ }
  return 'auto';
}
export function saveBasemapChoice(v: BasemapId) {
  try { localStorage.setItem(KEY, v); } catch { /* ignore */ }
}
