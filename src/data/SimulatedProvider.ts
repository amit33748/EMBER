import type { DataProvider } from './provider';
import type { Snapshot, HistoryPoint, Incident, ZoneState, PointEvent, Zone, Station } from './types';
import { TICK_MS, TICKS_PER_DAY, tickOf, smoothNoise } from '../sim/prng';
import { weatherAt, istHour, monthOf, weatherHazard } from '../sim/weather';
import { generateTickIncidents, statusAt } from '../sim/incidents';
import { buildSamplePoints, type ZonePoint } from '../sim/samplePoints';
import { STATIONS } from '../sim/zones';
import { fhs, bandOf, activityFactor, FUEL_CAP } from '../analysis/hazard';

const IGNITION_WINDOW_H = 6;
const IGNITION_DECAY_H = 3;
const IGNITION_TICKS = (IGNITION_WINDOW_H * 3600000) / TICK_MS;

export type Scenario = 'calendar' | 'summer';
export const SCENARIO_MONTH: Record<Scenario, number | undefined> = { calendar: undefined, summer: 4 };

export class SimulatedProvider implements DataProvider {
  readonly label = 'Simulated';
  readonly simulated = true;
  readonly tickMs = TICK_MS;
  private cache = new Map<number, Incident[]>();
  private points: ZonePoint[];
  /** per-hotspot point counts → each hotspot carries mass ∝ its score, not its point count */
  private hotspotScale: Map<number, number>;
  private totalPop: number;
  private month?: number;

  constructor(private zoneList: Zone[], private stationList: Station[] = STATIONS, readonly scenario: Scenario = 'calendar') {
    this.points = buildSamplePoints(zoneList);
    const counts = new Map<number, number>();
    for (const p of this.points) counts.set(p.h, (counts.get(p.h) ?? 0) + 1);
    const avg = this.points.length / counts.size;
    this.hotspotScale = new Map([...counts].map(([h, n]) => [h, avg / n]));
    this.totalPop = zoneList.reduce((a, z) => a + z.population, 0);
    this.month = SCENARIO_MONTH[scenario];
  }

  zones() { return this.zoneList; }
  stations() { return this.stationList; }

  private incidentsForTick(k: number): Incident[] {
    let v = this.cache.get(k);
    if (!v) {
      v = generateTickIncidents(k, this.zoneList, this.stationList, this.month);
      this.cache.set(k, v);
      if (this.cache.size > 4000) this.cache.delete(this.cache.keys().next().value!);
    }
    return v;
  }

  private incidentsRange(k0: number, k1: number): Incident[] {
    const out: Incident[] = [];
    for (let k = k0; k <= k1; k++) {
      const a = this.incidentsForTick(k);
      for (let i = 0; i < a.length; i++) out.push(a[i]);
    }
    return out;
  }

  private zoneStates(t: number, recent: Incident[]): ZoneState[] {
    const month = this.month ?? monthOf(t);
    const ws = weatherHazard(weatherAt(t, this.month), month);
    const h = istHour(t);
    const pressure: Record<string, number> = {};
    for (const i of recent) {
      const ageH = (t - i.reportedAt) / 3600000;
      if (ageH < 0 || ageH > IGNITION_WINDOW_H) continue;
      pressure[i.zoneId] = (pressure[i.zoneId] ?? 0) + i.severity * Math.exp(-ageH / IGNITION_DECAY_H);
    }
    return this.zoneList.map((z) => {
      const fuel = Math.min(FUEL_CAP, z.fuel * activityFactor(z.landUse, h, month));
      const ignition = 100 * (1 - Math.exp(-(pressure[z.id] ?? 0) / 1.2));
      const score = fhs(ws, fuel, ignition);
      return { zoneId: z.id, fhs: score, band: bandOf(score), weather: ws, fuel, ignition };
    });
  }

  private districtOf(zs: ZoneState[]): number {
    let d = 0;
    zs.forEach((s, idx) => { d += s.fhs * this.zoneList[idx].population; });
    return d / this.totalPop;
  }

  getSnapshot(at = Date.now()): Snapshot {
    const k = tickOf(at);
    const t = k * TICK_MS + TICK_MS - 1; // state as of end of tick
    const raw = this.incidentsRange(k - TICKS_PER_DAY, k).filter((i) => i.reportedAt <= t);
    const incidents = raw.map((i) => ({ ...i, status: statusAt(i, t) }));
    const zones = this.zoneStates(t, incidents);
    const zf: Record<string, number> = Object.fromEntries(zones.map((z) => [z.zoneId, z.fhs]));
    const hours = t / 3600000;
    const hazardPoints: PointEvent[] = this.points.map((p) => ({
      lon: p.lon,
      lat: p.lat,
      // hotspot-level jitter so the peak cell can move between ticks
      w: p.k * this.hotspotScale.get(p.h)! * Math.pow(zf[p.zoneId] / 100, 3) * (1 + 0.45 * smoothNoise(`hs${p.h}`, hours / 2)),
    }));
    for (const i of incidents) {
      if (i.status === 'closed') continue;
      hazardPoints.push({ lon: i.lon, lat: i.lat, w: 1.2 * i.severity });
    }
    return { tick: k, t: k * TICK_MS, weather: weatherAt(t, this.month), zones, incidents, hazardPoints };
  }

  /** One history point for tick j (used for incremental history while replaying). */
  getHistoryPoint(j: number): HistoryPoint {
    const t = j * TICK_MS + TICK_MS - 1;
    const recent = this.incidentsRange(j - IGNITION_TICKS - 1, j).filter((i) => i.reportedAt <= t);
    const zs = this.zoneStates(t, recent);
    const zoneFhs: Record<string, number> = {};
    zs.forEach((s) => { zoneFhs[s.zoneId] = s.fhs; });
    const active = this.incidentsRange(j - 72, j).filter((i) => i.reportedAt <= t && i.closedAt > t).length;
    return { t: j * TICK_MS, districtFhs: this.districtOf(zs), zoneFhs, active };
  }

  getHistory(at = Date.now()): HistoryPoint[] {
    const k = tickOf(at);
    const out: HistoryPoint[] = [];
    for (let j = k - TICKS_PER_DAY + 1; j <= k; j++) out.push(this.getHistoryPoint(j));
    return out;
  }

  /** Weather-driven outlook for the next 24 h (no new incidents; current ones decay). */
  getForecast(at = Date.now()): HistoryPoint[] {
    const k = tickOf(at);
    const t0 = k * TICK_MS + TICK_MS - 1;
    const recent = this.incidentsRange(k - IGNITION_TICKS - 1, k).filter((i) => i.reportedAt <= t0);
    const out: HistoryPoint[] = [];
    for (let j = k + 1; j <= k + TICKS_PER_DAY; j += 3) {
      const t = j * TICK_MS + TICK_MS - 1;
      const zs = this.zoneStates(t, recent);
      const zoneFhs: Record<string, number> = {};
      zs.forEach((s) => { zoneFhs[s.zoneId] = s.fhs; });
      out.push({ t: j * TICK_MS, districtFhs: this.districtOf(zs), zoneFhs, active: 0 });
    }
    return out;
  }

  /** Incidents reported in the last `hours`, with status as of `at`. */
  getIncidentsWindow(at: number, hours: number): Incident[] {
    const k = tickOf(at);
    const t = k * TICK_MS + TICK_MS - 1;
    const ticks = Math.round((hours * 3600000) / TICK_MS);
    return this.incidentsRange(k - ticks, k).filter((i) => i.reportedAt <= t).map((i) => ({ ...i, status: statusAt(i, t) }));
  }
}
