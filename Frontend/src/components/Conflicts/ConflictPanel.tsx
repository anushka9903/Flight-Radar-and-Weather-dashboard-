import { useStore } from "../../store";

export function ConflictPanel() {
  const conflicts  = useStore((s) => s.conflicts);
  const predicted  = useStore((s) => s.predictedConflicts);
  const setIcao    = useStore((s) => s.setSelectedIcao);

  const hasConflicts = conflicts.length > 0 || predicted.length > 0;
  if (!hasConflicts) return null;

  return (
    <div className="conflict-panel">
      {/* Active conflicts */}
      {conflicts.length > 0 && (
        <>
          <div className="conflict-section-header conflict-section-header--active">
            <span className="conflict-pulse" />
            <span>ACTIVE SEPARATION VIOLATIONS</span>
            <span className="conflict-badge">{conflicts.length}</span>
          </div>
          {conflicts.map((c, i) => (
            <div
              key={i}
              className="conflict-row conflict-row--active"
              onClick={() => setIcao(c.aircraft_1)}
            >
              <div className="conflict-pair">
                <span className="conflict-icao">{c.aircraft_1}</span>
                <span className="conflict-vs">⚡</span>
                <span className="conflict-icao">{c.aircraft_2}</span>
              </div>
              <div className="conflict-metrics">
                <span className="conflict-metric">
                  <span className="conflict-metric-icon">↔</span>
                  {c.horizontal_km.toFixed(1)} km
                </span>
                <span className="conflict-metric">
                  <span className="conflict-metric-icon">↕</span>
                  {Math.round(c.vertical_ft)} ft
                </span>
              </div>
            </div>
          ))}
        </>
      )}

      {/* Predicted conflicts */}
      {predicted.length > 0 && (
        <>
          <div className="conflict-section-header conflict-section-header--predicted">
            <span>⏱ PREDICTED CONFLICTS</span>
            <span className="conflict-badge conflict-badge--amber">{predicted.length}</span>
          </div>
          {predicted.slice(0, 3).map((c, i) => (
            <div
              key={i}
              className="conflict-row conflict-row--predicted"
              onClick={() => setIcao(c.aircraft_1)}
            >
              <div className="conflict-pair">
                <span className="conflict-icao">{c.aircraft_1}</span>
                <span className="conflict-vs conflict-vs--amber">⟶</span>
                <span className="conflict-icao">{c.aircraft_2}</span>
              </div>
              <div className="conflict-metrics">
                <span className="conflict-metric">
                  in {Math.round(c.predicted_in_seconds / 60)} min
                </span>
              </div>
            </div>
          ))}
        </>
      )}
    </div>
  );
}
