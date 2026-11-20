// Build-time geometry: Voronoi zones clipped to the OSM district boundary.
// Run: npx vite-node scripts/gen-geo.ts   (also wired as `npm run gen:geo`)
// Moves turf + polygon clipping out of the browser bundle (audit M9).
import { writeFileSync } from 'node:fs';
import { Delaunay } from 'd3-delaunay';
import { intersect, polygon as tPolygon, featureCollection, bbox as tBbox } from '@turf/turf';
import boundaryFc from '../src/geo/gurugram.json';
import { ZONE_DEFS } from '../src/sim/zones';

const BOUNDARY = boundaryFc as GeoJSON.FeatureCollection<GeoJSON.Polygon>;
const bbox = tBbox(BOUNDARY) as [number, number, number, number];
const [x0, y0, x1, y1] = bbox;
const pad = 0.05;
const v = Delaunay.from(ZONE_DEFS.map((z) => [z.lon, z.lat] as [number, number])).voronoi([x0 - pad, y0 - pad, x1 + pad, y1 + pad]);
const round = (n: number) => Math.round(n * 1e5) / 1e5;
const rnd = (g: GeoJSON.Polygon | GeoJSON.MultiPolygon): GeoJSON.Polygon | GeoJSON.MultiPolygon =>
  g.type === 'Polygon'
    ? { type: 'Polygon', coordinates: g.coordinates.map((r) => r.map(([a, b]) => [round(a), round(b)])) }
    : { type: 'MultiPolygon', coordinates: g.coordinates.map((p) => p.map((r) => r.map(([a, b]) => [round(a), round(b)]))) };

const zones = ZONE_DEFS.map((z, i) => {
  const cellPoly = tPolygon([v.cellPolygon(i) as [number, number][]]);
  const clipped = intersect(featureCollection([cellPoly, BOUNDARY.features[0] as any]) as any);
  return { id: z.id, polygon: rnd((clipped?.geometry ?? cellPoly.geometry) as GeoJSON.Polygon) };
});

writeFileSync('src/geo/zones.generated.json', JSON.stringify({ bbox, zones }));
console.log(`wrote ${zones.length} zones`);
