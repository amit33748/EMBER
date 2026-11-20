import type { Map as MLMap } from 'maplibre-gl';

interface P { lon: number; lat: number; age: number; max: number }

export interface WindState { windKmh: number; windDir: number } // dir = degrees wind blows FROM

/** India + Arabian Sea + Bay of Bengal + northern Indian Ocean. */
export const WIND_DOMAIN: [number, number, number, number] = [40, -25, 105, 37];

const GURUGRAM = { lon: 77.03, lat: 28.46 };

/** A latitude band of the large-scale circulation: wind FROM `dir` at `kmh`. */
interface Band { lat: number; width: number; dir: number; kmh: number; jet?: boolean }

/**
 * Illustrative seasonal circulation over South Asia (NOT a forecast):
 *   Nov–Feb  NE monsoon: NW flow over the plains, NE trades over the bays, SE trades south of the equator
 *   Mar–May  pre-monsoon: hot westerlies north, westerly flow over the seas
 *   Jun–Sep  SW monsoon: strong south-westerlies (Somali jet over the Arabian Sea), easterlies over the Gangetic plain
 *   Oct      retreat: transitional
 */
export function bandsFor(month: number): Band[] {
  const se = { lat: -15, width: 9, dir: 125, kmh: 24 }; // SE trades, all year
  if (month >= 5 && month <= 8) return [
    { lat: 30, width: 5, dir: 110, kmh: 12 },
    { lat: 14, width: 9, dir: 240, kmh: 32, jet: true },
    { lat: 2, width: 6, dir: 215, kmh: 22 },
    se,
  ];
  if (month >= 2 && month <= 4) return [
    { lat: 30, width: 6, dir: 290, kmh: 16 },
    { lat: 15, width: 8, dir: 260, kmh: 14 },
    { lat: 0, width: 6, dir: 280, kmh: 10 },
    se,
  ];
  if (month === 9) return [
    { lat: 30, width: 6, dir: 300, kmh: 8 },
    { lat: 15, width: 8, dir: 70, kmh: 12 },
    { lat: 0, width: 6, dir: 270, kmh: 10 },
    se,
  ];
  return [
    { lat: 30, width: 6, dir: 305, kmh: 9 },
    { lat: 15, width: 8, dir: 45, kmh: 20 },
    { lat: 2, width: 6, dir: 300, kmh: 12 },
    se,
  ];
}

function hashNoise(x: number, y: number): number {
  const s = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
  return s - Math.floor(s);
}
/** Smooth 2-D value noise in [-1, 1]. */
function noise2(x: number, y: number): number {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hashNoise(xi, yi), b = hashNoise(xi + 1, yi), c = hashNoise(xi, yi + 1), d = hashNoise(xi + 1, yi + 1);
  return (a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v) * 2 - 1;
}

/**
 * Wind vector (towards; km/h east, north) at a point: seasonal bands + smooth eddies,
 * blended near Gurugram into the simulated local wind. Exported for tests.
 */
export function windField(lon: number, lat: number, bands: Band[], local: WindState, t = 0): [number, number] {
  let u = 0, v = 0, wsum = 0;
  for (const b of bands) {
    const w = Math.exp(-(((lat - b.lat) / b.width) ** 2));
    const to = ((b.dir + 180) * Math.PI) / 180;
    let k = b.kmh;
    if (b.jet) k *= 1 + 0.8 * Math.exp(-(((lon - 60) / 8) ** 2) - (((lat - 12) / 5) ** 2)); // Somali jet
    u += w * Math.sin(to) * k; v += w * Math.cos(to) * k; wsum += w;
  }
  u /= wsum || 1; v /= wsum || 1;
  const ang = 0.55 * noise2(lon * 0.18 + t, lat * 0.18 - t * 0.7);
  const ca = Math.cos(ang), sa = Math.sin(ang);
  [u, v] = [u * ca - v * sa, u * sa + v * ca];
  const wl = Math.exp(-(((lon - GURUGRAM.lon) / 4) ** 2) - (((lat - GURUGRAM.lat) / 4) ** 2));
  if (wl > 0.01) {
    const to = ((local.windDir + 180) * Math.PI) / 180;
    u = u * (1 - wl) + Math.sin(to) * local.windKmh * wl;
    v = v * (1 - wl) + Math.cos(to) * local.windKmh * wl;
  }
  return [u, v];
}

/**
 * Canvas particle flow over India and the Indian Ocean.
 * Particles spawn only inside (viewport ∩ domain) and move a fixed number of
 * screen pixels per frame, so the flow reads the same at every zoom.
 */
export class WindParticles {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private ps: P[] = [];
  private raf = 0;
  private t = 0;
  private dpr = Math.min(2, window.devicePixelRatio || 1);
  private color = 'rgba(255,230,210,0.5)';
  private local: WindState = { windKmh: 6, windDir: 300 };
  private bands: Band[] = bandsFor(new Date().getMonth());
  private spawnBox: [number, number, number, number] | null = null;
  private onMove = () => this.clear();
  private onMoveEnd = () => this.reseed();
  private onResize = () => { this.resize(); this.reseed(); };

