import { describe, it, expect } from 'vitest';
import { windField, bandsFor, WIND_DOMAIN } from '../src/map/WindParticles';

/** meteorological "from" direction (deg) of a towards-vector */
const fromDir = ([u, v]: [number, number]) => (Math.atan2(u, v) * 180 / Math.PI + 180 + 360) % 360;
const angDiff = (a: number, b: number) => Math.abs(((a - b + 540) % 360) - 180);
const local = { windKmh: 7, windDir: 300 };

describe('wind field over India & the Indian Ocean', () => {
  it('domain covers India and the northern Indian Ocean', () => {
    const [x0, y0, x1, y1] = WIND_DOMAIN;
    expect(x0).toBeLessThanOrEqual(50);   // Arabian Sea west
    expect(x1).toBeGreaterThanOrEqual(97.5); // NE India / Bay of Bengal east
    expect(y0).toBeLessThanOrEqual(-10);  // south of the equator
    expect(y1).toBeGreaterThanOrEqual(35.5); // Kashmir
  });
  it('July: south-westerly monsoon over the Arabian Sea', () => {
    expect(angDiff(fromDir(windField(62, 13, bandsFor(6), local)), 235)).toBeLessThan(40);
  });
  it('December: north-easterly over the Bay of Bengal', () => {
    expect(angDiff(fromDir(windField(88, 15, bandsFor(11), local)), 45)).toBeLessThan(40);
  });
  it('south of the equator: south-east trades all year', () => {
    for (const m of [0, 6]) expect(angDiff(fromDir(windField(80, -15, bandsFor(m), local)), 125)).toBeLessThan(40);
  });
  it('at Gurugram it matches the simulated local wind', () => {
    expect(angDiff(fromDir(windField(77.03, 28.46, bandsFor(10), local)), 300)).toBeLessThan(5);
  });
});
