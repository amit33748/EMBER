/// <reference lib="webworker" />
import { kde, buildMask, makeGrid, type GridSpec } from './kde';
import type { PointEvent } from '../data/types';

let grid: GridSpec | null = null;
let mask: Uint8Array | null = null;

export interface KdeRequest {
  id: number;
  bbox?: GridSpec['bbox'];
  boundary?: GeoJSON.Polygon | GeoJSON.MultiPolygon;
  cellKm?: number;
  layers: { key: string; points: PointEvent[]; bandwidthKm: number }[];
}
export interface KdeResponse {
  id: number;
  grid: GridSpec;
  layers: { key: string; data: Float32Array; max: number }[];
  ms: number;
}

self.onmessage = (e: MessageEvent<KdeRequest>) => {
  const t0 = performance.now();
  const req = e.data;
  if (req.bbox && req.boundary) {
    grid = makeGrid(req.bbox, req.cellKm ?? 0.2);
    mask = buildMask(grid, req.boundary);
  }
  if (!grid) return;
  const layers = req.layers.map((l) => {
    const { grid: data, max } = kde(l.points, grid!, l.bandwidthKm, mask ?? undefined);
    // normalize 0..1 with soft gamma for visual range
    if (max > 0) for (let i = 0; i < data.length; i++) data[i] = Math.pow(data[i] / max, 0.6);
    return { key: l.key, data, max };
  });
  const res: KdeResponse = { id: req.id, grid, layers, ms: performance.now() - t0 };
  (self as unknown as Worker).postMessage(res, layers.map((l) => l.data.buffer));
};
