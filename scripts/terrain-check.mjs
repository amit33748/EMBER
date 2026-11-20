// Terrain checks: tiles requested (inside/outside India, low zoom), and when.
// Usage: node scripts/terrain-check.mjs
import { chromium } from 'playwright-core';

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const browser = await chromium.launch({ executablePath: CHROME, args: ['--enable-webgl', '--ignore-gpu-blocklist'] });

const lon = (x, z) => (x / 2 ** z) * 360 - 180;
const lat = (y, z) => (180 / Math.PI) * Math.atan(Math.sinh(Math.PI - (2 * Math.PI * y) / 2 ** z));
function classify(urls) {
  const tiles = urls.map((u) => u.match(/terrarium\/(\d+)\/(\d+)\/(\d+)/)).filter(Boolean).map((m) => m.slice(1).map(Number));
  const outside = tiles.filter(([z, x, y]) => lon(x + 1, z) < 68 || lon(x, z) > 97.5 || lat(y, z) < 6.4 || lat(y + 1, z) > 35.8);
  return { tiles: tiles.length, outsideIndia: outside.length, belowZ6: tiles.filter(([z]) => z < 6).length };
}

async function run(name, { intro = false, url = '/live' } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await ctx.addInitScript((intro) => { try { if (!intro) sessionStorage.setItem('ember-intro', '1'); } catch {} }, intro);
  const page = await ctx.newPage();
  const seen = [];
  const t0 = Date.now();
  page.on('request', (r) => { if (r.url().includes('terrarium')) seen.push({ u: r.url(), ms: Date.now() - t0 }); });
  await page.goto('http://localhost:5173' + url, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(intro ? 9000 : 6000);
  const first2s = classify(seen.filter((s) => s.ms < 2000).map((s) => s.u));
  const all = classify(seen.map((s) => s.u));
  console.log(name, JSON.stringify({ first2s, total: all, firstAtMs: seen[0]?.ms ?? null }));
  await ctx.close();
}

await run('live-load');
await run('live-intro', { intro: true });
await run('landing', { url: '/' });
await browser.close();
