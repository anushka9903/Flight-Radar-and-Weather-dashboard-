import { useStore } from "../../store";
import { WeatherMode } from "../../types";

interface WeatherBtn {
  mode: WeatherMode;
  icon: string;
  label: string;
  accent: string;
  description: string;
}

const BUTTONS: WeatherBtn[] = [
  { mode: "temperature",   icon: "🌡", label: "TEMP",   accent: "#f4793a", description: "Surface temperature" },
  { mode: "wind",          icon: "💨", label: "WIND",   accent: "#42a5f5", description: "Wind speed & direction" },
  { mode: "precipitation", icon: "🌧", label: "RAIN",   accent: "#7c4dff", description: "Precipitation radar" },
  { mode: "clouds",        icon: "☁",  label: "CLOUD",  accent: "#90caf9", description: "Cloud density" },
  { mode: "humidity",      icon: "💧", label: "HUMID",  accent: "#4caf50", description: "Relative humidity" },
];

export function WeatherPanel() {
  const mode    = useStore((s) => s.activeWeatherMode);
  const setMode = useStore((s) => s.setWeatherMode);

  const toggle = (m: WeatherMode) => setMode(mode === m ? "none" : m);

  return (
    <div className="weather-panel">
      <div className="weather-panel-header">
        <span className="weather-panel-title">WEATHER</span>
        {mode !== "none" && <span className="weather-panel-active-dot" />}
      </div>

      <div className="weather-buttons">
        {BUTTONS.map((btn) => {
          const active = mode === btn.mode;
          return (
            <button
              key={btn.mode}
              className={`wx-btn ${active ? "wx-btn--active" : ""}`}
              style={{ "--wx-accent": btn.accent } as React.CSSProperties}
              onClick={() => toggle(btn.mode)}
              title={btn.description}
            >
              <span className="wx-btn-icon">{btn.icon}</span>
              <span className="wx-btn-label">{btn.label}</span>
              {active && <span className="wx-btn-pip" />}
            </button>
          );
        })}
      </div>

      {mode !== "none" && (
        <div className="wx-hint">Click map for data</div>
      )}
    </div>
  );
}
