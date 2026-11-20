import type { ZoneDef, Station } from '../data/types';

/**
 * ~20 Gurugram zones. Centroids are real locations; polygons are a
 * Voronoi approximation (see geo/zones.ts). Population is a rough
 * prototype estimate, not census data.
 */
export const ZONE_DEFS: ZoneDef[] = [
  { id: 'cyber', name: 'DLF Cyber City', lon: 77.0888, lat: 28.4949, landUse: 'commercial', fuel: 0.55, population: 60000, urban: true },
  { id: 'udyog', name: 'Udyog Vihar', lon: 77.0790, lat: 28.5060, landUse: 'industrial', fuel: 0.85, population: 90000, urban: true },
  { id: 'palam', name: 'Palam Vihar', lon: 77.0390, lat: 28.5110, landUse: 'residential', fuel: 0.4, population: 110000, urban: true },
  { id: 'mgroad', name: 'MG Road', lon: 77.0800, lat: 28.4800, landUse: 'commercial', fuel: 0.5, population: 85000, urban: true },
  { id: 'sadar', name: 'Sadar Bazaar · Old City', lon: 77.0300, lat: 28.4650, landUse: 'market', fuel: 0.9, population: 210000, urban: true },
  { id: 'sec29', name: 'Sector 29 · Leisure Valley', lon: 77.0650, lat: 28.4680, landUse: 'commercial', fuel: 0.45, population: 70000, urban: true },
  { id: 'sushant', name: 'Sushant Lok', lon: 77.0750, lat: 28.4590, landUse: 'residential', fuel: 0.4, population: 95000, urban: true },
  { id: 'golf', name: 'Golf Course Road', lon: 77.1000, lat: 28.4500, landUse: 'commercial', fuel: 0.5, population: 120000, urban: true },
  { id: 'gcext', name: 'Golf Course Ext. Road', lon: 77.0900, lat: 28.4100, landUse: 'residential', fuel: 0.42, population: 140000, urban: true },
  { id: 'sohnard', name: 'Sohna Road', lon: 77.0450, lat: 28.4200, landUse: 'residential', fuel: 0.5, population: 160000, urban: true },
  { id: 'badshahpur', name: 'Badshahpur', lon: 77.0500, lat: 28.3900, landUse: 'residential', fuel: 0.55, population: 90000, urban: true },
  { id: 'newgur', name: 'New Gurugram (Sec 80–95)', lon: 76.9750, lat: 28.4100, landUse: 'residential', fuel: 0.45, population: 150000, urban: true },
  { id: 'dwarka', name: 'Dwarka Expressway', lon: 77.0050, lat: 28.4800, landUse: 'residential', fuel: 0.48, population: 170000, urban: true },
  { id: 'bandhwari', name: 'Bandhwari Landfill', lon: 77.1640, lat: 28.4170, landUse: 'landfill', fuel: 1.0, population: 8000, urban: false },
  { id: 'aravalli', name: 'Aravalli Forest Belt', lon: 77.1450, lat: 28.4550, landUse: 'forest', fuel: 0.88, population: 12000, urban: false },
  { id: 'manesar', name: 'IMT Manesar', lon: 76.9350, lat: 28.3600, landUse: 'industrial', fuel: 0.9, population: 120000, urban: true },
  { id: 'sohna', name: 'Sohna', lon: 77.0700, lat: 28.2480, landUse: 'rural', fuel: 0.6, population: 75000, urban: false },
  { id: 'pataudi', name: 'Pataudi', lon: 76.7800, lat: 28.3250, landUse: 'rural', fuel: 0.62, population: 60000, urban: false },
  { id: 'farrukh', name: 'Farrukhnagar', lon: 76.8250, lat: 28.4470, landUse: 'rural', fuel: 0.6, population: 55000, urban: false },
  { id: 'bilaspur', name: 'Bilaspur · Tauru Rd', lon: 76.8900, lat: 28.3000, landUse: 'industrial', fuel: 0.75, population: 40000, urban: false },
  { id: 'damdama', name: 'Damdama · South Aravalli', lon: 77.1300, lat: 28.3100, landUse: 'forest', fuel: 0.8, population: 15000, urban: false },
];

export const STATIONS: Station[] = [
  { id: 'st-sushant', name: 'Sushant Lok Fire Station', lon: 77.0730, lat: 28.4637, units: 4, source: 'osm' },
  { id: 'st-udyog', name: 'Udyog Vihar Fire Station', lon: 77.0639, lat: 28.4960, units: 5, source: 'osm' },
  { id: 'st-sec29', name: 'Sector 29 Fire Station', lon: 77.0640, lat: 28.4675, units: 4, source: 'approx' },
  { id: 'st-bhim', name: 'Bhim Nagar Fire Station', lon: 77.0250, lat: 28.4590, units: 4, source: 'approx' },
  { id: 'st-sec37', name: 'Sector 37 Fire Station', lon: 77.0080, lat: 28.4400, units: 3, source: 'approx' },
  { id: 'st-manesar', name: 'IMT Manesar Fire Station', lon: 76.9380, lat: 28.3600, units: 4, source: 'approx' },
  { id: 'st-sohna', name: 'Sohna Fire Station', lon: 77.0650, lat: 28.2480, units: 2, source: 'approx' },
  { id: 'st-pataudi', name: 'Pataudi Fire Station', lon: 76.7800, lat: 28.3240, units: 2, source: 'approx' },
];
