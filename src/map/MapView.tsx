import { useEffect, useRef, useState } from 'react';
import maplibregl, { type Map as MLMap, type GeoJSONSource, type ImageSource } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { useStore, provider } from '../store';
import { useResolvedTheme, cssVar } from '../theme';
import { BOUNDARY, BBOX, ZONES, ZONE_BY_ID } from '../geo/zones';
import { computeDensity, peakOf, columnsGeoJson, buildLut, renderImage, imageCoords, contourGeoJson, type DensityResult } from './density';
import { t } from '../i18n/en';
import { WindParticles, WIND_DOMAIN } from './WindParticles';
import { monthOf } from '../sim/weather';
import { resolveBasemap } from './basemaps';
import type { Snapshot } from '../data/types';

/** India (with a small margin): elevation tiles are only ever fetched inside this box. */
const INDIA_BOUNDS: [number, number, number, number] = [68.0, 6.4, 97.5, 35.8];


const TINT = {
  light: { bg: '#ece5d9', water: '#cdd8d8', land: '#e6dfd2' },
  dark: { bg: '#0d0b09', water: '#10161a', land: '#14110e' },
};

type Variant = 'full' | 'hero';

interface Props {
  variant?: Variant;
  padding?: maplibregl.PaddingOptions;
}

const bandColors = () => [0, 1, 2, 3, 4].map((i) => cssVar(`--hz-${i}`));

function tintStyle(map: MLMap, theme: 'light' | 'dark') {
  const c = TINT[theme];
  for (const l of map.getStyle().layers ?? []) {
    try {
      if (l.type === 'background') map.setPaintProperty(l.id, 'background-color', c.bg);
      else if (l.type === 'fill' && /water/.test(l.id)) map.setPaintProperty(l.id, 'fill-color', c.water);
      else if (l.type === 'fill' && /landcover|landuse|park|wood|grass/.test(l.id)) map.setPaintProperty(l.id, 'fill-opacity', theme === 'dark' ? 0.25 : 0.35);
    } catch { /* some layers use expressions we skip */ }
  }
}

/** Overlays go above every area fill (land, parks, buildings) but below roads/labels drawn after them. */
/** Show/hide every basemap label layer. */
function setSymbols(map: MLMap, on: boolean) {
  for (const l of map.getStyle().layers ?? []) {
    if (l.type === 'symbol') {
      try { map.setLayoutProperty(l.id, 'visibility', on ? 'visible' : 'none'); } catch { /* ignore */ }
    }
  }
}

function firstSymbolId(map: MLMap): string | undefined {
  const layers = map.getStyle().layers ?? [];
  let lastFill = -1;
  layers.forEach((l, i) => { if (l.type === 'fill' || l.type === 'background') lastFill = i; });
  const after = layers.slice(lastFill + 1);
  // vector styles: slot under the first label layer; raster styles (no labels): draw on top
  return after.find((l) => l.type === 'symbol')?.id;
}

function zonesFc(s: Snapshot): GeoJSON.FeatureCollection {
  const colors = bandColors();
  return {
    type: 'FeatureCollection',
    features: s.zones.map((z, i) => ({
      type: 'Feature',
      id: i,
      properties: { id: z.zoneId, name: ZONE_BY_ID[z.zoneId].name, fhs: z.fhs, band: z.band, color: colors[z.band] },
      geometry: ZONE_BY_ID[z.zoneId].polygon,
    })),
  };
}

function pastIncidentsFc(s: Snapshot): GeoJSON.FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: s.incidents
      .filter((i) => i.status === 'closed' || i.status === 'contained')
      .map((i) => ({ type: 'Feature', properties: { sev: i.severity }, geometry: { type: 'Point', coordinates: [i.lon, i.lat] } })),
  };
}

