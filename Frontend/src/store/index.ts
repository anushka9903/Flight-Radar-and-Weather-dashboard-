import { create } from "zustand";
import {
  Aircraft,
  Conflict,
  PredictedConflict,
  WeatherCell,
  WeatherAdvisory,
  WeatherMode,
  Theme,
  ConnectionStatus,
} from "../types";

interface AppState {
  // ── Aircraft ──────────────────────────────────────────────────────────────
  aircraft: Aircraft[];
  setAircraft: (aircraft: Aircraft[]) => void;
  aircraftMap: Map<string, Aircraft>;

  // ── Selection ─────────────────────────────────────────────────────────────
  selectedIcao: string | null;
  setSelectedIcao: (icao: string | null) => void;
  selectedAircraft: Aircraft | null;

  // ── Conflicts ─────────────────────────────────────────────────────────────
  conflicts: Conflict[];
  predictedConflicts: PredictedConflict[];
  setConflicts: (c: Conflict[]) => void;
  setPredictedConflicts: (c: PredictedConflict[]) => void;
  conflictIcaos: Set<string>;

  // ── Weather ───────────────────────────────────────────────────────────────
  weatherCells: WeatherCell[];
  setWeatherCells: (cells: WeatherCell[]) => void;
  weatherAdvisories: WeatherAdvisory[];
  setWeatherAdvisories: (a: WeatherAdvisory[]) => void;
  activeWeatherMode: WeatherMode;
  setWeatherMode: (mode: WeatherMode) => void;

  // ── Theme ─────────────────────────────────────────────────────────────────
  theme: Theme;
  setTheme: (theme: Theme) => void;
  manualTheme: boolean;
  setManualTheme: (v: boolean) => void;

  // ── UI ────────────────────────────────────────────────────────────────────
  drawerOpen: boolean;
  setDrawerOpen: (v: boolean) => void;
  isLoading: boolean;
  setLoading: (v: boolean) => void;
  lastUpdated: Date | null;
  setLastUpdated: (d: Date) => void;
  connectionStatus: ConnectionStatus;
  setConnectionStatus: (s: ConnectionStatus) => void;
  showConflictPanel: boolean;
  setShowConflictPanel: (v: boolean) => void;
}

export const useStore = create<AppState>((set, get) => ({
  // ── Aircraft ──────────────────────────────────────────────────────────────
  aircraft: [],
  aircraftMap: new Map(),
  setAircraft: (aircraft) => {
    const aircraftMap = new Map(aircraft.map((a) => [a.icao, a]));
    const selectedIcao = get().selectedIcao;
    const selectedAircraft = selectedIcao ? (aircraftMap.get(selectedIcao) ?? null) : null;
    set({ aircraft, aircraftMap, selectedAircraft, lastUpdated: new Date() });
  },

  // ── Selection ─────────────────────────────────────────────────────────────
  selectedIcao: null,
  selectedAircraft: null,
  setSelectedIcao: (icao) => {
    const aircraft = icao ? (get().aircraftMap.get(icao) ?? null) : null;
    set({ selectedIcao: icao, selectedAircraft: aircraft, drawerOpen: !!icao });
  },

  // ── Conflicts ─────────────────────────────────────────────────────────────
  conflicts: [],
  predictedConflicts: [],
  conflictIcaos: new Set(),
  setConflicts: (conflicts) => {
    const conflictIcaos = new Set<string>();
    conflicts.forEach((c) => { conflictIcaos.add(c.aircraft_1); conflictIcaos.add(c.aircraft_2); });
    set({ conflicts, conflictIcaos });
  },
  setPredictedConflicts: (predictedConflicts) => set({ predictedConflicts }),

  // ── Weather ───────────────────────────────────────────────────────────────
  weatherCells: [],
  setWeatherCells: (weatherCells) => set({ weatherCells }),
  weatherAdvisories: [],
  setWeatherAdvisories: (weatherAdvisories) => set({ weatherAdvisories }),
  activeWeatherMode: "none",
  setWeatherMode: (activeWeatherMode) => set({ activeWeatherMode }),

  // ── Theme ─────────────────────────────────────────────────────────────────
  theme: "night",
  setTheme: (theme) => set({ theme }),
  manualTheme: false,
  setManualTheme: (manualTheme) => set({ manualTheme }),

  // ── UI ────────────────────────────────────────────────────────────────────
  drawerOpen: false,
  setDrawerOpen: (drawerOpen) => set({ drawerOpen }),
  isLoading: true,
  setLoading: (isLoading) => set({ isLoading }),
  lastUpdated: null,
  setLastUpdated: (lastUpdated) => set({ lastUpdated }),
  connectionStatus: "connecting",
  setConnectionStatus: (connectionStatus) => set({ connectionStatus }),
  showConflictPanel: true,
  setShowConflictPanel: (showConflictPanel) => set({ showConflictPanel }),
}));