  constructor(private map: MLMap, private domain: [number, number, number, number] = WIND_DOMAIN, private count = 900) {
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'wind-canvas';
    this.canvas.setAttribute('aria-hidden', 'true');
    map.getCanvasContainer().appendChild(this.canvas);
    this.ctx = this.canvas.getContext('2d')!;
    this.resize();
    map.on('move', this.onMove);
    map.on('moveend', this.onMoveEnd);
    map.on('resize', this.onResize);
    this.reseed();
  }

  setWind(w: WindState, month?: number) {
    this.local = w;
    if (month !== undefined) this.bands = bandsFor(month);
  }
  setTheme(tone: 'light' | 'dark') {
    this.color = tone === 'dark' ? 'rgba(255,228,205,0.45)' : 'rgba(60,40,25,0.4)';
    this.clear();
  }

  start() {
    if (this.raf) return;
    const step = () => { this.frame(); this.raf = requestAnimationFrame(step); };
    this.raf = requestAnimationFrame(step);
  }
  stop() { cancelAnimationFrame(this.raf); this.raf = 0; this.clear(); }

  destroy() {
    this.stop();
    this.map.off('move', this.onMove);
    this.map.off('moveend', this.onMoveEnd);
    this.map.off('resize', this.onResize);
    this.canvas.remove();
  }

  private resize() {
    const c = this.map.getCanvas();
    const w = c.clientWidth, h = c.clientHeight;
    this.canvas.width = w * this.dpr;
    this.canvas.height = h * this.dpr;
    this.canvas.style.width = `${w}px`;
    this.canvas.style.height = `${h}px`;
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
  }

  private clear() { this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height); }

  /** Spawn area = current view ∩ domain (null when the view is outside the domain). */
  private reseed() {
    const b = this.map.getBounds();
    const [x0, y0, x1, y1] = this.domain;
    const box: [number, number, number, number] = [Math.max(x0, b.getWest()), Math.max(y0, b.getSouth()), Math.min(x1, b.getEast()), Math.min(y1, b.getNorth())];
    this.spawnBox = box[0] < box[2] && box[1] < box[3] ? box : null;
    const viewArea = Math.max(1e-9, (b.getEast() - b.getWest()) * (b.getNorth() - b.getSouth()));
    const cover = this.spawnBox ? ((box[2] - box[0]) * (box[3] - box[1])) / viewArea : 0;
    const n = Math.round(this.count * Math.min(1, cover));
    this.ps = Array.from({ length: n }, () => this.spawn(true));
    this.clear();
  }

  private spawn(randomAge = false): P {
    const [x0, y0, x1, y1] = this.spawnBox ?? this.domain;
    const max = 70 + Math.random() * 90;
    return { lon: x0 + Math.random() * (x1 - x0), lat: y0 + Math.random() * (y1 - y0), age: randomAge ? Math.random() * max : 0, max };
  }

  private frame() {
    if (!this.spawnBox || !this.ps.length) return;
    const ctx = this.ctx;
    const w = this.canvas.width / this.dpr, h = this.canvas.height / this.dpr;
    ctx.globalCompositeOperation = 'destination-in';
    ctx.fillStyle = 'rgba(0,0,0,0.94)';
    ctx.fillRect(0, 0, w, h);
    ctx.globalCompositeOperation = 'source-over';

    this.t += 0.003;
    const degPerPx = 360 / (512 * 2 ** this.map.getZoom()); // 512-px tiles
    const [sx0, sy0, sx1, sy1] = this.spawnBox;

    ctx.strokeStyle = this.color;
    ctx.lineWidth = 1.15;
    ctx.lineCap = 'round';
    ctx.beginPath();
    for (let i = 0; i < this.ps.length; i++) {
      const p = this.ps[i];
      const [u, v] = windField(p.lon, p.lat, this.bands, this.local, this.t);
      const mag = Math.hypot(u, v) || 1;
      const speedPx = 0.25 + Math.min(2.2, mag * 0.07); // px/frame, readable at any zoom
      const cosLat = Math.cos((p.lat * Math.PI) / 180);
      const nlon = p.lon + ((u / mag) * speedPx * degPerPx) / Math.max(0.2, cosLat);
      const nlat = p.lat + (v / mag) * speedPx * degPerPx;
      const s0 = this.map.project([p.lon, p.lat]);
      const s1 = this.map.project([nlon, nlat]);
      p.lon = nlon; p.lat = nlat; p.age++;
      if (p.age > p.max || nlon < sx0 || nlon > sx1 || nlat < sy0 || nlat > sy1) { this.ps[i] = this.spawn(); continue; }
      if (s1.x < -10 || s1.y < -10 || s1.x > w + 10 || s1.y > h + 10) continue;
      ctx.moveTo(s0.x, s0.y);
      ctx.lineTo(s1.x, s1.y);
    }
    ctx.stroke();
  }
}
