import type { Incident, IncidentType, IncidentStatus, LandUse, Zone, Station } from '../data/types';
import { rng, poisson, gauss, TICK_MS, TICKS_PER_DAY } from './prng';
import { weatherAt, istHour, monthOf, weatherHazard } from './weather';
import { fhs, activityFactor, FUEL_CAP } from '../analysis/hazard';
import { randomPointIn, distKm } from './geoutil';

/** District-wide mean incidents per day (prototype assumption). */
export const DAILY_RATE = 9;

const TYPE_MIX: Record<LandUse, [IncidentType, number][]> = {
  industrial: [['industrial', 0.5], ['electrical', 0.2], ['vehicle', 0.15], ['garbage', 0.15]],
  landfill: [['garbage', 0.8], ['scrub', 0.15], ['vehicle', 0.05]],
  forest: [['scrub', 0.75], ['garbage', 0.15], ['vehicle', 0.1]],
  market: [['building', 0.45], ['electrical', 0.35], ['garbage', 0.1], ['vehicle', 0.1]],
  residential: [['building', 0.35], ['electrical', 0.3], ['vehicle', 0.2], ['garbage', 0.15]],
  commercial: [['building', 0.35], ['electrical', 0.35], ['vehicle', 0.2], ['garbage', 0.1]],
  rural: [['scrub', 0.4], ['garbage', 0.25], ['vehicle', 0.2], ['building', 0.15]],
};

function pick<T>(r: () => number, mix: [T, number][]): T {
  let x = r();
  for (const [v, p] of mix) {
    if ((x -= p) <= 0) return v;
  }
  return mix[mix.length - 1][0];
}

export function hourFactor(h: number): number {
  return 0.45 + 1.1 * Math.exp(-((h - 17) ** 2) / 20);
}

export function nearestStation(stations: Station[], lon: number, lat: number): { st: Station; km: number } {
  let best = stations[0];
  let bestKm = Infinity;
  for (const s of stations) {
    const d = distKm(lon, lat, s.lon, s.lat);
    if (d < bestKm) { bestKm = d; best = s; }
  }
  return { st: best, km: bestKm };
}

export function generateTickIncidents(tick: number, zones: Zone[], stations: Station[], monthOverride?: number): Incident[] {
  const t0 = tick * TICK_MS;
  const month = monthOverride ?? monthOf(t0);
  const w = weatherAt(t0, monthOverride);
  const ws = weatherHazard(w, month);
  const h = istHour(t0);
  const hf = hourFactor(h);
  const totalPop = zones.reduce((a, z) => a + z.population, 0);
  const totalFuel = zones.reduce((a, z) => a + z.fuel, 0);
  const out: Incident[] = [];

  zones.forEach((z) => {
    const share = 0.6 * (z.population / totalPop) + 0.4 * (z.fuel / totalFuel);
    const base = fhs(ws, Math.min(FUEL_CAP, z.fuel * activityFactor(z.landUse, h, month)), 0);
    const lambda = (DAILY_RATE / TICKS_PER_DAY) * share * hf * Math.pow(base / 42, 1.6);
    const r = rng('inc', tick, z.id);
    const n = poisson(r, lambda);
    for (let i = 0; i < n; i++) {
      const [lon, lat] = randomPointIn(z.polygon, r, { lon: z.lon, lat: z.lat, sigmaKm: z.urban ? 1.6 : 3.5 }, gauss);
      const type = pick(r, TYPE_MIX[z.landUse]);
      const sv = r();
      const severity = (sv < 0.62 - z.fuel * 0.2 ? 1 : sv < 0.92 ? 2 : 3) as 1 | 2 | 3;
      const { st, km } = nearestStation(stations, lon, lat);
      const reportedAt = t0 + Math.floor(r() * TICK_MS);
      const dispatchMin = 0.8 + r() * 1.6;
      const travelMin = (km / (z.urban ? 34 : 45)) * 60 * (1 + 0.3 * r());
      const arrivedAt = reportedAt + (dispatchMin + travelMin) * 60000;
      const containMin = [25, 55, 115][severity - 1] * (0.7 + 0.6 * r());
      const containedAt = arrivedAt + containMin * 60000;
      const closedAt = containedAt + (30 + 60 * r()) * 60000;
      out.push({
        id: `GGN-${tick.toString(36).toUpperCase()}-${z.id.slice(0, 3).toUpperCase()}${i}`,
        type, zoneId: z.id, lon, lat, severity, reportedAt, arrivedAt, containedAt, closedAt,
        stationId: st.id, status: 'reported',
      });
    }
  });
  return out;
}

export function statusAt(inc: Incident, t: number): IncidentStatus {
  if (t >= inc.closedAt) return 'closed';
  if (t >= inc.containedAt) return 'contained';
  if (t >= inc.arrivedAt) return 'responding';
  return 'reported';
}
