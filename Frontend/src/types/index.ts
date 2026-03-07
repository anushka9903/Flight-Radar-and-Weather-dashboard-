// ── Aircraft ────────────────────────────────────────────────────────────────
export interface Aircraft {
  icao: string;
  callsign: string | null;
  latitude: number;
  longitude: number;
  altitude: number;       // feet
  velocity: number;       // km/h or knots depending on source
  heading: number;        // degrees 0-360
  on_ground: boolean;
}

export interface AircraftListResponse {
  count: number;
  aircraft: Aircraft[];
}

// ── Conflicts ───────────────────────────────────────────────────────────────
export interface Conflict {
  aircraft_1: string;
  aircraft_2: string;
  horizontal_km: number;
  vertical_ft: number;
}

export interface PredictedConflict extends Conflict {
  predicted_in_seconds: number;
}

export interface ConflictResponse {
  count: number;
  conflicts: Conflict[];
}

export interface PredictedConflictResponse {
  count: number;
  conflicts: PredictedConflict[];
}

// ── Weather ─────────────────────────────────────────────────────────────────
export interface WeatherData {
  latitude: number;
  longitude: number;
  temperature: number;     // Celsius
  humidity: number;        // 0-100
  pressure: number;        // hPa
  wind_speed: number;      // m/s
  wind_direction: number;  // degrees
  cloud_cover: number;     // 0-100
  visibility: number;      // metres
  condition: string;
  source: string;
}

export interface WeatherCell {
  cell_key: string;
  data: WeatherData;
}

export interface WeatherGridResponse {
  count: number;
  cells: WeatherCell[];
}

export interface WeatherAdvisory {
  aircraft: string;
  severity: "LOW" | "MEDIUM" | "HIGH";
  warnings: string[];
}

export interface WeatherAdvisoryResponse {
  count: number;
  advisories: WeatherAdvisory[];
}

// ── Snapshot ────────────────────────────────────────────────────────────────
export interface SnapshotResponse {
  aircraft: AircraftListResponse;
  conflicts: ConflictResponse;
  weather: WeatherGridResponse;
  advisories: WeatherAdvisoryResponse;
}

// ── UI State ─────────────────────────────────────────────────────────────────
export type WeatherMode = "none" | "temperature" | "wind" | "precipitation" | "clouds" | "humidity";
export type Theme = "day" | "night";
export type ConnectionStatus = "connected" | "disconnected" | "connecting" | "reconnecting";

// ── Map ──────────────────────────────────────────────────────────────────────
export interface MapState {
  zoom: number;
  center: [number, number];
  bearing: number;
  pitch: number;
}
