import { useState } from "react";
import { useStore } from "../../store";
import type { ConnectionStatus } from "../../types";

export function TopBar() {
  const aircraft         = useStore((s) => s.aircraft);
  const conflicts        = useStore((s) => s.conflicts);
  const connectionStatus = useStore((s) => s.connectionStatus);
  const lastUpdated      = useStore((s) => s.lastUpdated);
  const theme            = useStore((s) => s.theme);
  const setTheme         = useStore((s) => s.setTheme);
  const setManualTheme   = useStore((s) => s.setManualTheme);
  const setSelectedIcao  = useStore((s) => s.setSelectedIcao);
  const [search, setSearch] = useState("");
  const [showResults, setShowResults] = useState(false);

  const airborne = aircraft.filter((a) => !a.on_ground).length;
  const onGround = aircraft.filter((a) => a.on_ground).length;

  const searchResults = search.length >= 2
    ? aircraft.filter(ac =>
        (ac.callsign ?? "").toLowerCase().includes(search.toLowerCase()) ||
        ac.icao.toLowerCase().includes(search.toLowerCase())
      ).slice(0, 8)
    : [];

  const handleTheme = () => { setManualTheme(true); setTheme(theme === "day" ? "night" : "day"); };

  const statusColor = ({
    connected: "#00e87a",
    disconnected: "#ff3333",
    connecting: "#ff9500",
    reconnecting: "#ff9500",
  } satisfies Record<ConnectionStatus, string>)[connectionStatus];
  const statusLabel = ({
    connected: "LIVE",
    disconnected: "OFFLINE",
    connecting: "SYNC…",
    reconnecting: "RETRY…",
  } satisfies Record<ConnectionStatus, string>)[connectionStatus];

  return (
    <header className="topbar">
      {/* Brand */}
      <div className="topbar-brand">
        <div className="topbar-logo">
          <svg viewBox="0 0 32 32" fill="none" width="28" height="28">
            <circle cx="16" cy="16" r="15" stroke="var(--accent)" strokeWidth="1.5"/>
            <path d="M16 4 L20 16 L16 14 L12 16 Z" fill="var(--accent)"/>
            <circle cx="16" cy="16" r="2.5" fill="var(--accent)"/>
            <path d="M8 22 L16 18 L24 22" stroke="var(--accent)" strokeWidth="1" strokeOpacity="0.5"/>
          </svg>
        </div>
        <div className="topbar-title-group">
          <span className="topbar-title">AEROINTEL</span>
          <span className="topbar-subtitle">AIRSPACE INTELLIGENCE PLATFORM</span>
        </div>
      </div>

      {/* Search */}
      <div className="topbar-search-wrap">
        <span className="topbar-search-icon">🔍</span>
        <input
          className="topbar-search"
          placeholder="Search aircraft callsign or ICAO…"
          value={search}
          onChange={e => { setSearch(e.target.value); setShowResults(true); }}
          onFocus={() => setShowResults(true)}
          onBlur={() => setTimeout(() => setShowResults(false), 200)}
        />
        {search && <button className="topbar-search-clear" onClick={() => setSearch("")}>✕</button>}
        {showResults && searchResults.length > 0 && (
          <div className="topbar-search-results">
            {searchResults.map(ac => (
              <div key={ac.icao} className="topbar-search-row" onMouseDown={() => {
                setSelectedIcao(ac.icao); setSearch(""); setShowResults(false);
              }}>
                <span className="tsr-cs">{ac.callsign ?? ac.icao}</span>
                <span className="tsr-meta">
                  {ac.icao} · {ac.altitude > 100 ? `FL${Math.round(ac.altitude/100).toString().padStart(3,"0")}` : "GND"} · {Math.round(ac.velocity)} kts
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="topbar-stats">
        <Stat label="AIRBORNE"  value={airborne} />
        <div className="stat-sep" />
        <Stat label="ON GROUND" value={onGround} />
        <div className="stat-sep" />
        <Stat label="CONFLICTS" value={conflicts.length} alert={conflicts.length > 0} />
        <div className="stat-sep" />
        <div className="stat-item">
          <span className="stat-label">STATUS</span>
          <span className="stat-val" style={{ color: statusColor }}>
            <span className="status-dot" style={{ background: statusColor, boxShadow: `0 0 6px ${statusColor}` }} />
            {statusLabel}
          </span>
        </div>
      </div>

      {/* Right */}
      <div className="topbar-right">
        {lastUpdated && (
          <span className="topbar-upd">
            UPD {lastUpdated.toLocaleTimeString("en-GB", { hour:"2-digit", minute:"2-digit", second:"2-digit" })} UTC
          </span>
        )}
        <button className="theme-btn" onClick={handleTheme}>
          {theme === "day" ? "☽ NIGHT" : "☀ DAY"}
        </button>
      </div>
    </header>
  );
}

function Stat({ label, value, alert }: { label: string; value: number; alert?: boolean }) {
  return (
    <div className="stat-item">
      <span className="stat-label">{label}</span>
      <span className={`stat-val ${alert ? "stat-alert" : ""}`}>{value}</span>
    </div>
  );
}
