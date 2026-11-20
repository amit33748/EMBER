import { Fragment, lazy, Suspense, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { motion, useScroll, useTransform } from 'motion/react';
import { ArrowRight, Phone, Flame as FlameIcon, Factory, Trash2, Zap, Wheat, ShieldAlert } from 'lucide-react';
import { useStore } from '../store';
import { ZONE_BY_ID } from '../geo/zones';
import { useKpiTiles } from '../components/KpiRow';
import { LiveBadge } from '../components/TopBar';
import { StatTile } from '../ui/StatTile';
import { Wordmark } from '../ui/Wordmark';
import { ErrorBoundary } from '../ui/ErrorBoundary';
import { ThemeToggle } from '../ui/ThemeToggle';
import { BandChip } from '../ui/BandChip';
import { Gauge } from '../ui/Gauge';
import { Sparkline } from '../ui/Sparkline';
import { BandTrend } from '../ui/BandTrend';
import { CountUp } from '../ui/CountUp';
import { BAND_CUTS } from '../analysis/hazard';
import { t } from '../i18n/en';
import type { Band, IncidentType } from '../data/types';
import { IncidentMix } from '../ui/IncidentMix';
import { TYPE_COLORS } from '../components/DistrictPanel';

const MapView = lazy(() => import('../map/MapView').then((m) => ({ default: m.MapView })));

const reveal = {
  initial: { opacity: 0, y: 28 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: '-80px' },
  transition: { duration: 0.8, ease: [0.16, 1, 0.3, 1] as const },
};

function Nav() {
  return (
    <nav className="l-nav" aria-label="Main">
      <Wordmark />
      <div className="l-nav-links">
        <a href="#snapshot">Snapshot</a>
        <a href="#method">Method</a>
        <a href="#scale">Scale</a>
        <a href="#safety">Safety</a>
      </div>
      <div className="flex items-center gap-2">
        <span className="l-nav-badge"><LiveBadge /></span>
        <ThemeToggle />
        <Link to="/live" className="btn btn-primary btn-sm">Live map <ArrowRight size={14} /></Link>
      </div>
    </nav>
  );
}

function Hero() {
  const k = useStore((s) => s.kpis);
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end start'] });
  const mapScale = useTransform(scrollYProgress, [0, 1], [1, 1.12]);
  const mapOpacity = useTransform(scrollYProgress, [0, 0.9], [1, 0.2]);
  const textY = useTransform(scrollYProgress, [0, 1], [0, -80]);

  return (
    <header ref={ref} className="hero">
      <motion.div className="hero-map" style={{ scale: mapScale, opacity: mapOpacity }} aria-hidden>
        <Suspense fallback={null}>
          <ErrorBoundary fallback={null}>
          <MapView variant="hero" padding={{ top: 40, bottom: 0, left: 520, right: 400 }} />
          </ErrorBoundary>
        </Suspense>
      </motion.div>
      <div className="hero-scrim" aria-hidden />

      <motion.div className="hero-inner" style={{ y: textY }}>
        <div className="hero-copy">
          <motion.div className="eyebrow" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }}>
            Gurugram district · Haryana · 28.46°N 77.03°E
          </motion.div>
          <h1 className="hero-title">
            {['Every', 'ember,', 'mapped.'].map((w, i) => (
              <Fragment key={w}>
              {i > 0 && ' '}
              <motion.span
                className={i === 1 ? 'ember-word' : undefined}
                initial={{ opacity: 0, y: '0.5em', filter: 'blur(8px)' }}
                animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                transition={{ delay: 0.15 + i * 0.12, duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
              >
                {w}
              </motion.span>
              </Fragment>
            ))}
          </h1>
          <motion.p className="hero-sub" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.55, duration: 0.8 }}>
            A live fire-hazard surface for Gurugram. Weather, fuel and incident pressure fused into one density map — refreshed every five minutes.
          </motion.p>
          <motion.div className="hero-ctas" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.7, duration: 0.8 }}>
            <Link to="/live" className="btn btn-primary">Open live map <ArrowRight size={16} /></Link>
            <a href="#method" className="btn btn-ghost">How it works</a>
          </motion.div>
        </div>

        <motion.aside
          className="hero-card glass"
          aria-label="Current district hazard"
          initial={{ opacity: 0, y: 30, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ delay: 0.5, duration: 1, ease: [0.16, 1, 0.3, 1] }}
        >
          <div className="flex items-center justify-between">
            <span className="eyebrow">District now</span>
            <BandChip band={k.districtBand} />
          </div>
          <div className="hero-card-num" style={{ color: `var(--hz-ink-${k.districtBand})` }}><CountUp value={k.districtFhs} /></div>
          <div className="mono hero-card-cap">Fire hazard score / 100 · prototype</div>
          <div className="hero-card-grid">
            <div><span className="eyebrow">Active</span><b className="mono"><CountUp value={k.active} /></b></div>
            <div><span className="eyebrow">24h</span><b className="mono"><CountUp value={k.last24h} /></b></div>
            <div><span className="eyebrow">Response</span><b className="mono">{k.avgResponseMin ? <CountUp value={k.avgResponseMin} decimals={1} /> : '—'}<small>min</small></b></div>
            <div><span className="eyebrow">High+</span><b className="mono"><CountUp value={k.atRiskZones} /><small>/ 21</small></b></div>
          </div>
        </motion.aside>
      </motion.div>

      <div className="hero-watermark mono">{t.simulated}</div>
      <a href="#snapshot" className="scroll-cue" aria-label="Scroll to live snapshot"><span /></a>
    </header>
  );
}

