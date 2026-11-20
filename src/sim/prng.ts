/** Deterministic PRNG utilities. Same seed → same "live" state for every viewer. */

export const TICK_MS = 5 * 60 * 1000;
export const TICKS_PER_DAY = 288;

export function hashStr(s: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function rng(...parts: (string | number)[]): () => number {
  return mulberry32(hashStr(parts.join('|')));
}

/** Smooth 1-D value noise in [-1, 1] (cosine-interpolated hashed lattice). */
export function smoothNoise(key: string, x: number): number {
  const i = Math.floor(x);
  const f = x - i;
  const a = rng(key, i)() * 2 - 1;
  const b = rng(key, i + 1)() * 2 - 1;
  const u = (1 - Math.cos(f * Math.PI)) / 2;
  return a * (1 - u) + b * u;
}

export function poisson(r: () => number, lambda: number): number {
  const L = Math.exp(-lambda);
  let k = 0;
  let p = 1;
  do {
    k++;
    p *= r();
  } while (p > L && k < 50);
  return k - 1;
}

export function gauss(r: () => number): number {
  const u = Math.max(r(), 1e-9);
  const v = r();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

export function tickOf(t: number): number {
  return Math.floor(t / TICK_MS);
}
