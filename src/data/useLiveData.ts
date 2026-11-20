import { useEffect, useState } from 'react';
import { useStore, provider } from '../store';

/** Refreshes the store on every 5-minute tick boundary. Mount once at app root. */
export function useLiveClock() {
  const refresh = useStore((s) => s.refresh);
  useEffect(() => {
    let id: number;
    const schedule = () => {
      const now = useStore.getState().now();
      const wait = provider.tickMs - (now % provider.tickMs) + 250;
      id = window.setTimeout(() => { useStore.getState().tickBoundary(); schedule(); }, wait);
    };
    schedule();
    const onVis = () => { if (document.visibilityState === 'visible') refresh(); };
    document.addEventListener('visibilitychange', onVis);
    return () => { clearTimeout(id); document.removeEventListener('visibilitychange', onVis); };
  }, [refresh]);
}

/** Seconds until next tick (updates each second). */
export function useCountdown(): number {
  const now = useStore((s) => s.now);
  const tick = useStore((s) => s.snapshot.tick);
  const [left, setLeft] = useState(0);
  useEffect(() => {
    const f = () => setLeft(Math.max(0, Math.ceil((provider.tickMs - (now() % provider.tickMs)) / 1000)));
    f();
    const id = setInterval(f, 1000);
    return () => clearInterval(id);
  }, [now, tick]);
  return left;
}