function addOverlays(map: MLMap, theme: 'light' | 'dark', variant: Variant) {
  const before = firstSymbolId(map);
  const accent = cssVar('--accent');
  const line = theme === 'dark' ? 'rgba(255,220,190,0.22)' : 'rgba(40,28,18,0.28)';
  const empty: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: [] };

  // outside-district veil (focus)
  const world: GeoJSON.Feature = {
    type: 'Feature',
    properties: {},
    geometry: {
      type: 'Polygon',
      coordinates: [
        [[-180, -85], [180, -85], [180, 85], [-180, 85], [-180, -85]],
        ...((BOUNDARY.features[0].geometry as GeoJSON.Polygon).coordinates),
      ],
    },
  };
  map.addSource('veil', { type: 'geojson', data: world });
  map.addLayer({ id: 'veil', type: 'fill', source: 'veil', paint: { 'fill-color': TINT[theme].bg, 'fill-opacity': theme === 'dark' ? 0.55 : 0.5 } }, before);

  map.addSource('zones', { type: 'geojson', data: empty });
  map.addLayer({
    id: 'zones-fill', type: 'fill', source: 'zones',
    paint: {
      'fill-color': ['get', 'color'],
      'fill-opacity': ['case', ['boolean', ['feature-state', 'selected'], false], 0.16, ['boolean', ['feature-state', 'hover'], false], 0.09, 0],
    },
  }, before);
  map.addLayer({
    id: 'zones-line', type: 'line', source: 'zones',
    paint: {
      'line-color': ['case', ['boolean', ['feature-state', 'selected'], false], ['get', 'color'], line],
      'line-width': ['case', ['boolean', ['feature-state', 'selected'], false], 2, 0.6],
      'line-dasharray': [2, 2],
    },
  }, before);
  // 3D density columns (1 km cells) — replaces zone plateaus that buried the surface (audit C5)
  map.addSource('columns', { type: 'geojson', data: empty });
  map.addLayer({
    id: 'columns', type: 'fill-extrusion', source: 'columns',
    layout: { visibility: 'none' },
    paint: {
      'fill-extrusion-color': ['get', 'color'],
      'fill-extrusion-height': ['get', 'h'],
      'fill-extrusion-opacity': 0.88,
      'fill-extrusion-vertical-gradient': true,
    } as any,
  });

  map.addSource('contours', { type: 'geojson', data: empty });
  map.addLayer({
    id: 'contours-glow', type: 'line', source: 'contours',
    paint: {
      'line-color': ['match', ['get', 'level'], 1, bandColors()[1], 2, bandColors()[2], 3, bandColors()[3], bandColors()[4]],
      'line-width': 6, 'line-blur': 5, 'line-opacity': theme === 'dark' ? 0.45 : 0.25,
    },
  }, before);
  map.addLayer({
    id: 'contours', type: 'line', source: 'contours',
    paint: {
      'line-color': ['match', ['get', 'level'], 1, bandColors()[1], 2, bandColors()[2], 3, bandColors()[3], bandColors()[4]],
      'line-width': ['match', ['get', 'level'], 1, 0.8, 2, 1, 3, 1.3, 1.6],
      'line-opacity': 0.9,
    },
  }, before);

  map.addSource('boundary', { type: 'geojson', data: BOUNDARY });
  map.addLayer({ id: 'boundary-glow', type: 'line', source: 'boundary', paint: { 'line-color': accent, 'line-width': 8, 'line-blur': 6, 'line-opacity': theme === 'dark' ? 0.35 : 0.18 } });
  map.addLayer({ id: 'boundary', type: 'line', source: 'boundary', paint: { 'line-color': accent, 'line-width': 1.4, 'line-opacity': 0.9 } });

  if (variant === 'full') {
    map.addSource('past', { type: 'geojson', data: empty });
    map.addLayer({
      id: 'past', type: 'circle', source: 'past',
      paint: {
        'circle-radius': ['+', 2, ['get', 'sev']],
        'circle-color': theme === 'dark' ? '#f4ece2' : '#1c1510',
        'circle-opacity': 0.35,
        'circle-stroke-width': 1,
        'circle-stroke-color': theme === 'dark' ? '#0c0a08' : '#f3eee6',
      },
    });
  }
}

/**
 * Relief (elevation sources + hillshade) is added lazily — after the first view has
 * fully rendered and the browser is idle, and after the globe intro — so terrain
 * tiles never compete with the basemap on first paint. The 3D mesh source is only
 * used when the user switches Terrain on. Idempotent.
 */
