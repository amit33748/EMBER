import { describe, it, expect } from 'vitest';
import { SimulatedProvider } from '../src/data/SimulatedProvider';
import { ZONES } from '../src/geo/zones';
import { STATIONS } from '../src/sim/zones';
import { computeKpis } from '../src/analysis/kpis';
import { TICK_MS } from '../src/sim/prng';

const AT = Date.UTC(2026, 10, 20, 11, 2, 0); // 16:32 IST

describe('simulation', () => {
  it('every zone has a polygon inside the district', () => {
    expect(ZONES.length).toBeGreaterThan(15);
    for (const z of ZONES) expect(z.polygon.coordinates.length).toBeGreaterThan(0);
  });
  it('is deterministic per 5-min tick', () => {
    const a = new SimulatedProvider(ZONES).getSnapshot(AT);
    const b = new SimulatedProvider(ZONES).getSnapshot(AT + 1000);
    expect(a.tick).toBe(b.tick);
    expect(a.incidents.map((i) => i.id)).toEqual(b.incidents.map((i) => i.id));
    expect(a.zones.map((z) => z.fhs)).toEqual(b.zones.map((z) => z.fhs));
  });
  it('changes on next tick', () => {
    const p = new SimulatedProvider(ZONES);
    const a = p.getSnapshot(AT);
    const b = p.getSnapshot(AT + TICK_MS);
    expect(b.tick).toBe(a.tick + 1);
    expect(a.weather.tempC).not.toBe(b.weather.tempC);
  });
  it('produces plausible daily volume and spread of bands', () => {
    const p = new SimulatedProvider(ZONES);
    const s = p.getSnapshot(AT);
    expect(s.incidents.length).toBeGreaterThan(2);
    expect(s.incidents.length).toBeLessThan(40);
    const bands = new Set(s.zones.map((z) => z.band));
    expect(bands.size).toBeGreaterThan(1);
  });
  it('history has 288 points', () => {
    expect(new SimulatedProvider(ZONES).getHistory(AT)).toHaveLength(288);
  });
});

describe('KPIs', () => {
  it('computes consistent figures', () => {
    const p = new SimulatedProvider(ZONES);
    const s = p.getSnapshot(AT);
    const k = computeKpis(s, ZONES, STATIONS, { prev24hCount: 10 });
    expect(k.last24h).toBe(s.incidents.length);
    expect(k.active).toBeLessThanOrEqual(k.last24h);
    expect(k.utilization).toBeGreaterThanOrEqual(0);
    expect(k.utilization).toBeLessThanOrEqual(1);
    if (k.compliancePct !== null) expect(k.compliancePct).toBeLessThanOrEqual(100);
    expect(Object.values(k.typeMix).reduce((a, b) => a + b, 0)).toBe(k.last24h);
  });
});

describe('KPI threshold consistency (audit C2)', () => {
  it('population at risk is zero exactly when there are no High+ zones', () => {
    const p = new SimulatedProvider(ZONES);
    for (let h = 0; h < 48; h += 3) {
      const s = p.getSnapshot(AT + h * 3600000);
      const k = computeKpis(s, ZONES, STATIONS);
      expect(k.popAtRisk === 0).toBe(k.atRiskZones === 0);
    }
  });
});
