// Annotated screenshot capture for the audit report.
// Usage: node scripts/shoot.mjs <spec.json>
// Uses the system Chrome via playwright-core (no browser download).
import { chromium } from 'playwright-core';
import { readFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

const spec = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const BASE = spec.base ?? 'http://localhost:5173';
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';

const browser = await chromium.launch({ executablePath: CHROME, args: ['--use-angle=d3d11', '--enable-webgl', '--ignore-gpu-blocklist'] });

for (const shot of spec.shots) {
  const ctx = await browser.newContext({
    viewport: shot.viewport ?? { width: 1440, height: 900 },
    deviceScaleFactor: shot.dpr ?? 1,
    colorScheme: shot.theme ?? 'dark',
    reducedMotion: shot.reducedMotion ? 'reduce' : 'no-preference',
    isMobile: shot.mobile ?? false,
    hasTouch: shot.mobile ?? false,
  });
  // skip globe intro unless asked
  await ctx.addInitScript((intro) => {
    try { if (!intro) sessionStorage.setItem('ember-intro', '1'); } catch {}
  }, !!shot.intro);
  if (shot.storage) await ctx.addInitScript((kv) => { try { for (const [k, v] of Object.entries(kv)) localStorage.setItem(k, v); } catch {} }, shot.storage);
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 160)); });
  await page.goto(shot.url.startsWith('file:') ? shot.url : BASE + shot.url, { waitUntil: 'networkidle' }).catch(() => {});
  await page.waitForTimeout(shot.wait ?? 3500);
  if (shot.js) { await page.evaluate(shot.js); await page.waitForTimeout(shot.after ?? 1500); }
  if (shot.scrollTo) { await page.evaluate((s) => document.querySelector(s)?.scrollIntoView({ block: 'start' }), shot.scrollTo); await page.waitForTimeout(1600); }

  if (shot.marks?.length) {
    await page.evaluate((marks) => {
      const layer = document.createElement('div');
      layer.id = '__marks';
      Object.assign(layer.style, { position: 'fixed', inset: '0', zIndex: '2147483647', pointerEvents: 'none' });
      document.body.appendChild(layer);
      marks.forEach((m) => {
        let r;
        if (m.sel) {
          const el = document.querySelectorAll(m.sel)[m.idx ?? 0];
          if (!el) return;
          r = el.getBoundingClientRect();
        } else r = { left: m.rect[0], top: m.rect[1], width: m.rect[2], height: m.rect[3] };
        const pad = m.pad ?? 4;
        const color = m.color ?? (m.sev === 'ok' ? '#22c55e' : m.sev === 'minor' ? '#eab308' : m.sev === 'major' ? '#f97316' : '#ef4444');
        const box = document.createElement('div');
        Object.assign(box.style, {
          position: 'absolute', left: `${r.left - pad}px`, top: `${r.top - pad}px`, width: `${r.width + pad * 2}px`, height: `${r.height + pad * 2}px`,
          border: `3px solid ${color}`, borderRadius: '8px', boxShadow: `0 0 0 2px rgba(0,0,0,.55), 0 0 18px ${color}`,
        });
        const tag = document.createElement('div');
        tag.textContent = m.label ? `${m.n} · ${m.label}` : String(m.n);
        Object.assign(tag.style, {
          position: 'fixed', background: color, color: '#000', font: '700 13px/1 Consolas, monospace', padding: '6px 8px', borderRadius: '6px',
          whiteSpace: 'nowrap', boxShadow: '0 2px 8px rgba(0,0,0,.6)', zIndex: '2',
        });
        layer.appendChild(tag);
        const tw = tag.offsetWidth, th = tag.offsetHeight;
        let x = Math.min(Math.max(4, r.left - pad - 3), innerWidth - tw - 4);
        let y = r.top - pad - th - 4;
        if (y < 4) y = r.top + r.height + pad + 4;
        if (y + th > innerHeight - 4) y = Math.max(4, r.top + 4);
        window.__placed = window.__placed || [];
        const hit = (yy) => window.__placed.some((q) => !(x + tw < q.x || x > q.x + q.w || yy + th < q.y || yy > q.y + q.h));
        let guard = 0;
        while (hit(y) && guard++ < 12) y += th + 4;
        window.__placed.push({ x, y, w: tw, h: th });
        tag.style.left = `${x}px`;
        tag.style.top = `${y}px`;
        layer.appendChild(box);
      });
    }, shot.marks);
  }

  const out = `docs/audit/figures/${shot.name}.jpg`;
  mkdirSync(dirname(out), { recursive: true });
  if (shot.elem) await page.locator(shot.elem).first().screenshot({ path: out, type: 'jpeg', quality: 85 });
  else if (shot.clip) await page.screenshot({ path: out, clip: shot.clip, type: 'jpeg', quality: 85 });
  else await page.screenshot({ path: out, fullPage: !!shot.fullPage, type: 'jpeg', quality: 85 });
  if (shot.probe) {
    const res = await page.evaluate(shot.probe);
    console.log(`PROBE ${shot.name}:`, JSON.stringify(res));
  }
  console.log(`${out}${errors.length ? `  ERRORS: ${errors.join(' | ')}` : ''}`);
  await ctx.close();
}
await browser.close();