function Snapshot() {
  const tiles = useKpiTiles().map(({ onClick, active, ...rest }) => rest); // static on landing
  const k = useStore((s) => s.kpis);
  const history = useStore((s) => s.history);
  const forecast = useStore((s) => s.forecast);
  return (
    <section id="snapshot" className="l-section">
      <motion.div {...reveal} className="l-head">
        <span className="eyebrow">01 · Live snapshot</span>
        <h2>The district, <em>right now.</em></h2>
        <p>Ten indicators and an incident mix, recomputed every tick. Same numbers every viewer sees — one shared clock.</p>
      </motion.div>
      <div className="bento">
        <motion.div {...reveal} className="bento-feature glass">
          <span className="eyebrow">District Fire Hazard Score · past 24h → outlook</span>
          <div className="flex items-end gap-6" style={{ marginTop: 12 }}>
            <div className="bento-num" style={{ color: `var(--hz-ink-${k.districtBand})` }}><CountUp value={k.districtFhs} /></div>
            <div style={{ width: 220, maxWidth: '45%' }}><Gauge value={k.districtFhs} /></div>
          </div>
          <div style={{ marginTop: 'auto' }}>
            <BandTrend
              values={history.filter((_, i) => i % 3 === 2).map((h) => h.districtFhs)}
              future={forecast.map((f) => f.districtFhs)}
              height={110}
              color={`var(--hz-${k.districtBand})`}
              label="District hazard score, last 24 hours and next-24-hour outlook"
              xLabels={['−24h', 'now', '+24h']}
            />
          </div>
        </motion.div>
        {tiles.slice(1).map(({ key, ...p }, i) => (
          <motion.div key={key} {...reveal} transition={{ ...reveal.transition, delay: 0.04 * i }} className="bento-cell">
            <StatTile {...p} />
          </motion.div>
        ))}
        <motion.div {...reveal} className="bento-cell bento-mix glass">
          <IncidentMix
            size={104}
            hideEmpty
            segs={(Object.keys(k.typeMix) as IncidentType[]).map((ty) => ({ key: ty, label: t.types[ty], value: k.typeMix[ty], color: TYPE_COLORS[ty] }))}
          />
        </motion.div>
      </div>
    </section>
  );
}

