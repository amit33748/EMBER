# Ember — Gurugram Fire Hazard (prototype)

Live fire-hazard density map + landing page for Gurugram district, Haryana.
**All data is simulated** (deterministic, 5-minute ticks). Design and components are production-grade; production swaps only the data provider.

```bash
npm install
npm run dev      # http://localhost:5173  ( / landing, /live dashboard )
npm test         # sim determinism, FFWI, KDE, KPI math, model calibration, token contrast
npm run gen:geo  # rebuild Voronoi zone polygons (src/geo/zones.generated.json)
npm run build
```

Dev aids: `/live?tick=-3` starts 3 ticks (15 min) in the past (future offsets are rejected); `Alt+]` advances one tick.

## Features
- Hazard / incident **kernel-density surface** + contours, with controls for bandwidth (0.5–3 km), incident window (1h/6h/24h) and weighting (severity × recency / count)
- **Globe → district fly-in** on first visit per session (MapLibre v5 globe; skipped with reduced motion)
- **Wind flow** (off by default): illustrative seasonal circulation over India & the Indian Ocean, blended with the simulated local wind; pauses in 3D
- **Basemap switcher**: Auto, Paper, Soot, Liberty, Bright, Fiord (OpenFreeMap), Satellite (Sentinel-2 cloudless, EOX, CC BY-NC-SA), Topographic (OpenTopoMap). Thumbnails: `npm run gen:thumbs`
- **Terrain relief** (AWS Terrain Tiles, ×3, z11 mesh) + hillshade; wind pauses in 3D
- **3D density columns** (1 km cells) instead of zone plateaus
- **History replay** (7 days, up to 2.5 h/s) and **summer-peak scenario** for demos
- **Next-peak forecast** KPI; response KPIs on a rolling 72 h window with sample size
- **Command palette** — `Ctrl/⌘ K` or `/`: zones, stations, layers, surfaces, themes
- KPI strip, zone drill-down, incident feed, light/dark/system theme

## Architecture
| Layer | Path |
|---|---|
| Design tokens (light/dark) | `src/styles/tokens.css` |
| UI kit (pure, prop-driven) | `src/ui/` |
| Data schema + provider seam | `src/data/types.ts`, `src/data/provider.ts` |
| Simulator | `src/sim/`, `src/data/SimulatedProvider.ts` |
| Hazard model (Fosberg FFWI + fuel + ignition) | `src/analysis/hazard.ts` |
| KDE (Web Worker) + contours | `src/analysis/kde*.ts`, `src/map/density.ts` |
| KPIs | `src/analysis/kpis.ts` |
| Map (MapLibre + OpenFreeMap) | `src/map/MapView.tsx` |

**Going to production:** implement `DataProvider` with a real feed and change the one line in `src/store.ts` that constructs `SimulatedProvider`.

## Honest limits
- Fire Hazard Score is a prototype index, not an official rating.
- Zones are Voronoi cells around real centroids; populations are rough estimates; 6 of 8 station locations are approximate (2 from OSM).
- District boundary: OpenStreetMap relation 3577685 (ODbL). Basemap: OpenFreeMap (no SLA — self-host PMTiles for production). Terrain: AWS Terrain Tiles (public S3, no SLA).
- Wind is one district-wide vector with a cosmetic wobble, not a modelled wind field.
- Audit and fixes: see `docs/audit/REPORT.md` (re-run with `node scripts/audit-probe.mjs` and `node scripts/shoot.mjs scripts/spec-after.json`).
