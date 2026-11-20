import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

const css = readFileSync('src/styles/tokens.css', 'utf8');

function block(sel: string): Record<string, string> {
  const i = css.indexOf(sel);
  const j = css.indexOf('}', css.indexOf('{', i));
  const out: Record<string, string> = {};
  for (const m of css.slice(i, j).matchAll(/--([\w-]+):\s*([^;]+);/g)) out[m[1]] = m[2].trim();
  return out;
}
const light = block(':root {');
const darkMedia = block(":root:not([data-theme='light'])");
const darkAttr = block(":root[data-theme='dark'] {");

const lum = (hex: string) => {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
};
const ratio = (a: string, b: string) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };

describe('design tokens', () => {
  it('both dark blocks (system + explicit) define identical tokens', () => {
    expect(darkAttr).toEqual(darkMedia);
  });
  it('every colour the dark theme overrides exists in light', () => {
    for (const k of Object.keys(darkAttr)) expect(light, k).toHaveProperty(k);
  });
  for (const [name, t] of [['light', light], ['dark', { ...light, ...darkAttr }]] as const) {
    it(`${name}: text tokens meet WCAG AA 4.5:1 on bg and surface`, () => {
      for (const k of ['text', 'text-2', 'text-3', 'hz-ink-0', 'hz-ink-1', 'hz-ink-2', 'hz-ink-3', 'hz-ink-4', 'ok', 'warn', 'bad']) {
        expect(ratio(t[k], t.bg), `${k} on bg`).toBeGreaterThanOrEqual(4.5);
        expect(ratio(t[k], t['surface-solid']), `${k} on surface`).toBeGreaterThanOrEqual(4.5);
      }
    });
    it(`${name}: hazard and category fills meet 3:1 for graphics`, () => {
      for (const k of ['hz-0', 'hz-1', 'hz-2', 'hz-3', 'hz-4', 'cat-building', 'cat-electrical', 'cat-industrial', 'cat-vehicle', 'cat-garbage', 'cat-scrub']) {
        expect(ratio(t[k], t.bg), `${k}`).toBeGreaterThanOrEqual(3);
      }
    });
  }
});
