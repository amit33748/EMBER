import { describe, it, expect } from 'vitest';
import { SimulatedProvider } from '../src/data/SimulatedProvider';
import { ZONES } from '../src/geo/zones';
import { TICK_MS } from '../src/sim/prng';
import { bandOf } from '../src/analysis/hazard';

const START = Date.UTC(2026, 10, 13, 0, 0); // a November week
const DAY = 86400000;

function weekStats(p: SimulatedProvider, start: number) {
  const bands = [0, 0, 0, 0, 0];
  const district: number[] = [];
  const peakZones = new Set<string>();
  let incidents = 0;
  for (let d = 1; d <= 7; d++) {
    const hist = p.getHistory(start + d * DAY);
    for (const h of hist) {
      district.push(h.districtFhs);
      let best = '', bv = -1;
      for (const [z, v] of Object.entries(h.zoneFhs)) {
        bands[bandOf(v)]++;
        if (v > bv) { bv = v; best = z; }
      }
      peakZones.add(best);
    }
    incidents += p.getSnapshot(start + d * DAY).incidents.length;
  }
  const total = bands.reduce((a, b) => a + b, 0);
  return {
    share: bands.map((b) => +(b / total * 100).toFixed(1)),
    districtMin: Math.min(...district), districtMax: Math.max(...district),
    peakZones: peakZones.size,
    incidentsPerDay: incidents / 7,
  };
}

describe('model calibration (guards against a flat index — audit C1)', () => {
  const nov = weekStats(new SimulatedProvider(ZONES), START);
  const may = weekStats(new SimulatedProvider(ZONES, undefined, 'summer'), START);
  // eslint-disable-next-line no-console
  console.log('NOV', JSON.stringify(nov), '\nMAY', JSON.stringify(may));

  it('November: every band except possibly Extreme is visited, upper bands are not empty', () => {
    expect(nov.share[0]).toBeGreaterThan(3);
    expect(nov.share[1]).toBeGreaterThan(15);
    expect(nov.share[2]).toBeGreaterThan(8);
    expect(nov.share[3] + nov.share[4]).toBeGreaterThan(3);
    expect(nov.share[3] + nov.share[4]).toBeLessThan(30);
  });
  it('district score moves through the day', () => {
    expect(nov.districtMax - nov.districtMin).toBeGreaterThan(12);
  });
  it('the hottest zone changes', () => {
    expect(nov.peakZones).toBeGreaterThanOrEqual(3);
  });
  it('incident volume stays plausible', () => {
    expect(nov.incidentsPerDay).toBeGreaterThan(4);
    expect(nov.incidentsPerDay).toBeLessThan(25);
  });
  it('summer scenario is clearly hotter and reaches Extreme', () => {
    expect(may.share[3] + may.share[4]).toBeGreaterThan(nov.share[3] + nov.share[4] + 10);
    expect(may.share[4]).toBeGreaterThan(1);
  });
});

it('forecast covers the next 24 h', () => {
  const f = new SimulatedProvider(ZONES).getForecast(START);
  expect(f.length).toBe(96);
  expect(f[0].t).toBeGreaterThan(START - TICK_MS);
});

import { kde, makeGrid } from '../src/analysis/kde';
import { BBOX } from '../src/geo/zones';
import { distKm } from '../src/sim/geoutil';

it('the density-surface peak moves between zones over a week (audit C1 follow-up)', () => {
  const p = new SimulatedProvider(ZONES);
  const g = makeGrid(BBOX, 0.4);
  const peaks = new Map<string, number>();
  for (let h = 0; h < 7 * 24; h += 3) {
    const s = p.getSnapshot(START + h * 3600000);
    const { grid, max } = kde(s.hazardPoints, g, 1.4);
    const i = grid.indexOf(max);
    const lon = g.bbox[0] + ((i % g.cols) + 0.5) * g.dLon;
    const lat = g.bbox[3] - (Math.floor(i / g.cols) + 0.5) * g.dLat;
    const z = ZONES.reduce((b, zz) => (distKm(lon, lat, zz.lon, zz.lat) < distKm(lon, lat, b.lon, b.lat) ? zz : b));
    peaks.set(z.id, (peaks.get(z.id) ?? 0) + 1);
  }
  // eslint-disable-next-line no-console
  console.log('PEAKS', JSON.stringify(Object.fromEntries(peaks)));
  expect(peaks.size).toBeGreaterThanOrEqual(3);
  expect(Math.max(...peaks.values()) / 56).toBeLessThan(0.7);
});