function Method() {
  const steps = [
    {
      n: '01', title: 'Points', body: 'Every incident, plus thousands of weighted hazard samples drawn from land use — landfill edges, industrial yards, dense markets, dry Aravalli scrub.',
      art: (
        <svg viewBox="0 0 200 120" className="m-art" aria-hidden>
          {Array.from({ length: 46 }).map((_, i) => {
            const a = (i * 137.5 * Math.PI) / 180, r = 8 + (i % 9) * 5.5;
            const cx = (i % 3 === 0 ? 70 : 125) + Math.cos(a) * r * 0.9, cy = 60 + Math.sin(a) * r * 0.6;
            return <circle key={i} cx={cx} cy={cy} r={i % 7 === 0 ? 3.2 : 1.8} fill={i % 7 === 0 ? 'var(--hz-3)' : 'var(--text-2)'} style={{ animationDelay: `${i * 40}ms` }} className="m-dot" />;
          })}
        </svg>
      ),
    },
    {
      n: '02', title: 'Density', body: 'A quartic kernel spreads each point over 1.4 km, on a 200 m grid clipped to the district. Contours trace the ridgelines of risk.',
      art: (
        <svg viewBox="0 0 200 120" className="m-art" aria-hidden>
          <defs>
            <radialGradient id="mk1"><stop offset="0" stopColor="var(--hz-4)" /><stop offset=".35" stopColor="var(--hz-3)" /><stop offset=".65" stopColor="var(--hz-2)" stopOpacity=".7" /><stop offset="1" stopColor="var(--hz-1)" stopOpacity="0" /></radialGradient>
            <radialGradient id="mk2"><stop offset="0" stopColor="var(--hz-2)" /><stop offset=".6" stopColor="var(--hz-1)" stopOpacity=".6" /><stop offset="1" stopColor="var(--hz-0)" stopOpacity="0" /></radialGradient>
          </defs>
          <ellipse cx="125" cy="60" rx="62" ry="44" fill="url(#mk1)" className="m-breathe" />
          <ellipse cx="62" cy="58" rx="46" ry="34" fill="url(#mk2)" className="m-breathe" style={{ animationDelay: '1s' }} />
          {[40, 28, 16].map((r, i) => <ellipse key={r} cx="125" cy="60" rx={r * 1.3} ry={r} fill="none" stroke="var(--text)" strokeOpacity={0.25 + i * 0.2} strokeWidth=".8" />)}
        </svg>
      ),
    },
    {
      n: '03', title: 'Score', body: 'Each zone gets a 0–100 Fire Hazard Score: Fosberg fire-weather (40%), fuel & land use (35%), recent ignition pressure (25%).',
      art: (
        <svg viewBox="0 0 200 120" className="m-art" aria-hidden>
          {[0, 1, 2, 3, 4].map((b) => (
            <rect key={b} x={22 + b * 34} y={100 - (b + 1) * 16} width="26" height={(b + 1) * 16} rx="4" fill={`var(--hz-${b})`} className="m-bar" style={{ animationDelay: `${b * 120}ms` }} />
          ))}
          <line x1="14" x2="186" y1="100.5" y2="100.5" stroke="var(--line-strong)" />
        </svg>
      ),
    },
  ];
  return (
    <section id="method" className="l-section">
      <motion.div {...reveal} className="l-head">
        <span className="eyebrow">02 · Method</span>
        <h2>From scattered points <em>to a surface you can read.</em></h2>
      </motion.div>
      <ol className="method">
        {steps.map((s, i) => (
          <motion.li key={s.n} {...reveal} transition={{ ...reveal.transition, delay: i * 0.12 }} className="method-step glass">
            {s.art}
            <div className="flex items-baseline gap-3" style={{ marginTop: 18 }}>
              <span className="mono" style={{ color: 'var(--accent)', fontSize: 'var(--fs-sm)' }}>{s.n}</span>
              <h3>{s.title}</h3>
            </div>
            <p>{s.body}</p>
          </motion.li>
        ))}
      </ol>
    </section>
  );
}

function Scale() {
  const ranges = [0, ...BAND_CUTS, 100];
  return (
    <section id="scale" className="l-section">
      <motion.div {...reveal} className="l-head">
        <span className="eyebrow">03 · Hazard scale</span>
        <h2>Five bands. <em>One action each.</em></h2>
        <p>{t.prototypeIndex}.</p>
      </motion.div>
      <div className="scale">
        {([0, 1, 2, 3, 4] as Band[]).map((b) => (
          <motion.div key={b} {...reveal} transition={{ ...reveal.transition, delay: b * 0.07 }} className="scale-row" style={{ ['--c' as string]: `var(--hz-${b})`, ['--ink' as string]: `var(--hz-ink-${b})` }}>
            <div className="scale-swatch" />
            <div className="mono scale-range">{ranges[b]}–{ranges[b + 1]}</div>
            <div className="scale-name">{t.bands[b]}</div>
            <p className="scale-advice">{t.bandAdvice[b]}</p>
          </motion.div>
        ))}
      </div>
    </section>
  );
}

