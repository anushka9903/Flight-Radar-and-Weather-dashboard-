"""
Pure-logic conflict detection engine.
No I/O, no Redis, no HTTP — only data-in / data-out.
"""
from __future__ import annotations

from collections import defaultdict
from typing import Any

from app.engines.movement import haversine_distance, predict_position
from app.schemas.aircraft import AircraftState
from app.schemas.conflict import Conflict, PredictedConflict

# Grid cell size in degrees (≈10 km at mid-latitude)
_H_CELL_DEG: float = 10.0 / 111.0
_V_CELL_FT: float = 1000.0


def _grid_key(
    lat: float,
    lon: float,
    alt_ft: float,
) -> tuple[int, int, int]:
    return (
        int(lat / _H_CELL_DEG),
        int(lon / _H_CELL_DEG),
        int(alt_ft / _V_CELL_FT),
    )


def detect_conflicts(
    aircraft_list: list[AircraftState],
    h_sep_km: float = 10.0,
    v_sep_ft: float = 1000.0,
) -> list[Conflict]:
    """
    Return all pairs currently violating horizontal AND vertical separation.
    Grid-indexed O(n) bucketing with O(k²) comparison within cells.
    """
    grid: dict[tuple[int, int, int], list[AircraftState]] = defaultdict(list)
    for ac in aircraft_list:
        grid[_grid_key(ac.latitude, ac.longitude, ac.altitude)].append(ac)

    conflicts: list[Conflict] = []
    seen: set[tuple[str, str]] = set()

    for (cx, cy, cz), cell_ac in grid.items():
        neighbours: list[AircraftState] = []
        for dx in (-1, 0, 1):
            for dy in (-1, 0, 1):
                for dz in (-1, 0, 1):
                    neighbours.extend(grid.get((cx + dx, cy + dy, cz + dz), []))

        for a1 in cell_ac:
            for a2 in neighbours:
                if a1.icao == a2.icao:
                    continue
                pair = (min(a1.icao, a2.icao), max(a1.icao, a2.icao))
                if pair in seen:
                    continue
                seen.add(pair)

                h_dist = haversine_distance(
                    a1.latitude, a1.longitude, a2.latitude, a2.longitude
                )
                v_dist = abs(a1.altitude - a2.altitude)

                if h_dist < h_sep_km and v_dist < v_sep_ft:
                    conflicts.append(
                        Conflict(
                            aircraft_1=a1.icao,
                            aircraft_2=a2.icao,
                            horizontal_km=round(h_dist, 3),
                            vertical_ft=round(v_dist, 1),
                        )
                    )

    return conflicts


def predict_conflicts(
    aircraft_list: list[AircraftState],
    seconds_ahead: int = 600,
    h_sep_km: float = 10.0,
    v_sep_ft: float = 1000.0,
) -> list[PredictedConflict]:
    """
    Project all aircraft forward by seconds_ahead and detect future conflicts.
    """
    # Build predicted states
    predicted: list[AircraftState] = []
    for ac in aircraft_list:
        pred_lat, pred_lon = predict_position(
            ac.latitude, ac.longitude, ac.heading, ac.velocity, seconds_ahead
        )
        predicted.append(
            AircraftState(
                icao=ac.icao,
                callsign=ac.callsign,
                latitude=pred_lat,
                longitude=pred_lon,
                altitude=ac.altitude,
                velocity=ac.velocity,
                heading=ac.heading,
                on_ground=ac.on_ground,
            )
        )

    base_conflicts = detect_conflicts(predicted, h_sep_km, v_sep_ft)
    return [
        PredictedConflict(
            **c.model_dump(),
            predicted_in_seconds=seconds_ahead,
        )
        for c in base_conflicts
    ]
