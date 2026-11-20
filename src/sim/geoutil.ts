export const KM_PER_DEG_LAT = 110.574;
export const kmPerDegLon = (lat: number) => 111.32 * Math.cos((lat * Math.PI) / 180);

export function distKm(aLon: number, aLat: number, bLon: number, bLat: number): number {
  const dx = (aLon - bLon) * kmPerDegLon((aLat + bLat) / 2);
  const dy = (aLat - bLat) * KM_PER_DEG_LAT;
  return Math.hypot(dx, dy);
}

type Poly = GeoJSON.Polygon | GeoJSON.MultiPolygon;
interface Prepared { bbox: [number, number, number, number]; polys: number[][][][] }
const prepCache = new WeakMap<Poly, Prepared>();

/** Cache bbox + ring arrays per polygon object (turf recomputed the bbox on every call). */
function prepare(g: Poly): Prepared {
  let p = prepCache.get(g);
  if (!p) {
    const polys = (g.type === 'Polygon' ? [g.coordinates] : g.coordinates) as number[][][][];
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const poly of polys) for (const [x, y] of poly[0]) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    p = { bbox: [x0, y0, x1, y1], polys };
    prepCache.set(g, p);
  }
  return p;
}

/** Even-odd point-in-polygon with bbox pre-check. */
export function pointInPoly(lon: number, lat: number, g: Poly): boolean {
  const p = prepare(g);
  const [x0, y0, x1, y1] = p.bbox;
  if (lon < x0 || lon > x1 || lat < y0 || lat > y1) return false;
  for (const poly of p.polys) {
    let inside = false;
    for (const ring of poly) {
      for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
        const xi = ring[i][0], yi = ring[i][1], xj = ring[j][0], yj = ring[j][1];
        if (yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
      }
    }
    if (inside) return true;
  }
  return false;
}

/** Rejection-sample a point inside polygon. Falls back to fallback point. */
export function randomPointIn(
  poly: GeoJSON.Polygon | GeoJSON.MultiPolygon,
  r: () => number,
  near?: { lon: number; lat: number; sigmaKm: number },
  gauss?: (r: () => number) => number,
): [number, number] {
  const [x0, y0, x1, y1] = prepare(poly).bbox;
  for (let i = 0; i < 40; i++) {
    let lon: number, lat: number;
    if (near && gauss) {
      lon = near.lon + (gauss(r) * near.sigmaKm) / kmPerDegLon(near.lat);
      lat = near.lat + (gauss(r) * near.sigmaKm) / KM_PER_DEG_LAT;
    } else {
      lon = x0 + r() * (x1 - x0);
      lat = y0 + r() * (y1 - y0);
    }
    if (pointInPoly(lon, lat, poly)) return [lon, lat];
  }
  return near ? [near.lon, near.lat] : [(x0 + x1) / 2, (y0 + y1) / 2];
}
