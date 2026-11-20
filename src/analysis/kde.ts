import type { PointEvent } from '../data/types';

export interface GridSpec {
  bbox: [number, number, number, number]; // minLon, minLat, maxLon, maxLat
  cellKm: number;
  cols: number;
  rows: number;
  dLon: number;
  dLat: number;
}

export function makeGrid(bbox: GridSpec['bbox'], cellKm = 0.2): GridSpec {
  const midLat = (bbox[1] + bbox[3]) / 2;
  const dLat = cellKm / 110.574;
  const dLon = cellKm / (111.32 * Math.cos((midLat * Math.PI) / 180));
  const cols = Math.ceil((bbox[2] - bbox[0]) / dLon);
  const rows = Math.ceil((bbox[3] - bbox[1]) / dLat);
  return { bbox, cellKm, cols, rows, dLon, dLat };
}

/** Even-odd point-in-polygon on raw rings (fast, no turf). */
function pip(x: number, y: number, rings: number[][][]): boolean {
  let inside = false;
  for (const ring of rings) {
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const xi = ring[i][0], yi = ring[i][1], xj = ring[j][0], yj = ring[j][1];
      if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
    }
  }
  return inside;
}

/** Row 0 = north edge (matches image orientation). */
export function buildMask(g: GridSpec, geom: GeoJSON.Polygon | GeoJSON.MultiPolygon): Uint8Array {
  const polys = geom.type === 'Polygon' ? [geom.coordinates] : geom.coordinates;
  const m = new Uint8Array(g.cols * g.rows);
  for (let r = 0; r < g.rows; r++) {
    const lat = g.bbox[3] - (r + 0.5) * g.dLat;
    for (let c = 0; c < g.cols; c++) {
      const lon = g.bbox[0] + (c + 0.5) * g.dLon;
      if (polys.some((p) => pip(lon, lat, p as number[][][]))) m[r * g.cols + c] = 1;
    }
  }
  return m;
}

/**
 * Quartic (biweight) kernel density estimate.
 * Returns raw density grid + max; caller normalizes.
 */
export function kde(points: PointEvent[], g: GridSpec, bandwidthKm: number, mask?: Uint8Array) {
  const out = new Float32Array(g.cols * g.rows);
  const rad = Math.ceil(bandwidthKm / g.cellKm);
  const h2 = bandwidthKm * bandwidthKm;
  const norm = 3 / (Math.PI * h2);
  for (const p of points) {
    if (p.w <= 0) continue;
    const pc = (p.lon - g.bbox[0]) / g.dLon - 0.5;
    const pr = (g.bbox[3] - p.lat) / g.dLat - 0.5;
    const c0 = Math.max(0, Math.floor(pc - rad)), c1 = Math.min(g.cols - 1, Math.ceil(pc + rad));
    const r0 = Math.max(0, Math.floor(pr - rad)), r1 = Math.min(g.rows - 1, Math.ceil(pr + rad));
    for (let r = r0; r <= r1; r++) {
      const dy = (r - pr) * g.cellKm;
      for (let c = c0; c <= c1; c++) {
        const dx = (c - pc) * g.cellKm;
        const d2 = dx * dx + dy * dy;
        if (d2 >= h2) continue;
        const u = 1 - d2 / h2;
        out[r * g.cols + c] += p.w * norm * u * u;
      }
    }
  }
  let max = 0;
  for (let i = 0; i < out.length; i++) {
    if (mask && !mask[i]) out[i] = 0;
    else if (out[i] > max) max = out[i];
  }
  return { grid: out, max };
}