function addRelief(map: MLMap, theme: 'light' | 'dark') {
  if (map.getSource('dem')) return;
  const before = map.getLayer('veil') ? 'veil' : firstSymbolId(map);
  map.addSource('dem', {
    type: 'raster-dem',
    bounds: INDIA_BOUNDS, // never request elevation tiles outside India
    tiles: ['https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png'],
    encoding: 'terrarium',
    tileSize: 256,
    maxzoom: 13,
    attribution: 'Terrain: Mapzen / AWS Terrain Tiles',
  });
  // Coarser DEM just for the 3D mesh: ~4× fewer tiles to fetch, decode and mesh
  // while pitched. Gurugram's relief (Aravalli ridge) reads fine at z11.
  map.addSource('dem-mesh', {
    type: 'raster-dem',
    bounds: INDIA_BOUNDS, // never request elevation tiles outside India
    tiles: ['https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png'],
    encoding: 'terrarium',
    tileSize: 256,
    maxzoom: 11,
  });
  map.addLayer({
    id: 'hillshade',
    type: 'hillshade',
    source: 'dem',
    minzoom: 6, // no terrain fetches during the globe intro / continental zooms
    paint: {
      'hillshade-exaggeration': theme === 'dark' ? 0.45 : 0.35,
      'hillshade-shadow-color': theme === 'dark' ? '#000000' : '#6b5643',
      'hillshade-highlight-color': theme === 'dark' ? 'rgba(255,220,190,0.12)' : 'rgba(255,255,255,0.6)',
      'hillshade-accent-color': theme === 'dark' ? '#000000' : '#5a4636',
      'hillshade-illumination-direction': 315,
    },
  }, before);

}

/** Run `fn` once the map has painted everything and the main thread is idle. */
function whenIdle(map: MLMap, fn: () => void) {
  map.once('idle', () => {
    const ric = (window as unknown as { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number }).requestIdleCallback;
    if (ric) ric(fn, { timeout: 1500 });
    else setTimeout(fn, 200);
  });
}

