// Automated audit probes: contrast, fonts, a11y names, targets, overflow, errors, perf.
import { chromium } from 'playwright-core';
import { readFileSync } from 'node:fs';

const BASE = 'http://localhost:5173';
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';

/* ---------- 1. token contrast (static, from tokens.css) ---------- */
const css = readFileSync('src/styles/tokens.css', 'utf8');
function block(sel) {
  const i = css.indexOf(sel);
  const j = css.indexOf('}', css.indexOf('{', i));
  const out = {};
  for (const m of css.slice(i, j).matchAll(/--([\w-]+):\s*(#[0-9a-fA-F]{6})/g)) out[m[1]] = m[2];
  return out;
}
const light = block(':root {');
const dark = { ...light, ...block(":root[data-theme='dark'] {") };
const lum = (hex) => {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
};
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
const pairs = [
  ['text', 'bg'], ['text-2', 'bg'], ['text-3', 'bg'], ['text-3', 'surface-solid'],
  ['accent', 'bg'], ['accent-ink', 'accent'],
  ['hz-0', 'bg'], ['hz-1', 'bg'], ['hz-2', 'bg'], ['hz-3', 'bg'], ['hz-4', 'bg'],
  ['hz-ink-0', 'bg'], ['hz-ink-1', 'bg'], ['hz-ink-2', 'bg'], ['hz-ink-3', 'bg'], ['hz-ink-4', 'bg'],
  ['hz-ink-1', 'surface-solid'], ['ok', 'bg'], ['warn', 'bg'], ['bad', 'bg'],
  ['cat-building', 'bg'], ['cat-electrical', 'bg'], ['cat-industrial', 'bg'], ['cat-vehicle', 'bg'], ['cat-garbage', 'bg'], ['cat-scrub', 'bg'],
];
const contrast = {};
for (const [name, t] of [['light', light], ['dark', dark]]) {
  contrast[name] = pairs.map(([f, b]) => ({ pair: `${f} on ${b}`, fg: t[f], bg: t[b], ratio: t[f] && t[b] ? +ratio(t[f], t[b]).toFixed(2) : null }));
}
console.log('CONTRAST', JSON.stringify(contrast));

/* ---------- 2. runtime probes ---------- */
const browser = await chromium.launch({ executablePath: CHROME, args: ['--enable-webgl', '--ignore-gpu-blocklist'] });

async function probe(url, opts = {}) {
  const ctx = await browser.newContext({ viewport: opts.viewport ?? { width: 1440, height: 900 }, colorScheme: opts.theme ?? 'dark', isMobile: !!opts.mobile, hasTouch: !!opts.mobile });
  await ctx.addInitScript(() => { try { sessionStorage.setItem('ember-intro', '1'); } catch {} });
  const page = await ctx.newPage();
  const errors = []; const failed = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 140)); });
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('response', (r) => { if (r.status() >= 400) failed.push(`${r.status()} ${r.url().slice(0, 110)}`); });
  await page.addInitScript(() => {
    window.__lcp = 0; window.__long = [];
    new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__lcp = e.startTime; }).observe({ type: 'largest-contentful-paint', buffered: true });
    new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__long.push(Math.round(e.duration)); }).observe({ type: 'longtask', buffered: true });
  });
  const t0 = Date.now();
  await page.goto(BASE + url, { waitUntil: 'networkidle' }).catch(() => {});
  const loadMs = Date.now() - t0;
  await page.waitForTimeout(3500);
  const r = await page.evaluate(() => {
    const vis = (el) => { const s = getComputedStyle(el); const b = el.getBoundingClientRect(); return s.visibility !== 'hidden' && s.display !== 'none' && b.width > 0 && b.height > 0; };
    const all = [...document.querySelectorAll('body *')].filter(vis);
    const fams = new Set(), sizes = new Map(), weights = new Set();
    for (const el of all) {
      if (![...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())) continue;
      const s = getComputedStyle(el);
      fams.add(s.fontFamily.split(',')[0].replace(/["']/g, '').trim());
      sizes.set(s.fontSize, (sizes.get(s.fontSize) ?? 0) + 1);
      weights.add(s.fontWeight);
    }
    const tiny = [...sizes.entries()].filter(([s]) => parseFloat(s) < 11).reduce((a, [, n]) => a + n, 0);
    const btns = [...document.querySelectorAll('button, a[href], [role="radio"], [role="option"], input')].filter(vis);
    const unnamed = btns.filter((b) => !(b.getAttribute('aria-label') || b.textContent.trim() || b.getAttribute('title') || b.getAttribute('aria-labelledby'))).map((b) => b.outerHTML.slice(0, 90));
    const small = btns.filter((b) => { const r = b.getBoundingClientRect(); return r.width < 24 || r.height < 24; }).map((b) => `${b.tagName.toLowerCase()}.${b.className.toString().split(' ')[0]} ${Math.round(b.getBoundingClientRect().width)}×${Math.round(b.getBoundingClientRect().height)}`);
    const truncated = [...document.querySelectorAll('.stat-tile .eyebrow, .zl-name, .mix-label, .tk-zone')].filter((e) => vis(e) && e.scrollWidth > e.clientWidth + 1).map((e) => e.textContent.trim());
    const kpiScroll = document.querySelector('.kpi-scroll');
    return {
      fonts: [...document.fonts].filter((f) => f.status === 'loaded').map((f) => `${f.family} ${f.weight}`).sort(),
      families: [...fams], sizes: Object.fromEntries([...sizes.entries()].sort((a, b) => parseFloat(a[0]) - parseFloat(b[0]))), weights: [...weights].sort(), tinyTextNodes: tiny,
      unnamed, smallTargets: small.slice(0, 40), smallTargetCount: small.length, truncated,
      overflowX: document.documentElement.scrollWidth - innerWidth,
      kpiHidden: kpiScroll ? kpiScroll.scrollWidth - kpiScroll.clientWidth : null,
      h1: [...document.querySelectorAll('h1')].map((h) => h.textContent.trim().slice(0, 40)),
      headings: [...document.querySelectorAll('h1,h2,h3')].map((h) => h.tagName).join(''),
      lang: document.documentElement.lang,
      lcp: Math.round(window.__lcp), longTasks: window.__long,
      domNodes: document.getElementsByTagName('*').length,
    };
  });
  // FPS sample (rAF over 3 s)
  const fps = await page.evaluate(() => new Promise((res) => { let n = 0; const t = performance.now(); const f = () => { n++; if (performance.now() - t < 3000) requestAnimationFrame(f); else res(Math.round(n / 3)); }; requestAnimationFrame(f); }));
  await ctx.close();
  return { url, viewport: opts.viewport ?? '1440x900', theme: opts.theme ?? 'dark', loadMs, fps, ...r, errors, failed };
}

const runs = [
  await probe('/', {}),
  await probe('/live', {}),
  await probe('/live', { theme: 'light' }),
  await probe('/', { viewport: { width: 375, height: 812 }, mobile: true }),
  await probe('/live', { viewport: { width: 375, height: 812 }, mobile: true }),
];
for (const r of runs) console.log('RUN', JSON.stringify(r));

/* ---------- 3. KPI consistency (from rendered DOM vs. definitions) ---------- */
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await ctx.addInitScript(() => { try { sessionStorage.setItem('ember-intro', '1'); } catch {} });
  const page = await ctx.newPage();
  const series = [];
  for (const off of [0, -72, -144, -216, -288, -576, -1008, -1440, -2016]) {
    await page.goto(`${BASE}/live?tick=${off}`, { waitUntil: 'networkidle' }).catch(() => {});
    await page.waitForTimeout(2600);
    series.push(await page.evaluate((off) => {
      const tiles = Object.fromEntries([...document.querySelectorAll('.kpi-scroll .stat-tile')].map((t) => [t.querySelector('.eyebrow').textContent.trim(), (t.querySelector('.st-value, .st-text')?.textContent ?? '').trim()]));
      const zones = [...document.querySelectorAll('.zone-list .zl-val')].map((e) => +e.textContent);
      return { off, tiles, zoneMin: Math.min(...zones), zoneMax: Math.max(...zones), band: document.querySelector('.panel-hero .mono')?.textContent };
    }, off));
  }
  console.log('KPISERIES', JSON.stringify(series));
  await ctx.close();
}
await browser.close();
