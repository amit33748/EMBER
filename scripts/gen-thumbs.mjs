// Render real basemap preview thumbnails (Gurugram, no Ember overlays).
// Usage: dev server running, then: node scripts/gen-thumbs.mjs
// Output: public/basemaps/<id>.png (converted to .jpg + auto.jpg by scripts/gen-thumbs-post.py)
import { chromium } from 'playwright-core';
import { mkdirSync } from 'node:fs';

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const IDS = ['positron', 'dark', 'liberty', 'bright', 'fiord', 'satellite', 'topo'];
const OUR_LAYERS = ['veil', 'density-a', 'density-b', 'zones-fill', 'zones-line', 'columns', 'contours', 'contours-glow', 'boundary', 'boundary-glow', 'past', 'hillshade'];

mkdirSync('public/basemaps', { recursive: true });
const browser = await chromium.launch({ executablePath: CHROME, args: ['--enable-webgl', '--ignore-gpu-blocklist'] });

for (const id of IDS) {
  const ctx = await browser.newContext({ viewport: { width: 900, height: 700 }, deviceScaleFactor: 2, colorScheme: 'light' });
  await ctx.addInitScript((id) => {
    try { sessionStorage.setItem('ember-intro', '1'); localStorage.setItem('ember-basemap', id); } catch {}
  }, id);
  const page = await ctx.newPage();
  await page.goto('http://localhost:5173/live', { waitUntil: 'networkidle' }).catch(() => {});
  await page.waitForTimeout(3500);
  await page.evaluate((layers) => {
    for (const s of ['.topbar', '.kpi-row', '.panel-left', '.panel-right', '.live-bottom', '.watermark', '.maplibregl-control-container', '.maplibregl-marker', '.wind-canvas']) {
      document.querySelectorAll(s).forEach((e) => { e.style.display = 'none'; });
    }
    const m = window.__map_full;
    for (const l of layers) if (m.getLayer(l)) m.setLayoutProperty(l, 'visibility', 'none');
    m.jumpTo({ center: [77.045, 28.455], zoom: 11.6, bearing: 0, pitch: 0 });
  }, OUR_LAYERS);
  await page.waitForTimeout(500);
  await page.evaluate(() => new Promise((r) => { const m = window.__map_full; if (m.loaded()) r(null); else m.once('idle', () => r(null)); setTimeout(r, 8000); }));
  await page.waitForTimeout(800);
  await page.screenshot({ path: `public/basemaps/${id}.png`, clip: { x: 290, y: 230, width: 320, height: 240 } });
  console.log('thumb', id);
  await ctx.close();
}
await browser.close();
