import { describe, it, expect } from 'vitest';
import { kde, makeGrid, buildMask } from '../src/analysis/kde';

describe('KDE', () => {
  const g = makeGrid([77, 28.4, 77.1, 28.5], 0.2);
  it('integrates to total weight (quartic kernel normalized)', () => {
    const { grid } = kde([{ lon: 77.05, lat: 28.45, w: 2 }], g, 1);
    let sum = 0;
    for (const v of grid) sum += v;
    sum *= g.cellKm * g.cellKm;
    expect(sum).toBeGreaterThan(1.9);
    expect(sum).toBeLessThan(2.1);
  });
  it('peak lies at the point', () => {
    const { grid, max } = kde([{ lon: 77.05, lat: 28.45, w: 1 }], g, 1);
    const i = grid.indexOf(max);
    const c = i % g.cols, r = Math.floor(i / g.cols);
    expect(Math.abs(g.bbox[0] + (c + 0.5) * g.dLon - 77.05)).toBeLessThan(g.dLon * 1.01);
    expect(Math.abs(g.bbox[3] - (r + 0.5) * g.dLat - 28.45)).toBeLessThan(g.dLat * 1.01);
  });
  it('mask zeroes outside cells', () => {
    const mask = buildMask(g, { type: 'Polygon', coordinates: [[[77, 28.4], [77.05, 28.4], [77.05, 28.5], [77, 28.5], [77, 28.4]]] });
    const { grid } = kde([{ lon: 77.05, lat: 28.45, w: 1 }], g, 2, mask);
    for (let i = 0; i < grid.length; i++) if (!mask[i]) expect(grid[i]).toBe(0);
  });
});
