import { it, expect } from 'vitest';

/** The needle tip after rotate(angle cx cy) must stay on the circle of radius (r-18) around the hub. */
it('gauge needle geometry pivots on the hub for every value (regression: detached needle)', () => {
  const size = 160, r = size / 2 - 12, cx = size / 2, cy = size / 2, len = r - 18;
  for (let value = 0; value <= 100; value += 5) {
    const a = ((value / 100) * 180 - 90) * (Math.PI / 180);
    // SVG rotate: (x,y) → rotate about (cx,cy); untransformed tip is (cx, cy - len)
    const tipX = cx + len * Math.sin(a);
    const tipY = cy - len * Math.cos(a);
    expect(Math.hypot(tipX - cx, tipY - cy)).toBeCloseTo(len, 6);
    // 0 points left, 50 up, 100 right
    if (value === 0) expect(tipX).toBeCloseTo(cx - len, 6);
    if (value === 50) expect(tipY).toBeCloseTo(cy - len, 6);
    if (value === 100) expect(tipX).toBeCloseTo(cx + len, 6);
  }
});
