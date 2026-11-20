import type { WeatherObs } from '../data/types';
import { smoothNoise } from './prng';
import { ffwi, weatherScore } from '../analysis/hazard';

/** Approximate Gurugram monthly climatology: [Tmax °C, Tmin °C, RH %, wind km/h]. */
const CLIMATE: [number, number, number, number][] = [
  [20, 7, 70, 6], [24, 10, 60, 7], [30, 15, 48, 8], [37, 21, 32, 10],
  [41, 26, 30, 12], [40, 28, 45, 12], [35, 27, 72, 10], [33, 26, 78, 9],
  [33, 24, 70, 8], [32, 18, 55, 6], [27, 12, 55, 5], [22, 8, 65, 5],
];

const IST_OFFSET = 5.5 * 3600 * 1000;

export function istHour(t: number): number {
  const d = new Date(t + IST_OFFSET);
  return d.getUTCHours() + d.getUTCMinutes() / 60;
}

export function monthOf(t: number): number {
  return new Date(t + IST_OFFSET).getUTCMonth();
}

export function weatherAt(t: number, monthOverride?: number): WeatherObs {
  const month = monthOverride ?? monthOf(t);
  const [tmax, tmin, rhMean, wind] = CLIMATE[month];
  const h = istHour(t);
  const hours = t / 3600000;

  // diurnal: min ~06:00, max ~15:00
  const diurnal = Math.cos(((h - 15) / 24) * 2 * Math.PI); // 1 at 15h, -1 at 03h
  const synoptic = smoothNoise('temp', hours / 30) * 2.5 + smoothNoise('temp2', hours / 5) * 0.8;
  const tempC = (tmax + tmin) / 2 + ((tmax - tmin) / 2) * diurnal + synoptic;

  const rhSwing = 18;
  const rh = Math.max(8, Math.min(98, rhMean - rhSwing * diurnal + smoothNoise('rh', hours / 20) * 8));

  const gust = 1 + 0.45 * Math.max(0, diurnal) + smoothNoise('wind', hours / 3) * 0.35;
  const windKmh = Math.max(0.5, wind * gust);

  // prevailing NW, slow random walk
  const windDir = (300 + smoothNoise('dir', hours / 12) * 60 + 360) % 360;

  return { t, tempC, rh, windKmh, windDir, ffwi: ffwi(tempC, rh, windKmh) };
}

/* ── local climatology: how unusual is today's fire weather for this month? ── */

const climCache = new Map<number, Float64Array>();

/** Sorted FFWI samples for a calendar month (28 days × 24 h of a reference year). */
export function ffwiClimatology(month: number): Float64Array {
  let c = climCache.get(month);
  if (!c) {
    const vals: number[] = [];
    for (let d = 1; d <= 28; d++) {
      for (let h = 0; h < 24; h++) vals.push(weatherAt(Date.UTC(2025, month, d, h) - IST_OFFSET, month).ffwi);
    }
    c = Float64Array.from(vals.sort((a, b) => a - b));
    climCache.set(month, c);
  }
  return c;
}

let annual: Float64Array | null = null;
function annualClimatology(): Float64Array {
  if (!annual) {
    const all: number[] = [];
    for (let m = 0; m < 12; m++) all.push(...ffwiClimatology(m));
    annual = Float64Array.from(all.sort((a, b) => a - b));
  }
  return annual;
}

function pct(c: Float64Array, f: number): number {
  let lo = 0, hi = c.length;
  while (lo < hi) { const mid = (lo + hi) >> 1; if (c[mid] < f) lo = mid + 1; else hi = mid; }
  return (lo / c.length) * 100;
}

/** Percentile (0–100) of an FFWI value within its month's climatology (month = -1 → whole year). */
export function ffwiPercentile(f: number, month: number): number {
  if (month < 0) return pct(annualClimatology(), f);
  const c = ffwiClimatology(month);
  let lo = 0, hi = c.length;
  while (lo < hi) { const mid = (lo + hi) >> 1; if (c[mid] < f) lo = mid + 1; else hi = mid; }
  return (lo / c.length) * 100;
}

/**
 * Weather component of the hazard score (0–100):
 *   45% percentile vs. this month's climatology  → the index moves every day
 *   30% percentile vs. the whole year            → May outranks November
 *   25% absolute FFWI                            → physically anchored
 */
export function weatherHazard(w: WeatherObs, month: number): number {
  return 0.45 * ffwiPercentile(w.ffwi, month) + 0.3 * ffwiPercentile(w.ffwi, -1) + 0.25 * weatherScore(w.ffwi);
}