function Spotlight() {
  const snap = useStore((s) => s.snapshot);
  const history = useStore((s) => s.history);
  const top = [...snap.zones].sort((a, b) => b.fhs - a.fhs).slice(0, 5);
  return (
    <section className="l-section">
      <motion.div {...reveal} className="l-head">
        <span className="eyebrow">04 · Zone spotlight</span>
        <h2>Where the heat <em>sits today.</em></h2>
      </motion.div>
      <div className="spot">
        {top.map((z, i) => {
          const zone = ZONE_BY_ID[z.zoneId];
          return (
            <motion.div key={z.zoneId} {...reveal} transition={{ ...reveal.transition, delay: i * 0.08 }}>
              <Link to="/live" onClick={() => useStore.getState().selectZone(z.zoneId)} className="spot-card glass">
                <div className="flex justify-between items-start">
                  <span className="mono" style={{ color: 'var(--text-3)', fontSize: 'var(--fs-xs)' }}>#{i + 1}</span>
                  <BandChip band={z.band} />
                </div>
                <h3>{zone.name}</h3>
                <div className="eyebrow">{t.landUse[zone.landUse]}</div>
                <div className="spot-num mono" style={{ color: `var(--hz-ink-${z.band})` }}>{Math.round(z.fhs)}</div>
                <Sparkline values={history.map((h) => h.zoneFhs[z.zoneId])} height={36} color={`var(--hz-${z.band})`} min={0} max={100} label={`${zone.name}, last 24 hours, 0 to 100 scale`} />
              </Link>
            </motion.div>
          );
        })}
      </div>
    </section>
  );
}

function Safety() {
  const tips = [
    { icon: Trash2, title: 'Landfill & garbage', body: 'Never burn waste. Report smouldering heaps near Bandhwari and roadside dumps.' },
    { icon: Factory, title: 'Industrial units', body: 'Pause hot-work on Very High days. Keep hydrants and exits clear in Udyog Vihar and IMT Manesar.' },
    { icon: Zap, title: 'Electrical', body: 'Overloaded meters and tangled wiring cause most market fires. Use certified electricians.' },
    { icon: Wheat, title: 'Stubble season', body: 'Oct–Nov crop-residue burning raises smoke and spot fires on the rural fringe.' },
  ];
  return (
    <section id="safety" className="l-section">
      <div className="safety">
        <motion.div {...reveal} className="safety-call glass">
          <ShieldAlert size={22} style={{ color: 'var(--accent)' }} />
          <span className="eyebrow">In an emergency</span>
          <div className="safety-nums">
            <a href="tel:101"><span className="mono">101</span><small>Fire</small></a>
            <a href="tel:112"><span className="mono">112</span><small>Emergency</small></a>
          </div>
          <p>These numbers are real. Everything else on this site is simulated.</p>
        </motion.div>
        <div className="safety-tips">
          <motion.div {...reveal} className="l-head" style={{ marginBottom: 24 }}>
            <span className="eyebrow">05 · Prevention</span>
            <h2>Most fires <em>start small.</em></h2>
          </motion.div>
          <div className="tips">
            {tips.map((tp, i) => (
              <motion.div key={tp.title} {...reveal} transition={{ ...reveal.transition, delay: i * 0.08 }} className="tip">
                <tp.icon size={18} />
                <h3>{tp.title}</h3>
                <p>{tp.body}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function Notice() {
  return (
    <section className="l-section">
      <motion.div {...reveal} className="notice">
        <span className="notice-tag mono">Prototype</span>
        <div>
          <h3>Simulated data, real design.</h3>
          <p>
            Incidents, weather and scores on this site are generated by a deterministic simulator on a 5-minute clock. The district boundary is from
            OpenStreetMap; zones are Voronoi approximations; some station locations are approximate. Do not use for operational decisions.
          </p>
        </div>
        <Link to="/live" className="btn btn-primary">Explore the live map <ArrowRight size={16} /></Link>
      </motion.div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="l-footer">
      <div className="l-footer-big" aria-hidden>EMBER</div>
      <div className="l-footer-row">
        <div className="flex items-center gap-2"><FlameIcon size={14} style={{ color: 'var(--accent)' }} /> <span>Gurugram Fire Hazard · prototype</span></div>
        <div className="l-credits">
          Built with open source: <a href="https://maplibre.org" target="_blank" rel="noreferrer">MapLibre GL</a> ·{' '}
          <a href="https://openfreemap.org" target="_blank" rel="noreferrer">OpenFreeMap</a> · map data ©{' '}
          <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap contributors</a> (ODbL)
        </div>
        <ThemeToggle />
      </div>
    </footer>
  );
}

export default function Landing() {
  useEffect(() => { document.title = 'Ember · Gurugram Fire Hazard'; }, []);
  return (
    <div className="landing">
      <a href="#snapshot" className="skip">Skip to content</a>
      <Nav />
      <Hero />
      <main>
        <Snapshot />
        <Method />
        <Scale />
        <Spotlight />
        <Safety />
        <Notice />
      </main>
      <Footer />
      <a href="tel:101" className="sos" aria-label="Call fire emergency 101"><Phone size={14} /> 101</a>
    </div>
  );
}
