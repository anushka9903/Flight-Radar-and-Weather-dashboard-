import { useState, type CSSProperties } from "react";
import { useStore } from "../../store";
import { WeatherMode } from "../../types";

type Section = "weather" | "conflicts" | "aircraft" | null;

export function SidePanel() {
  const [open, setOpen] = useState<Section>("weather");
  const toggle = (s: Section) => setOpen(prev => prev === s ? null : s);

  return (
    <div className="side-panel">
      <WeatherSection open={open === "weather"} onToggle={() => toggle("weather")} />
      <ConflictsSection open={open === "conflicts"} onToggle={() => toggle("conflicts")} />
      <AircraftSection open={open === "aircraft"} onToggle={() => toggle("aircraft")} />
    </div>
  );
}

// ── Weather Section ───────────────────────────────────────────────────────────
const WX_BTNS: { mode: WeatherMode; icon: string; label: string; accent: string }[] = [
  { mode: "temperature",   icon: "🌡", label: "TEMP",   accent: "#f4793a" },
  { mode: "wind",          icon: "💨", label: "WIND",   accent: "#42a5f5" },
  { mode: "precipitation", icon: "🌧", label: "RAIN",   accent: "#7c4dff" },
  { mode: "clouds",        icon: "☁",  label: "CLOUD",  accent: "#90caf9" },
  { mode: "humidity",      icon: "💧", label: "HUMID",  accent: "#4caf50" },
];

const WX_LEGENDS: Record<string, { stops: [string, string][] }> = {
  temperature:   { stops: [["#4fc3f7","< 10°C"],["#fff176","20°C"],["#ff8f00","30°C"],["#b71c1c","> 40°C"]] },
  wind:          { stops: [["#e3f2fd","Calm"],["#42a5f5","10 m/s"],["#1565c0","25 m/s"],["#0d1a50","Storm"]] },
  precipitation: { stops: [["rgba(0,230,255,0.7)","Light"],["#7c4dff","Moderate"],["#b71c1c","Heavy"]] },
  clouds:        { stops: [["rgba(180,200,240,0.4)","Thin"],["#6490c8","Moderate"],["#2a3a6a","Overcast"]] },
  humidity:      { stops: [["#ffe082","Dry"],["#66bb6a","50%"],["#1b5e20","Humid"]] },
};

function WeatherSection({ open, onToggle }: { open: boolean; onToggle: () => void }) {
  const mode    = useStore((s) => s.activeWeatherMode);
  const setMode = useStore((s) => s.setWeatherMode);
  const toggle  = (m: WeatherMode) => setMode(mode === m ? "none" : m);

  return (
    <div className="sp-section">
      <button className={`sp-header ${open ? "sp-header--open" : ""}`} onClick={onToggle}>
        <span className="sp-header-icon">🌍</span>
        <span className="sp-header-label">WEATHER</span>
        {mode !== "none" && <span className="sp-active-pip" />}
        <span className="sp-chevron">{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <div className="sp-body">
          <div className="sp-wx-grid">
            {WX_BTNS.map(btn => {
              const active = mode === btn.mode;
              return (
                <button
                  key={btn.mode}
                  className={`sp-wx-btn ${active ? "sp-wx-btn--active" : ""}`}
                  style={{ "--wx-accent": btn.accent } as CSSProperties}
                  onClick={() => toggle(btn.mode)}
                >
                  <span className="sp-wx-icon">{btn.icon}</span>
                  <span className="sp-wx-label">{btn.label}</span>
                  {active && <span className="sp-wx-pip" />}
                </button>
              );
            })}
          </div>

          {mode !== "none" && WX_LEGENDS[mode] && (
            <div className="sp-legend">
              {WX_LEGENDS[mode].stops.map(([color, label], i) => (
                <div key={i} className="sp-legend-item">
                  <div className="sp-legend-swatch" style={{ background: color }} />
                  <span className="sp-legend-label">{label}</span>
                </div>
              ))}
            </div>
          )}

          <div className="sp-wx-hint">
            <span>📍</span> Click map for weather data
          </div>
        </div>
      )}
    </div>
  );
}

