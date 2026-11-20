import type { Band, LandUse } from '../data/types';

/**
 * PROTOTYPE fire hazard model — not an official rating.
 * FHS (0–100) = weather·W + fuel·F + ignition·I
 *   weather  — Fosberg Fire Weather Index (Fosberg 1978): 55% percentile vs. local
 *              monthly climatology + 45% absolute (see sim/weather.ts weatherHazard)
 *   fuel     — land-use exposure (0..1) × diurnal activity factor, capped at FUEL_CAP
 *   ignition — recent incident pressure in zone (0..100)
 * Weights live here so production can recalibrate in one place.
 */
export const HAZARD_WEIGHTS = { weather: 0.4, fuel: 0.35, ignition: 0.25 } as const;
export const BAND_CUTS = [25, 40, 55, 70] as const;
export const BAND_LABELS = ['Low', 'Moderate', 'High', 'Very High', 'Extreme'] as const;

/** Equilibrium moisture content (%) — Simard 1968, T in °F, H in %. */
export function emc(tempF: number, rh: number): number {
  if (rh < 10) return 0.03229 + 0.281073 * rh - 0.000578 * rh * tempF;
  if (rh < 50) return 2.22749 + 0.160107 * rh - 0.01478 * tempF;
  return 21.0606 + 0.005565 * rh * rh - 0.00035 * rh * tempF - 0.483199 * rh;
}

/** Fosberg Fire Weather Index. tempC °C, rh %, windKmh km/h → 0..100. */
export function ffwi(tempC: number, rh: number, windKmh: number): number {
  const tF = tempC * 9 / 5 + 32;
  const m = Math.max(0, emc(tF, rh));
  const x = m / 30;
  const eta = 1 - 2 * x + 1.5 * x * x - 0.5 * x * x * x;
  const u = windKmh / 1.609344;
  const v = (eta * Math.sqrt(1 + u * u)) / 0.3002;
  return Math.max(0, Math.min(100, v));
}

/** FFWI rarely exceeds ~40 in practice; stretch to 0..100 for scoring. */
export function weatherScore(f: number): number {
  return 100 * Math.pow(Math.min(1, f / 35), 0.8);
}

/** Max effective fuel/exposure after activity multiplier (lets the busiest hours exceed static fuel). */
export const FUEL_CAP = 1.2;

/**
 * Diurnal / seasonal activity multiplier per land use (IST hour, 0-based month).
 * Markets peak in the evening (cooking, wiring load), industry by day (hot work),
 * landfill & scrub in afternoon heat, rural fringe during Oct–Nov stubble burning.
 */
export function activityFactor(landUse: LandUse, h: number, month: number): number {
  const bump = (center: number, width: number, amp: number) => amp * Math.exp(-(((h - center + 24) % 24 > 12 ? (h - center + 24) % 24 - 24 : (h - center + 24) % 24) ** 2) / (2 * width * width));
  switch (landUse) {
    case 'market': return 0.75 + bump(20, 2.5, 0.55);
    case 'industrial': return 0.8 + bump(13, 3.5, 0.45);
    case 'landfill': return 0.85 + bump(15, 2.5, 0.5);
    case 'forest': return 0.75 + bump(15, 2.5, 0.5) + (month >= 2 && month <= 5 ? 0.15 : 0);
    case 'residential': return 0.85 + bump(20, 2, 0.3) + bump(8, 1.5, 0.12);
    case 'commercial': return 0.85 + bump(14, 3, 0.25);
    case 'rural': return 0.8 + bump(15, 2.5, month === 9 || month === 10 ? 0.55 : 0.25);
  }
}

export function fhs(weather: number, fuel: number, ignition: number): number {
  const w = HAZARD_WEIGHTS;
  return Math.max(0, Math.min(100, weather * w.weather + fuel * 100 * w.fuel + ignition * w.ignition));
}

export function bandOf(score: number): Band {
  let b = 0;
  for (const c of BAND_CUTS) if (score >= c) b++;
  return b as Band;
}

export const bandVar = (b: Band) => `var(--hz-${b})`;
