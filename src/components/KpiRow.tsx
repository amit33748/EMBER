import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ChevronUp, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { useStore } from '../store';
import { StatTile } from '../ui/StatTile';
import { CountUp } from '../ui/CountUp';
import { ZONES } from '../geo/zones';
import { distKm } from '../sim/geoutil';
import { RESPONSE_TARGET_MIN, RESPONSE_WINDOW_H } from '../analysis/kpis';
import { t } from '../i18n/en';

const fmtPop = (n: number) => (n >= 1e6 ? `${(n / 1e6).toFixed(2)}M` : n === 0 ? '0' : `${Math.round(n / 1000)}k`);
const fmtClock = (ms: number) => new Date(ms).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Kolkata' });

export function useKpiTiles() {
  const k = useStore((s) => s.kpis);
  const history = useStore((s) => s.history);
  const kde = useStore((s) => s.kde);
  const snap = useStore((s) => s.snapshot);
  const surface = useStore((s) => s.surface);
  const setSurface = useStore((s) => s.setSurface);
  const selectZone = useStore((s) => s.selectZone);

  const peakZone = useMemo(() => {
    if (!kde?.peak) return null;
    const [lon, lat] = kde.peak;
    return ZONES.reduce((best, z) => (distKm(lon, lat, z.lon, z.lat) < distKm(lon, lat, best.lon, best.lat) ? z : best), ZONES[0]);
  }, [kde]);
  const hottest = useMemo(() => [...snap.zones].sort((a, b) => b.fhs - a.fhs)[0], [snap]);

  const fhsSpark = history.filter((_, i) => i % 6 === 0).map((h) => h.districtFhs);
  const activeSpark = history.filter((_, i) => i % 6 === 0).map((h) => h.active);
  const win = `${RESPONSE_WINDOW_H}h`;

  return [
    { key: 'fhs', tier: 1, label: 'District FHS', short: 'FHS', value: <CountUp value={k.districtFhs} />, unit: '/100', spark: fhsSpark, sparkDomain: [0, 100] as [number, number], accent: `var(--hz-${k.districtBand})`, hint: 'Population-weighted mean Fire Hazard Score (prototype index). Sparkline: last 24 h on a fixed 0–100 scale.' },
    { key: 'active', tier: 1, label: 'Active', value: <CountUp value={k.active} />, spark: activeSpark, sparkDomain: [0, Math.max(3, ...activeSpark)] as [number, number], accent: 'var(--hz-3)', active: surface === 'incident', onClick: () => setSurface(surface === 'incident' ? 'hazard' : 'incident'), hint: 'Incidents not yet closed. Click: toggle the incident-density surface.' },
    { key: '24h', tier: 3, label: 'Last 24h', value: <CountUp value={k.last24h} />, delta: k.last24hDeltaPct, meta: 'vs prior 24h', hint: 'Reported in the last 24 h; change vs. the previous 24 h.' },
    { key: 'resp', tier: 4, label: 'Avg response', value: k.avgResponseMin == null ? '—' : <CountUp value={k.avgResponseMin} decimals={1} />, unit: 'min', meta: `n=${k.nArrived} · ${win}`, hint: `Report → arrival, rolling ${win}, n = calls with an arrival.` },
    { key: 'comp', tier: 4, label: 'On-time', value: k.compliancePct == null ? '—' : <CountUp value={k.compliancePct} />, unit: '%', meta: `n=${k.nArrived} · ${win}`, accent: (k.compliancePct ?? 0) >= 80 ? 'var(--ok)' : 'var(--warn)', hint: `Arrivals within ${RESPONSE_TARGET_MIN.urban} min urban / ${RESPONSE_TARGET_MIN.rural} min rural, rolling ${win}.` },
    { key: 'contain', tier: 5, label: 'Containment', value: k.avgContainMin == null ? '—' : <CountUp value={k.avgContainMin} />, unit: 'min', meta: `n=${k.nContained} · ${win}`, hint: `Arrival → contained, rolling ${win}.` },
    { key: 'risk', tier: 1, label: 'High+ zones', short: 'High+', value: <CountUp value={k.atRiskZones} />, unit: `/ ${ZONES.length}`, meta: 'FHS ≥ 40', accent: 'var(--hz-3)', onClick: hottest ? () => selectZone(hottest.zoneId) : undefined, hint: 'Zones at High, Very High or Extreme. Click: open the hottest zone.' },
    { key: 'pop', tier: 3, label: 'Pop. High+', value: fmtPop(k.popAtRisk), meta: `${k.atRiskZones} zones`, hint: 'Approx. population living in High+ zones (same threshold as “High+ zones”).' },
    { key: 'peak', tier: 2, label: 'Next peak', value: k.nextPeak ? fmtClock(k.nextPeak.t) : '—', meta: k.nextPeak ? `FHS ${Math.round(k.nextPeak.fhs)} · ${t.bands[k.nextPeak.band]}` : undefined, accent: k.nextPeak ? `var(--hz-${k.nextPeak.band})` : undefined, hint: k.nextPeak ? `Highest district score expected in the next 24 h: ${Math.round(k.nextPeak.fhs)} (${t.bands[k.nextPeak.band]}). Weather-driven outlook.` : undefined },
    { key: 'hot', tier: 5, label: 'Peak density', value: peakZone ? peakZone.name.split(/[·(]/)[0].trim() : '—', textValue: true, meta: 'hottest cell', onClick: peakZone ? () => selectZone(peakZone.id) : undefined, hint: 'Zone nearest the highest cell of the hazard density surface. Click: open it.' },
  ];
}

export function KpiRow() {
  const tiles = useKpiTiles();
  const [collapsed, setCollapsed] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ left: false, right: false });

  const measure = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    setEdges({ left: el.scrollLeft > 4, right: el.scrollLeft + el.clientWidth < el.scrollWidth - 4 });
  }, []);
  useEffect(() => {
    measure();
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [measure, collapsed]);

  const rowRef = useRef<HTMLElement>(null);
  useEffect(() => {
    const el = rowRef.current;
    if (!el) return;
    const set = () => document.documentElement.style.setProperty('--kpi-bottom', `${Math.round(el.getBoundingClientRect().bottom)}px`);
    const ro = new ResizeObserver(set);
    ro.observe(el);
    set();
    return () => ro.disconnect();
  }, [collapsed]);

  const nudge = (dir: 1 | -1) => ref.current?.scrollBy({ left: dir * ref.current.clientWidth * 0.8, behavior: 'smooth' });

  return (
    <section ref={rowRef} className="kpi-row" aria-labelledby="kpi-h" data-collapsed={collapsed || undefined}>
      <h2 id="kpi-h" className="sr-only">Key indicators</h2>
      <div className="kpi-wrap" data-left={edges.left || undefined} data-right={edges.right || undefined}>
        <div ref={ref} className="kpi-scroll scroll-thin" onScroll={measure}>
          {tiles.map(({ key, ...p }) => <StatTile key={key} {...p} />)}
        </div>
        {edges.left && <button type="button" className="icon-btn kpi-nudge l" onClick={() => nudge(-1)} aria-label="Scroll indicators left"><ChevronLeft size={14} /></button>}
        {edges.right && <button type="button" className="icon-btn kpi-nudge r" onClick={() => nudge(1)} aria-label="Scroll indicators right"><ChevronRight size={14} /></button>}
      </div>
      <button type="button" className="icon-btn kpi-collapse" onClick={() => setCollapsed((v) => !v)} aria-expanded={!collapsed} aria-label={collapsed ? 'Show KPIs' : 'Hide KPIs'}>
        {collapsed ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
      </button>
    </section>
  );
}
