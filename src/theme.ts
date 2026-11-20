import { useEffect, useState, useSyncExternalStore } from 'react';

export type ThemePref = 'light' | 'dark' | 'system';
const KEY = 'ember-theme';

function readPref(): ThemePref {
  try { return (localStorage.getItem(KEY) as ThemePref) || 'system'; } catch { return 'system'; }
}

const mq = typeof window !== 'undefined' ? window.matchMedia('(prefers-color-scheme: dark)') : null;
const listeners = new Set<() => void>();
let pref: ThemePref = typeof window !== 'undefined' ? readPref() : 'system';

function apply() {
  const el = document.documentElement;
  if (pref === 'system') delete el.dataset.theme;
  else el.dataset.theme = pref;
  listeners.forEach((l) => l());
}
mq?.addEventListener('change', () => listeners.forEach((l) => l()));

export function setThemePref(p: ThemePref) {
  pref = p;
  try { if (p === 'system') localStorage.removeItem(KEY); else localStorage.setItem(KEY, p); } catch { /* ignore */ }
  apply();
}

function subscribe(cb: () => void) { listeners.add(cb); return () => { listeners.delete(cb); }; }

export function useThemePref(): ThemePref {
  return useSyncExternalStore(subscribe, () => pref, () => 'system');
}

export function useResolvedTheme(): 'light' | 'dark' {
  const p = useThemePref();
  const [sys, setSys] = useState(mq?.matches ? 'dark' : 'light');
  useEffect(() => subscribe(() => setSys(mq?.matches ? 'dark' : 'light')), []);
  return p === 'system' ? (sys as 'light' | 'dark') : p;
}

/** Read a CSS custom property (resolved for current theme). */
export function cssVar(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}
