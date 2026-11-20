import boundaryFc from './gurugram.json';
import generated from './zones.generated.json';
import { ZONE_DEFS } from '../sim/zones';
import type { Zone } from '../data/types';

/*
 * Zone polygons are Voronoi cells around real centroids, clipped to the OSM
 * district boundary. They are computed at build time (scripts/gen-geo.ts,
 * `npm run gen:geo`) so polygon clipping never runs in the browser.
 */

export const BOUNDARY = boundaryFc as GeoJSON.FeatureCollection<GeoJSON.Polygon | GeoJSON.MultiPolygon>;
export const BOUNDARY_FEATURE = BOUNDARY.features[0];
export const BBOX = generated.bbox as [number, number, number, number]; // [minLon, minLat, maxLon, maxLat]

const polyById = Object.fromEntries((generated.zones as { id: string; polygon: Zone['polygon'] }[]).map((z) => [z.id, z.polygon]));

export const ZONES: Zone[] = ZONE_DEFS.map((z) => {
  const polygon = polyById[z.id];
  if (!polygon) throw new Error(`zones.generated.json is missing "${z.id}" — run npm run gen:geo`);
  return { ...z, polygon };
});
export const ZONE_BY_ID: Record<string, Zone> = Object.fromEntries(ZONES.map((z) => [z.id, z]));
