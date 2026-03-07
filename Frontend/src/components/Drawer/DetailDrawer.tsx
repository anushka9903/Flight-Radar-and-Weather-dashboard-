import { useStore } from "../../store";
import {
  flightLevel,
  compassPoint,
  formatCoord,
} from "../../utils/mapHelpers";

export function DetailDrawer() {
  const selectedAircraft  = useStore((s) => s.selectedAircraft);
  const drawerOpen        = useStore((s) => s.drawerOpen);
  const setSelectedIcao   = useStore((s) => s.setSelectedIcao);
  const conflicts         = useStore((s) => s.conflicts);
  const conflictIcaos     = useStore((s) => s.conflictIcaos);
  const predicted         = useStore((s) => s.predictedConflicts);
  const advisories        = useStore((s) => s.weatherAdvisories);
  const weatherCells      = useStore((s) => s.weatherCells);

  if (!selectedAircraft) return <div className={`detail-drawer ${drawerOpen ? "detail-drawer--open" : ""}`} />;

  const ac = selectedAircraft;
  const isConflict = conflictIcaos.has(ac.icao);

  const myConflicts = conflicts.filter(
    (c) => c.aircraft_1 === ac.icao || c.aircraft_2 === ac.icao
  );
  const myPredicted = predicted.filter(
    (c) => c.aircraft_1 === ac.icao || c.aircraft_2 === ac.icao
  );
  const advisory = advisories.find((a) => a.aircraft === ac.icao);

  // Nearest weather cell
  const nearestWeather = weatherCells.length > 0
    ? weatherCells.reduce((best, cell) => {
        const d = Math.hypot(cell.data.latitude - ac.latitude, cell.data.longitude - ac.longitude);
        const bd = Math.hypot(best.data.latitude - ac.latitude, best.data.longitude - ac.longitude);
        return d < bd ? cell : best;
      })
    : null;

  // Risk scores
  const conflictRisk = isConflict ? 100 : myPredicted.length > 0 ? 55 : 0;
  const weatherRisk  = advisory ? (advisory.severity === "HIGH" ? 95 : advisory.severity === "MEDIUM" ? 60 : 25) : 0;
  const icingRisk    = ac.altitude > 18000 && nearestWeather && nearestWeather.data.temperature < 2
    ? Math.min(90, 40 + (2 - nearestWeather.data.temperature) * 5)
    : nearestWeather && nearestWeather.data.temperature < 0 ? 20 : 5;

  const overallRisk = Math.max(conflictRisk, weatherRisk, icingRisk);

  return (
    <div className={`detail-drawer ${drawerOpen ? "detail-drawer--open" : ""} ${isConflict ? "detail-drawer--conflict" : ""}`}>

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="drawer-header">
        <div className="drawer-ac-identity">
          <div className={`drawer-plane-glyph ${isConflict ? "drawer-plane-glyph--conflict" : ""}`}>
            <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" width="36" height="36"
              style={{ transform: `rotate(${ac.heading}deg)`, transition: "transform 0.4s ease" }}>
              <path d="M20 2 L25 20 L20 17 L15 20 Z" fill="currentColor" />
              <path d="M10 22 L20 18 L30 22 L28 25 L20 22 L12 25 Z" fill="currentColor" opacity="0.6" />
              <path d="M15 30 L20 27 L25 30 L24 33 L20 31 L16 33 Z" fill="currentColor" opacity="0.4" />
            </svg>
          </div>
          <div className="drawer-ac-info">
            <div className="drawer-callsign">{ac.callsign ?? ac.icao}</div>
            <div className="drawer-icao-hex">{ac.icao}</div>
            <div className="drawer-status-pill">
              {ac.on_ground ? (
                <span className="pill pill--ground">⬤ ON GROUND</span>
              ) : (
                <span className="pill pill--airborne">⬤ AIRBORNE</span>
              )}
              {isConflict && <span className="pill pill--conflict">⚠ CONFLICT</span>}
              {advisory && <span className={`pill pill--wx-${advisory.severity.toLowerCase()}`}>
                {advisory.severity === "HIGH" ? "🔴" : advisory.severity === "MEDIUM" ? "🟠" : "🟡"} WX ADVISORY
              </span>}
            </div>
          </div>
        </div>

        {/* Risk gauge */}
        <div className="drawer-risk-gauge">
          <svg viewBox="0 0 60 60" fill="none" xmlns="http://www.w3.org/2000/svg" width="60" height="60">
            <circle cx="30" cy="30" r="26" stroke="rgba(255,255,255,0.08)" strokeWidth="5" />
            <circle
              cx="30" cy="30" r="26"
              stroke={overallRisk > 70 ? "#ff3333" : overallRisk > 40 ? "#ff8800" : "#00ff88"}
              strokeWidth="5"
              strokeDasharray={`${(overallRisk / 100) * 163.4} 163.4`}
              strokeLinecap="round"
              transform="rotate(-90 30 30)"
              style={{ transition: "stroke-dasharray 0.6s ease, stroke 0.4s" }}
            />
            <text x="30" y="33" textAnchor="middle" fontSize="13" fontFamily="Share Tech Mono" fill="white" fontWeight="700">
              {overallRisk}
            </text>
          </svg>
          <span className="risk-gauge-label">RISK</span>
        </div>

        <button className="drawer-close-btn" onClick={() => setSelectedIcao(null)} aria-label="Close">✕</button>
      </div>

      {/* ── Conflict alert ─────────────────────────────────────────────────── */}
      {isConflict && (
        <div className="drawer-alert drawer-alert--conflict">
          <div className="alert-icon">⚠</div>
          <div className="alert-content">
            <div className="alert-title">SEPARATION VIOLATION DETECTED</div>
            {myConflicts.map((c, i) => {
              const other = c.aircraft_1 === ac.icao ? c.aircraft_2 : c.aircraft_1;
              return (
                <div key={i} className="alert-detail">
                  vs <strong>{other}</strong> — {c.horizontal_km.toFixed(1)} km lateral · {Math.round(c.vertical_ft)} ft vertical
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Weather advisory ───────────────────────────────────────────────── */}
      {advisory && (
        <div className={`drawer-alert drawer-alert--wx-${advisory.severity.toLowerCase()}`}>
          <div className="alert-icon">{advisory.severity === "HIGH" ? "🔴" : advisory.severity === "MEDIUM" ? "🟠" : "🟡"}</div>
          <div className="alert-content">
            <div className="alert-title">{advisory.severity} WEATHER ADVISORY</div>
            <div className="alert-detail">{advisory.warnings.join(" · ")}</div>
          </div>
        </div>
      )}

      <div className="drawer-body">

        {/* ── Flight Telemetry ─────────────────────────────────────────────── */}
        <DrawerSection title="FLIGHT TELEMETRY">
          <div className="data-grid">
            <DataCell label="ALTITUDE"     value={flightLevel(ac.altitude)}   sub={`${Math.round(ac.altitude).toLocaleString()} ft MSL`} highlight />
            <DataCell label="GND SPEED"    value={`${Math.round(ac.velocity)}`} unit="kts" />
            <DataCell label="HEADING"      value={`${Math.round(ac.heading)}°`} sub={compassPoint(ac.heading)} />
            <DataCell label="FLIGHT PHASE" value={ac.on_ground ? "GROUND" : ac.altitude < 5000 ? "T/O · LDG" : ac.altitude < 20000 ? "CLIMBING" : "CRUISE"} />
          </div>
        </DrawerSection>

        {/* ── Position ─────────────────────────────────────────────────────── */}
        <DrawerSection title="POSITION">
          <div className="data-grid data-grid--2">
            <DataCell label="LATITUDE"  value={formatCoord(ac.latitude, "lat")} />
            <DataCell label="LONGITUDE" value={formatCoord(ac.longitude, "lon")} />
          </div>
        </DrawerSection>

        {/* ── Weather at location ───────────────────────────────────────────── */}
        {nearestWeather && (
          <DrawerSection title="WEATHER AT LOCATION">
            <div className="wx-condition-pill">
              <span className="wx-cond-icon">
                {nearestWeather.data.condition.includes("rain") ? "🌧" :
                 nearestWeather.data.condition.includes("cloud") ? "☁" :
                 nearestWeather.data.condition.includes("storm") ? "⛈" : "☀"}
              </span>
              <span className="wx-cond-text">{nearestWeather.data.condition.toUpperCase()}</span>
            </div>
            <div className="data-grid">
              <DataCell label="TEMPERATURE"  value={`${nearestWeather.data.temperature.toFixed(1)}°C`} />
              <DataCell label="WIND"         value={`${nearestWeather.data.wind_speed.toFixed(1)} m/s`} sub={`${Math.round(nearestWeather.data.wind_direction)}° ${compassPoint(nearestWeather.data.wind_direction)}`} />
              <DataCell label="VISIBILITY"   value={`${(nearestWeather.data.visibility / 1000).toFixed(1)} km`} />
              <DataCell label="CLOUD COVER"  value={`${Math.round(nearestWeather.data.cloud_cover)}%`} />
              <DataCell label="HUMIDITY"     value={`${Math.round(nearestWeather.data.humidity)}%`} />
              <DataCell label="PRESSURE"     value={`${Math.round(nearestWeather.data.pressure)} hPa`} />
            </div>
          </DrawerSection>
        )}

        {/* ── Risk Assessment ───────────────────────────────────────────────── */}
        <DrawerSection title="RISK ASSESSMENT">
          <RiskBar
            label="CONFLICT RISK"
            value={conflictRisk}
            color={conflictRisk > 60 ? "#ff3333" : conflictRisk > 30 ? "#ff8800" : "#00ff88"}
            status={conflictRisk > 60 ? "HIGH" : conflictRisk > 0 ? "MODERATE" : "CLEAR"}
          />
          <RiskBar
            label="WEATHER RISK"
            value={weatherRisk}
            color={weatherRisk > 70 ? "#ff3333" : weatherRisk > 40 ? "#ff8800" : "#00ff88"}
            status={weatherRisk > 70 ? "SEVERE" : weatherRisk > 40 ? "MODERATE" : "CLEAR"}
          />
          <RiskBar
            label="ICING RISK"
            value={icingRisk}
            color={icingRisk > 60 ? "#42a5f5" : icingRisk > 30 ? "#90caf9" : "#00ff88"}
            status={icingRisk > 60 ? "HIGH" : icingRisk > 20 ? "MODERATE" : "LOW"}
          />
          <RiskBar
            label="STORM PROBABILITY"
            value={nearestWeather?.data.condition.includes("storm") ? 90 : nearestWeather?.data.condition.includes("rain") ? 35 : 5}
            color={nearestWeather?.data.condition.includes("storm") ? "#ff3333" : "#00ff88"}
            status={nearestWeather?.data.condition.includes("storm") ? "HIGH" : "LOW"}
          />
        </DrawerSection>

        {/* ── Predicted conflicts ───────────────────────────────────────────── */}
        {myPredicted.length > 0 && (
          <DrawerSection title="PREDICTED CONFLICTS">
            {myPredicted.map((c, i) => {
              const other = c.aircraft_1 === ac.icao ? c.aircraft_2 : c.aircraft_1;
              const mins = Math.round(c.predicted_in_seconds / 60);
              return (
                <div key={i} className="predicted-row">
                  <span className="predicted-icon">⏱</span>
                  <span className="predicted-text">
                    vs <strong>{other}</strong> in {mins} min
                  </span>
                  <span className="predicted-urgency">
                    {mins < 5 ? "URGENT" : mins < 10 ? "WARNING" : "CAUTION"}
                  </span>
                </div>
              );
            })}
          </DrawerSection>
        )}
      </div>

      <div className="drawer-footer">
        <span>AEROINTEL · {ac.icao}</span>
        <span>{new Date().toISOString().slice(0, 19).replace("T", " ")} UTC</span>
      </div>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function DrawerSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="drawer-section">
      <div className="drawer-section-title">{title}</div>
      {children}
    </div>
  );
}

function DataCell({
  label, value, unit, sub, highlight,
}: {
  label: string;
  value: string;
  unit?: string;
  sub?: string;
  highlight?: boolean;
}) {
  return (
    <div className={`data-cell ${highlight ? "data-cell--highlight" : ""}`}>
      <div className="data-cell-label">{label}</div>
      <div className="data-cell-value">
        {value}
        {unit && <span className="data-cell-unit"> {unit}</span>}
      </div>
      {sub && <div className="data-cell-sub">{sub}</div>}
    </div>
  );
}

function RiskBar({
  label, value, color, status,
}: {
  label: string;
  value: number;
  color: string;
  status: string;
}) {
  return (
    <div className="risk-bar">
      <div className="risk-bar-header">
        <span className="risk-bar-label">{label}</span>
        <span className="risk-bar-status" style={{ color }}>{status}</span>
      </div>
      <div className="risk-bar-track">
        <div
          className="risk-bar-fill"
          style={{
            width: `${value}%`,
            background: `linear-gradient(90deg, ${color}88, ${color})`,
            boxShadow: `0 0 8px ${color}66`,
          }}
        />
      </div>
    </div>
  );
}
