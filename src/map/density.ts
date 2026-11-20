import { contours as d3contours } from 'd3-contour';
import type { Snapshot, PointEvent } from '../data/types';
import type { GridSpec } from '../analysis/kde';
import type { KdeRequest, KdeResponse } from '../analysis/kde.worker';
import { BBOX, BOUNDARY_FEATURE } from '../geo/zones';

export const BANDWIDTH_KM = { hazard: 1.4, incident: 1.8 } as const;
export const CONTOUR_LEVELS = [0.3, 0.5, 0.7, 0.88];

export interface DensityResult {
  grid: GridSpec;
  hazard: Float32Array;
  incident: Float32Array;
  ms: number;
}

let worker: Worker | null = null;
let seq = 0;
let initialised = false;
const pending = new Map<number, (r: KdeResponse) => void>();

function getWorker(): Worker {
  if (!worker) {
    worker = new Worker(new URL('../analysis/kde.worker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = (e: MessageEvent<KdeResponse>) => {
      pending.get(e.data.id)?.(e.data);
      pending.delete(e.data.id);
    };
  }
  return worker;
}

export interface KdeParams {
  bandwidthKm: number; // hazard surface; incident surface uses ×1.3
  windowH: 1 | 6 | 24; // incident surface time window
  weighting: 'severity' | 'count';
}
export const DEFAULT_KDE: KdeParams = { bandwidthKm: BANDWIDTH_KM.hazard, windowH: 24, weighting: 'severity' };

export function incidentPoints(s: Snapshot, p: KdeParams = DEFAULT_KDE): PointEvent[] {
  const t = s.t;
  return s.incidents
    .filter((i) => t - i.reportedAt <= p.windowH * 3600000)
    .map((i) => ({
      lon: i.lon,
      lat: i.lat,
      w: p.weighting === 'count' ? 1 : i.severity * Math.exp(-Math.max(0, t - i.reportedAt) / 3600000 / 8),
    }));
}

export function computeDensity(s: Snapshot, p: KdeParams = DEFAULT_KDE): Promise<DensityResult> {
  const w = getWorker();
  const id = ++seq;
  const req: KdeRequest = {
    id,
    layers: [
      { key: 'hazard', points: s.hazardPoints, bandwidthKm: p.bandwidthKm },
      { key: 'incident', points: incidentPoints(s, p), bandwidthKm: p.bandwidthKm * 1.3 },
    ],
  };
  if (!initialised) {
    req.bbox = BBOX;
    req.boundary = BOUNDARY_FEATURE.geometry;
    req.cellKm = 0.2;
    initialised = true;
  }
  return new Promise((resolve) => {
    pending.set(id, (r) => {
      const get = (k: string) => r.layers.find((l) => l.key === k)!.data;
      resolve({ grid: r.grid, hazard: get('hazard'), incident: get('incident'), ms: r.ms });
    });
    w.postMessage(req);
  });
}

/* ── rendering ── */

function hexToRgb(h: string): [number, number, number] {
  const s = h.replace('#', '');
  const n = parseInt(s.length === 3 ? s.split('').map((c) => c + c).join('') : s, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export type Ramp = [number, number, number][]; // 5 band colours

const STOPS = [0.12, 0.35, 0.58, 0.8, 1];

/** Build a 256-entry RGBA lookup from 5 band colours. */
export function buildLut(colors: string[], dark: boolean): Uint8ClampedArray {
  // On cream, a translucent teal low band reads as grey-green dirt (audit M6):
  // light theme starts the ramp at amber instead.
  const rgb = (dark ? colors : [colors[1], colors[1], colors[2], colors[3], colors[4]]).map(hexToRgb);
  const lut = new Uint8ClampedArray(256 * 4);
  for (let i = 0; i < 256; i++) {
    const v = i / 255;
    let c: [number, number, number];
    if (v <= STOPS[0]) c = rgb[0];
    else {
      let k = 0;
      while (k < STOPS.length - 1 && v > STOPS[k + 1]) k++;
      const f = Math.min(1, (v - STOPS[k]) / (STOPS[k + 1] - STOPS[k]));
      const a = rgb[k], b = rgb[Math.min(k + 1, 4)];
      c = [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f];
    }
    const sm = Math.min(1, Math.max(0, (v - 0.02) / 0.22));
    const alpha = sm * sm * (3 - 2 * sm) * ((dark ? 0.5 : 0.3) + (dark ? 0.45 : 0.55) * v);
    lut.set([c[0], c[1], c[2], Math.round(alpha * 255)], i * 4);
  }
  return lut;
}

export function renderImage(data: Float32Array, g: GridSpec, lut: Uint8ClampedArray): string {
  const canvas = document.createElement('canvas');
  canvas.width = g.cols;
  canvas.height = g.rows;
  const ctx = canvas.getContext('2d')!;
  const img = ctx.createImageData(g.cols, g.rows);
  for (let i = 0; i < data.length; i++) {
    const j = Math.min(255, Math.max(0, Math.round(data[i] * 255))) * 4;
    img.data[i * 4] = lut[j];
    img.data[i * 4 + 1] = lut[j + 1];
    img.data[i * 4 + 2] = lut[j + 2];
    img.data[i * 4 + 3] = lut[j + 3];
  }
  ctx.putImageData(img, 0, 0);
  return canvas.toDataURL('image/png');
}

export function imageCoords(g: GridSpec): [[number, number], [number, number], [number, number], [number, number]] {
  const x0 = g.bbox[0], y1 = g.bbox[3];
  const x1 = x0 + g.cols * g.dLon, y0 = y1 - g.rows * g.dLat;
  return [[x0, y1], [x1, y1], [x1, y0], [x0, y0]];
}

export function contourGeoJson(data: Float32Array, g: GridSpec): GeoJSON.FeatureCollection {
  const gen = d3contours().size([g.cols, g.rows]).thresholds(CONTOUR_LEVELS);
  const polys = gen(Array.from(data));
  return {
    type: 'FeatureCollection',
    features: polys.map((p, idx) => ({
      type: 'Feature',
      properties: { level: idx + 1, value: p.value },
      geometry: {
        type: 'MultiPolygon',
        coordinates: p.coordinates.map((poly) =>
          poly.map((ring) => ring.map(([x, y]) => [g.bbox[0] + x * g.dLon, g.bbox[3] - y * g.dLat])),
        ),
      },
    })),
  };
}

export function peakOf(data: Float32Array, g: GridSpec): [number, number] | null {
  let mi = -1, mv = 0;
  for (let i = 0; i < data.length; i++) if (data[i] > mv) { mv = data[i]; mi = i; }
  if (mi < 0) return null;
  const c = mi % g.cols, r = Math.floor(mi / g.cols);
  return [g.bbox[0] + (c + 0.5) * g.dLon, g.bbox[3] - (r + 0.5) * g.dLat];
}

/**
 * 3D columns: aggregate the density grid into ~1 km cells (max of 5×5 block),
 * height ∝ density, colour from the same LUT as the raster.
 */
export function columnsGeoJson(data: Float32Array, g: GridSpec, lut: Uint8ClampedArray, block = 5): GeoJSON.FeatureCollection {
  const features: GeoJSON.Feature[] = [];
  const inset = 0.14;
  for (let r0 = 0; r0 < g.rows; r0 += block) {
    for (let c0 = 0; c0 < g.cols; c0 += block) {
      let v = 0;
      for (let r = r0; r < Math.min(g.rows, r0 + block); r++) {
        for (let c = c0; c < Math.min(g.cols, c0 + block); c++) v = Math.max(v, data[r * g.cols + c]);
      }
      if (v < 0.14) continue;
      const j = Math.min(255, Math.round(v * 255)) * 4;
      const x0 = g.bbox[0] + (c0 + block * inset) * g.dLon, x1 = g.bbox[0] + (c0 + block * (1 - inset)) * g.dLon;
      const y1 = g.bbox[3] - (r0 + block * inset) * g.dLat, y0 = g.bbox[3] - (r0 + block * (1 - inset)) * g.dLat;
      features.push({
        type: 'Feature',
        properties: { h: Math.round(Math.pow(v, 1.4) * 1400), color: `rgb(${lut[j]},${lut[j + 1]},${lut[j + 2]})` },
        geometry: { type: 'Polygon', coordinates: [[[x0, y0], [x1, y0], [x1, y1], [x0, y1], [x0, y0]]] },
      });
    }
  }
  return { type: 'FeatureCollection', features };
}