// ── Conflicts Section ─────────────────────────────────────────────────────────
function ConflictsSection({ open, onToggle }: { open: boolean; onToggle: () => void }) {
  const conflicts  = useStore((s) => s.conflicts);
  const predicted  = useStore((s) => s.predictedConflicts);
  const setIcao    = useStore((s) => s.setSelectedIcao);
  const total      = conflicts.length + predicted.length;

  return (
    <div className="sp-section">
      <button className={`sp-header ${open ? "sp-header--open" : ""}`} onClick={onToggle}>
        <span className="sp-header-icon">⚡</span>
        <span className="sp-header-label">CONFLICTS</span>
        {total > 0 && <span className="sp-count-badge sp-count-badge--red">{total}</span>}
        <span className="sp-chevron">{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <div className="sp-body sp-body--scroll">
          {conflicts.length === 0 && predicted.length === 0 && (
            <div className="sp-empty">No active conflicts</div>
          )}

          {conflicts.length > 0 && (
            <>
              <div className="sp-subsection-title">
                <span className="sp-pulse" /> ACTIVE VIOLATIONS
              </div>
              {conflicts.map((c, i) => (
                <div key={i} className="sp-conflict-row" onClick={() => setIcao(c.aircraft_1)}>
                  <div className="sp-conflict-pair">
                    <span className="sp-icao">{c.aircraft_1}</span>
                    <span className="sp-vs">⚡</span>
                    <span className="sp-icao">{c.aircraft_2}</span>
                  </div>
                  <div className="sp-conflict-metrics">
                    <span>↔ {c.horizontal_km.toFixed(1)} km</span>
                    <span>↕ {Math.round(c.vertical_ft)} ft</span>
                  </div>
                </div>
              ))}
            </>
          )}

          {predicted.length > 0 && (
            <>
              <div className="sp-subsection-title sp-subsection-title--amber">
                ⏱ PREDICTED
              </div>
              {predicted.slice(0, 5).map((c, i) => (
                <div key={i} className="sp-conflict-row sp-conflict-row--predicted" onClick={() => setIcao(c.aircraft_1)}>
                  <div className="sp-conflict-pair">
                    <span className="sp-icao">{c.aircraft_1}</span>
                    <span className="sp-vs sp-vs--amber">⟶</span>
                    <span className="sp-icao">{c.aircraft_2}</span>
                  </div>
                  <span className="sp-in-time">in {Math.round(c.predicted_in_seconds / 60)} min</span>
                </div>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ── Aircraft Section ──────────────────────────────────────────────────────────
function AircraftSection({ open, onToggle }: { open: boolean; onToggle: () => void }) {
  const aircraft    = useStore((s) => s.aircraft);
  const setIcao     = useStore((s) => s.setSelectedIcao);
  const conflictSet = useStore((s) => s.conflictIcaos);
  const [search, setSearch] = useState("");

  const filtered = aircraft.filter(ac => {
    const q = search.toLowerCase();
    return !q || (ac.callsign ?? ac.icao).toLowerCase().includes(q) || ac.icao.toLowerCase().includes(q);
  });

  const airborne = aircraft.filter(a => !a.on_ground).length;
  const ground   = aircraft.filter(a => a.on_ground).length;

  return (
    <div className="sp-section">
      <button className={`sp-header ${open ? "sp-header--open" : ""}`} onClick={onToggle}>
        <span className="sp-header-icon">✈</span>
        <span className="sp-header-label">AIRCRAFT</span>
        <span className="sp-count-badge sp-count-badge--blue">{aircraft.length}</span>
        <span className="sp-chevron">{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <div className="sp-body">
          <div className="sp-ac-stats">
            <span>✈ {airborne} airborne</span>
            <span>⬛ {ground} ground</span>
          </div>

          <div className="sp-search-wrap">
            <span className="sp-search-icon">🔍</span>
            <input
              className="sp-search"
              placeholder="Search callsign / ICAO…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              onClick={e => e.stopPropagation()}
            />
            {search && (
              <button className="sp-search-clear" onClick={() => setSearch("")}>✕</button>
            )}
          </div>

          <div className="sp-ac-list">
            {filtered.slice(0, 40).map(ac => {
              const isConflict = conflictSet.has(ac.icao);
              const fl = ac.altitude > 100
                ? `FL${Math.round(ac.altitude / 100).toString().padStart(3, "0")}`
                : "GND";
              return (
                <div
                  key={ac.icao}
                  className={`sp-ac-row ${isConflict ? "sp-ac-row--conflict" : ""}`}
                  onClick={() => setIcao(ac.icao)}
                >
                  <div className="sp-ac-id">
                    <span className="sp-ac-cs">{ac.callsign ?? ac.icao}</span>
                    <span className="sp-ac-hex">{ac.icao}</span>
                  </div>
                  <div className="sp-ac-data">
                    <span>{fl}</span>
                    <span>{Math.round(ac.velocity)} kts</span>
                    {isConflict && <span className="sp-ac-alert">⚡</span>}
                  </div>
                </div>
              );
            })}
            {filtered.length > 40 && (
              <div className="sp-more">+{filtered.length - 40} more — refine search</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
