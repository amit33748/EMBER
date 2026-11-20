/* Canonical data schema. Production providers must emit exactly these shapes. */

export type LandUse =
  | 'industrial'
  | 'landfill'
  | 'forest'
  | 'market'
  | 'residential'
  | 'commercial'
  | 'rural';

export type IncidentType =
  | 'building'
  | 'industrial'
  | 'vehicle'
  | 'garbage'
  | 'scrub'
  | 'electrical';

export type IncidentStatus = 'reported' | 'responding' | 'contained' | 'closed';

export type Band = 0 | 1 | 2 | 3 | 4; // Low · Moderate · High · Very High · Extreme

export interface ZoneDef {
  id: string;
  name: string;
  lon: number;
  lat: number;
  landUse: LandUse;
  /** 0..1 static fuel/exposure factor */
  fuel: number;
  population: number;
  urban: boolean;
}

export interface Zone extends ZoneDef {
  polygon: GeoJSON.Polygon | GeoJSON.MultiPolygon;
}

export interface Station {
  id: string;
  name: string;
  lon: number;
  lat: number;
  units: number;
  source: 'osm' | 'approx';
}

export interface WeatherObs {
  t: number; // epoch ms
  tempC: number;
  rh: number; // %
  windKmh: number;
  windDir: number; // deg from
  ffwi: number; // Fosberg 0..100
}

export interface Incident {
  id: string;
  type: IncidentType;
  zoneId: string;
  lon: number;
  lat: number;
  severity: 1 | 2 | 3;
  reportedAt: number;
  arrivedAt: number;
  containedAt: number;
  closedAt: number;
  stationId: string;
  status: IncidentStatus;
}

/** Generic weighted point fed to the density surface. */
export interface PointEvent {
  lon: number;
  lat: number;
  w: number;
}

export interface ZoneState {
  zoneId: string;
  fhs: number; // 0..100
  band: Band;
  weather: number; // component 0..100
  fuel: number; // effective fuel × activity, 0..FUEL_CAP
  ignition: number; // component 0..100
}

export interface Snapshot {
  tick: number; // 5-min epoch index
  t: number; // epoch ms of tick start
  weather: WeatherObs;
  zones: ZoneState[];
  incidents: Incident[]; // all incidents in last 24h with status as of t
  hazardPoints: PointEvent[];
}

export interface HistoryPoint {
  t: number;
  districtFhs: number;
  zoneFhs: Record<string, number>;
  active: number;
}
