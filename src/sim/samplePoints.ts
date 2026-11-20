import type { Zone } from '../data/types';
import { rng, gauss } from './prng';
import { randomPointIn } from './geoutil';

export interface ZonePoint { lon: number; lat: number; zoneId: string; k: number; h: number }

/**
 * Static hazard sample points per zone: a few hotspot clusters
 * (markets, industrial yards, dump edges) so the KDE surface is organic,
 * not Voronoi-shaped plateaus. Weights change each tick; positions don't.
 */
export function buildSamplePoints(zones: Zone[]): ZonePoint[] {
  const pts: ZonePoint[] = [];
  let hid = 0;
  for (const z of zones) {
    const r = rng('pts', z.id);
    const hotspots = z.urban ? 3 : 2;
    for (let h = 0; h < hotspots; h++) {
      const [hx, hy] = randomPointIn(z.polygon, r, { lon: z.lon, lat: z.lat, sigmaKm: z.urban ? 1.2 : 2.8 }, gauss);
      const k = 0.6 + r() * 0.8; // hotspot intensity
      const id = hid++;
      const n = Math.round(30 + 40 * z.fuel);
      for (let i = 0; i < n; i++) {
        const [lon, lat] = randomPointIn(z.polygon, r, { lon: hx, lat: hy, sigmaKm: 0.5 + r() * 0.9 }, gauss);
        pts.push({ lon, lat, zoneId: z.id, k, h: id });
      }
    }
  }
  return pts;
}
