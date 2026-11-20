import type { Snapshot, HistoryPoint, Zone, Station, Incident } from './types';

/**
 * The only seam between data and UI. Production swaps the implementation
 * (e.g. a fire-service feed) without touching components.
 */
export interface DataProvider {
  readonly label: string; // shown in UI, e.g. "Simulated"
  readonly simulated: boolean;
  readonly tickMs: number;
  zones(): Zone[];
  stations(): Station[];
  getSnapshot(at?: number): Snapshot;
  getHistory(at?: number): HistoryPoint[];
  /** Single history point for a tick index (enables O(1) history updates while replaying). */
  getHistoryPoint(tick: number): HistoryPoint;
  /** Outlook for the next 24 h. A real provider would call a weather forecast. */
  getForecast(at?: number): HistoryPoint[];
  /** Incidents reported within `hours` before `at`, status as of `at`. */
  getIncidentsWindow(at: number, hours: number): Incident[];
}
