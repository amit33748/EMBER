import type { Snapshot, Zone, Station, IncidentType, Band, Incident, HistoryPoint } from '../data/types';
import { bandOf } from './hazard';

export const RESPONSE_TARGET_MIN = { urban: 8, rural: 15 } as const;
/** One threshold for every "at-risk" KPI (audit C2): High band or above. */
export const AT_RISK_BAND: Band = 2;
/** Response KPIs use a rolling window so a handful of calls can't swing them wildly (audit M10). */
export const RESPONSE_WINDOW_H = 72;

export interface Kpis {
  districtFhs: number;
  districtBand: Band;
  active: number;
  last24h: number;
  last24hDeltaPct: number | null;
  avgResponseMin: number | null;
  compliancePct: number | null;
  avgContainMin: number | null;
  /** sample sizes behind the response KPIs */
  nArrived: number;
  nContained: number;
  atRiskZones: number;
  popAtRisk: number;
  utilization: number; // 0..1 district
  unitsOut: number;
  unitsTotal: number;
  stationLoad: Record<string, { deployed: number; units: number }>;
  typeMix: Record<IncidentType, number>;
  /** next 24 h outlook peak (null if no forecast) */
  nextPeak: { t: number; fhs: number; band: Band } | null;
}

const mean = (a: number[]) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : null);

export interface KpiExtras {
  prev24hCount?: number;
  /** incidents of the last RESPONSE_WINDOW_H hours (falls back to snapshot's 24 h) */
  window?: Incident[];
  forecast?: HistoryPoint[];
}

export function computeKpis(snap: Snapshot, zones: Zone[], stations: Station[], extras: KpiExtras = {}): Kpis {
  const t = snap.t + 5 * 60 * 1000 - 1;
  const zById = Object.fromEntries(zones.map((z) => [z.id, z]));
  const totalPop = zones.reduce((a, z) => a + z.population, 0);
  const districtFhs = snap.zones.reduce((a, s) => a + s.fhs * zById[s.zoneId].population, 0) / totalPop;

  const inc = snap.incidents;
  const win = extras.window ?? inc;
  const active = inc.filter((i) => i.status !== 'closed');
  const arrived = win.filter((i) => i.arrivedAt <= t);
  const resp = arrived.map((i) => (i.arrivedAt - i.reportedAt) / 60000);
  const within = arrived.filter((i) => {
    const target = zById[i.zoneId].urban ? RESPONSE_TARGET_MIN.urban : RESPONSE_TARGET_MIN.rural;
    return (i.arrivedAt - i.reportedAt) / 60000 <= target;
  });
  const containedArr = win.filter((i) => i.containedAt <= t);
  const contained = containedArr.map((i) => (i.containedAt - i.arrivedAt) / 60000);

  const atRisk = snap.zones.filter((s) => s.band >= AT_RISK_BAND);
  const popAtRisk = atRisk.reduce((a, s) => a + zById[s.zoneId].population, 0);

  const stationLoad: Kpis['stationLoad'] = Object.fromEntries(stations.map((s) => [s.id, { deployed: 0, units: s.units }]));
  for (const i of inc) {
    if (i.status === 'reported' || i.status === 'responding') {
      const l = stationLoad[i.stationId];
      if (l) l.deployed = Math.min(l.units, l.deployed + (i.severity === 3 ? 2 : 1));
    }
  }
  const dep = Object.values(stationLoad).reduce((a, l) => a + l.deployed, 0);
  const units = Object.values(stationLoad).reduce((a, l) => a + l.units, 0);

  const typeMix = { building: 0, industrial: 0, vehicle: 0, garbage: 0, scrub: 0, electrical: 0 } as Record<IncidentType, number>;
  for (const i of inc) typeMix[i.type]++;

  let nextPeak: Kpis['nextPeak'] = null;
  if (extras.forecast?.length) {
    const best = extras.forecast.reduce((a, b) => (b.districtFhs > a.districtFhs ? b : a));
    nextPeak = { t: best.t, fhs: best.districtFhs, band: bandOf(best.districtFhs) };
  }

  const prev = extras.prev24hCount;
  return {
    districtFhs,
    districtBand: bandOf(districtFhs),
    active: active.length,
    last24h: inc.length,
    last24hDeltaPct: prev ? ((inc.length - prev) / prev) * 100 : null,
    avgResponseMin: mean(resp),
    compliancePct: arrived.length ? (within.length / arrived.length) * 100 : null,
    avgContainMin: mean(contained),
    nArrived: arrived.length,
    nContained: containedArr.length,
    atRiskZones: atRisk.length,
    popAtRisk,
    utilization: units ? dep / units : 0,
    unitsOut: dep,
    unitsTotal: units,
    stationLoad,
    typeMix,
    nextPeak,
  };
}
