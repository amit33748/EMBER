import { describe, it, expect } from 'vitest';
import { ffwi, emc, fhs, bandOf } from '../src/analysis/hazard';

describe('Fosberg FFWI', () => {
  it('EMC branches are continuous-ish and positive', () => {
    expect(emc(80, 9)).toBeGreaterThan(0);
    expect(emc(80, 30)).toBeGreaterThan(emc(80, 9));
    expect(emc(80, 70)).toBeGreaterThan(emc(80, 30));
  });
  it('bone-dry, 30 mph wind → ~100 (capped)', () => {
    expect(ffwi(40, 1, 30 * 1.609344)).toBeGreaterThan(90);
  });
  it('humid calm → low', () => {
    expect(ffwi(20, 90, 2)).toBeLessThan(5);
  });
  it('monotonic in wind and dryness', () => {
    expect(ffwi(30, 30, 20)).toBeGreaterThan(ffwi(30, 30, 5));
    expect(ffwi(30, 15, 10)).toBeGreaterThan(ffwi(30, 60, 10));
  });
  it('matches hand-computed value (T=82°F, RH=35, 6 mph)', () => {
    // m = 2.22749 + 0.160107*35 - 0.01478*82 = 6.6206; eta ≈ 0.6265; sqrt(37)/0.3002
    const v = ffwi((82 - 32) * 5 / 9, 35, 6 * 1.609344);
    expect(v).toBeCloseTo(12.69, 1);
  });
});

describe('FHS + bands', () => {
  it('clamps and bands', () => {
    expect(fhs(100, 1, 100)).toBe(100);
    expect(bandOf(10)).toBe(0);
    expect(bandOf(30)).toBe(1);
    expect(bandOf(50)).toBe(2);
    expect(bandOf(65)).toBe(3);
    expect(bandOf(90)).toBe(4);
  });
});