export function MapView({ variant = 'full', padding }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MLMap | null>(null);
  const [ready, setReady] = useState(0); // increments on each style load
  const [reliefReady, setReliefReady] = useState(0); // increments when lazy relief is added
  const uiTheme = useResolvedTheme();
  const basemapChoice = useStore((s) => s.basemap);
  // the hero always follows the UI theme; the dashboard uses the user's basemap
  const base = resolveBasemap(variant === 'hero' ? 'auto' : basemapChoice, uiTheme);
  /** `theme` here is the MAP TONE (light/dark basemap), which is what overlays must contrast with */
  const theme = base.tone;
  const themeRef = useRef(theme);
  const baseRef = useRef(base);
  const snapshot = useStore((s) => s.snapshot);
  const surface = useStore((s) => s.surface);
  const layers = useStore((s) => s.layers);
  const selected = useStore((s) => s.selectedZone);
  const selectZone = useStore((s) => s.selectZone);
  const setKde = useStore((s) => s.setKde);
  const kdeParams = useStore((s) => s.kdeParams);
  const [density, setDensity] = useState<DensityResult | null>(null);
  const activeSrc = useRef<'a' | 'b'>('a');
  const markers = useRef<maplibregl.Marker[]>([]);
  const stationMarkers = useRef<maplibregl.Marker[]>([]);
  const windRef = useRef<WindParticles | null>(null);
  const introDone = useRef(variant !== 'full');
  const prevPitchMode = useRef<boolean | null>(null);
  const flyTarget = useStore((s) => s.flyTarget);

  // init
  useEffect(() => {
    if (!ref.current) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let seen = false;
    try { seen = sessionStorage.getItem('ember-intro') === '1'; } catch { /* ignore */ }
    const playIntro = variant === 'full' && !reduce && !seen;
    introDone.current = !playIntro;
    const map = new maplibregl.Map({
      container: ref.current,
      style: baseRef.current.style,
      ...(variant === 'hero'
        ? { center: [76.98, 28.4] as [number, number], zoom: window.innerWidth < 800 ? 9.2 : 10.15 }
        : playIntro
          ? { center: [62, 22] as [number, number], zoom: 1.4 }
          : { bounds: BBOX, fitBoundsOptions: { padding: padding ?? 40 } }),
      attributionControl: { compact: true },
      interactive: variant === 'full',
      pitch: variant === 'hero' ? 48 : 0,
      maxPitch: 60,
      dragRotate: variant === 'full',
    });
    mapRef.current = map;
    if (variant === 'hero' && padding && window.innerWidth >= 800) map.setPadding(padding);
    if (import.meta.env.DEV) (window as unknown as Record<string, unknown>)[`__map_${variant}`] = map;
    if (variant === 'full') {
      map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), 'bottom-right');
    }
    map.on('style.load', () => {
      if (variant === 'full') map.setProjection({ type: 'globe' });
      if (baseRef.current.warm) tintStyle(map, themeRef.current);
      if (variant === 'hero') setSymbols(map, false); // labels fought the headline (audit M7)
      addOverlays(map, themeRef.current, variant);
      activeSrc.current = 'a';
      setReady((n) => n + 1);
      // relief: full map only, never during the intro, never before first paint
      if (variant === 'full') {
        const schedule = () => whenIdle(map, () => {
          if (mapRef.current !== map || !map.isStyleLoaded()) return;
          addRelief(map, themeRef.current);
          setReliefReady((n) => n + 1);
        });
        if (introDone.current) schedule();
        else map.once('moveend', schedule);
      }
    });

    // start attribution collapsed on every viewport (audit M12)
    map.once('load', () => {
      ref.current?.querySelector('.maplibregl-ctrl-attrib')?.classList.remove('maplibregl-compact-show');
    });

    // hover + click on zones
    let hoverId: number | string | undefined;
    const popup = new maplibregl.Popup({ closeButton: false, closeOnClick: false, className: 'ember-popup', offset: 12 });
    if (variant === 'full') {
      map.on('mousemove', 'zones-fill', (e) => {
        const f = e.features?.[0];
        if (!f) return;
        map.getCanvas().style.cursor = 'pointer';
        if (hoverId !== undefined) map.setFeatureState({ source: 'zones', id: hoverId }, { hover: false });
        hoverId = f.id;
        map.setFeatureState({ source: 'zones', id: hoverId! }, { hover: true });
        const p = f.properties as { name: string; fhs: number; band: number };
        popup.setLngLat(e.lngLat).setHTML(
          `<div class="pp-name">${p.name}</div><div class="pp-val"><b style="color:var(--hz-ink-${p.band})">${Math.round(p.fhs)}</b> FHS · ${t.bands[p.band]}</div>`,
        ).addTo(map);
      });
      map.on('mouseleave', 'zones-fill', () => {
        map.getCanvas().style.cursor = '';
        if (hoverId !== undefined) map.setFeatureState({ source: 'zones', id: hoverId }, { hover: false });
        hoverId = undefined;
        popup.remove();
      });
      map.on('click', 'zones-fill', (e) => {
        const id = (e.features?.[0]?.properties as { id: string } | undefined)?.id;
        if (id) selectZone(id);
      });
    }

    // globe -> district fly-in (once per session)
    if (playIntro) {
      map.once('load', () => {
        const cam = map.cameraForBounds(BBOX, { padding: padding ?? 40 });
        if (!cam) { introDone.current = true; return; }
        map.flyTo({ ...cam, duration: 5200, curve: 1.7, essential: true });
        map.once('moveend', () => {
          introDone.current = true;
          try { sessionStorage.setItem('ember-intro', '1'); } catch { /* ignore */ }
        });
      });
    }

    // hero auto-orbit
    let raf = 0;
    if (variant === 'hero' && !reduce) {
      const spin = () => {
        map.setBearing((map.getBearing() + 0.035) % 360);
        raf = requestAnimationFrame(spin);
      };
      map.once('load', () => { raf = requestAnimationFrame(spin); });
    }
    const ro = new ResizeObserver(() => map.resize());
    ro.observe(ref.current);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [variant]);

  // theme swap
  useEffect(() => {
    if (baseRef.current.id === base.id) return;
    baseRef.current = base;
    themeRef.current = base.tone;
    mapRef.current?.setStyle(base.style, { diff: false });
  }, [base]);

  // density compute on new snapshot
  // During fast replay, re-render the surface at most ~7×/s (latest tick wins) so the
  // main thread keeps up with the simulation clock (audit M8).
  const lastKde = useRef(0);
  useEffect(() => {
    let alive = true;
    const run = () => {
      lastKde.current = performance.now();
      computeDensity(snapshot, kdeParams).then((d) => {
        if (!alive) return;
        setDensity(d);
        setKde({ ms: d.ms, peak: peakOf(d.hazard, d.grid) });
      });
    };
    const since = performance.now() - lastKde.current;
    if (useStore.getState().playing && since < 140) {
      const id = window.setTimeout(() => { if (alive) run(); }, 140 - since);
      return () => { alive = false; clearTimeout(id); };
    }
    run();
    return () => { alive = false; };
  }, [snapshot, kdeParams, setKde]);

  // push density image + contours
  const [styleRetry, setStyleRetry] = useState(0);
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready || !density) return;
    // style may be mid-reload (theme swap / terrain): retry once it settles
    if (!(map as unknown as { style?: { _loaded?: boolean } }).style?._loaded) {
      map.once('styledata', () => setStyleRetry((n) => n + 1));
      return;
    }
    const data = surface === 'hazard' ? density.hazard : density.incident;
    const lut = buildLut(bandColors(), theme === 'dark');
    const url = renderImage(data, density.grid, lut);
    const coords = imageCoords(density.grid);
    // Lazily create the A/B image sources with real data (avoids aborting a placeholder load).
    if (!map.getSource('density-a')) {
      for (const k of ['a', 'b'] as const) {
        map.addSource(`density-${k}`, { type: 'image', url, coordinates: coords });
        map.addLayer({
          id: `density-${k}`,
          type: 'raster',
          source: `density-${k}`,
          paint: { 'raster-opacity': k === 'a' ? 1 : 0, 'raster-opacity-transition': { duration: 900, delay: 0 }, 'raster-fade-duration': 0, 'raster-resampling': 'linear' } as any,
        }, 'zones-fill');
      }
      activeSrc.current = 'a';
      (map.getSource('contours') as GeoJSONSource).setData(contourGeoJson(data, density.grid));
      (map.getSource('columns') as GeoJSONSource | undefined)?.setData(columnsGeoJson(data, density.grid, lut));
      return;
    }
    const next = activeSrc.current === 'a' ? 'b' : 'a';
    const src = map.getSource(`density-${next}`) as ImageSource | undefined;
    if (!src) return;
    src.updateImage({ url, coordinates: coords });
    const show = () => {
      if (mapRef.current !== map || !map.getLayer(`density-${next}`)) return;
      map.setPaintProperty(`density-${next}`, 'raster-opacity', 1);
      map.setPaintProperty(`density-${activeSrc.current}`, 'raster-opacity', 0);
      activeSrc.current = next;
    };
    // wait one frame so the new image is uploaded before cross-fading
    requestAnimationFrame(() => requestAnimationFrame(show));
    (map.getSource('contours') as GeoJSONSource).setData(contourGeoJson(data, density.grid));
    (map.getSource('columns') as GeoJSONSource | undefined)?.setData(columnsGeoJson(data, density.grid, lut));
  }, [density, surface, ready, theme, styleRetry]);

  // zones + past incidents data
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    (map.getSource('zones') as GeoJSONSource | undefined)?.setData(zonesFc(snapshot));
    (map.getSource('past') as GeoJSONSource | undefined)?.setData(pastIncidentsFc(snapshot));
  }, [snapshot, ready]);

  // layer visibility
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    const vis = (id: string, on: boolean) => map.getLayer(id) && map.setLayoutProperty(id, 'visibility', on ? 'visible' : 'none');
    vis('contours', layers.contours);
    vis('contours-glow', layers.contours);
    vis('boundary', layers.boundary);
    vis('boundary-glow', layers.boundary);
    vis('past', layers.incidents);
    if (variant === 'full') {
      vis('columns', layers.zones3d);
      // only touch terrain when it actually changes — re-setting it reloads the mesh
      if (layers.terrain) addRelief(map, themeRef.current); // on demand if the user is faster than idle
      const hasTerrain = !!map.getTerrain();
      if (layers.terrain !== hasTerrain) map.setTerrain(layers.terrain ? { source: 'dem-mesh', exaggeration: 3 } : null);
      if (map.getLayer('hillshade')) map.setPaintProperty('hillshade', 'hillshade-exaggeration', layers.terrain ? 0.7 : themeRef.current === 'dark' ? 0.45 : 0.35);
      const pitched = layers.zones3d || layers.terrain;
      setSymbols(map, !pitched); // labels ghost on top of 3D geometry (audit C5)
      if (prevPitchMode.current !== null && prevPitchMode.current !== pitched && introDone.current) {
        map.easeTo({ pitch: pitched ? 50 : 0, bearing: pitched ? -18 : 0, duration: 1200 });
      }
      prevPitchMode.current = pitched;
    }
  }, [layers, ready, reliefReady, variant]);

  // wind particles
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    // Wind streaks are 2D screen projections: in 3D they are both wrong and costly
    // (map.project() samples terrain elevation for 1,500 points per frame) — pause them.
    const pitched3d = variant === 'full' && (layers.terrain || layers.zones3d);
    const want = layers.wind && !reduce && !pitched3d; // opt-in, so phones may use it too (fewer particles)
    if (!want) { windRef.current?.destroy(); windRef.current = null; return; }
    if (!windRef.current) {
      windRef.current = new WindParticles(map, WIND_DOMAIN, window.innerWidth < 900 ? 450 : 900);
      windRef.current.start();
    }
    windRef.current.setTheme(theme);
    windRef.current.setWind(useStore.getState().snapshot.weather, useStore.getState().scenario === 'summer' ? 4 : monthOf(useStore.getState().snapshot.t));
  }, [layers.wind, layers.terrain, layers.zones3d, ready, variant, theme]);
  useEffect(() => { windRef.current?.setWind(snapshot.weather, useStore.getState().scenario === 'summer' ? 4 : monthOf(snapshot.t)); }, [snapshot]);
  useEffect(() => () => { windRef.current?.destroy(); windRef.current = null; }, []);

  // re-frame the district when the screen shape changes (rotation, resize)
  const padKey = padding ? `${padding.top},${padding.right},${padding.bottom},${padding.left}` : '';
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready || variant !== 'full' || !padding || !introDone.current) return;
    map.fitBounds(BBOX, { padding, duration: 600 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [padKey]);

  // external fly-to requests (command palette)
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !flyTarget) return;
    map.flyTo({ center: [flyTarget.lon, flyTarget.lat], zoom: flyTarget.zoom, duration: 1600, essential: true, padding });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flyTarget]);

  // selected zone state + fly
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready || variant !== 'full') return;
    ZONES.forEach((_, i) => map.setFeatureState({ source: 'zones', id: i }, { selected: false }));
    if (!selected) return;
    const idx = ZONES.findIndex((z) => z.id === selected);
    map.setFeatureState({ source: 'zones', id: idx }, { selected: true });
    const z = ZONES[idx];
    map.flyTo({ center: [z.lon, z.lat], zoom: Math.max(map.getZoom(), 11.6), duration: 1400, essential: true, padding });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, ready, variant]);

  // active incident markers (HTML for CSS pulse)
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    markers.current.forEach((m) => m.remove());
    markers.current = [];
    if (!layers.incidents) return;
    for (const i of snapshot.incidents) {
      if (i.status === 'closed' || i.status === 'contained') continue;
      const el = document.createElement('div');
      el.className = `inc-marker sev-${i.severity}`;
      el.setAttribute('aria-hidden', 'true');
      el.innerHTML = '<span class="ring"></span><span class="ring r2"></span><span class="core"></span>';
      if (variant === 'full') {
        el.title = `${t.types[i.type]} · ${t.status[i.status]} · ${ZONE_BY_ID[i.zoneId].name}`;
        el.onclick = () => selectZone(i.zoneId);
      }
      markers.current.push(new maplibregl.Marker({ element: el }).setLngLat([i.lon, i.lat]).addTo(map));
    }
  }, [snapshot, layers.incidents, variant, selectZone]);

  // station markers
  useEffect(() => {
    const map = mapRef.current;
    if (!map || variant !== 'full') return;
    stationMarkers.current.forEach((m) => m.remove());
    stationMarkers.current = [];
    if (!layers.stations) return;
    for (const s of provider.stations()) {
      const el = document.createElement('div');
      el.className = 'st-marker';
      el.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3l9 7v11h-6v-6H9v6H3V10z" fill="currentColor"/></svg>';
      el.title = `${s.name}${s.source === 'approx' ? ' (approx. location)' : ''}`;
      const popup = new maplibregl.Popup({ offset: 14, className: 'ember-popup', closeButton: false }).setHTML(
        `<div class="pp-name">${s.name}</div><div class="pp-val">${s.units} units · ${s.source === 'osm' ? 'OSM location' : 'approx. location'}</div>`,
      );
      stationMarkers.current.push(new maplibregl.Marker({ element: el }).setLngLat([s.lon, s.lat]).setPopup(popup).addTo(map));
    }
  }, [layers.stations, variant]);

  return <div ref={ref} className="map-root" role="region" aria-label="Fire hazard density map of Gurugram district" />;
}
