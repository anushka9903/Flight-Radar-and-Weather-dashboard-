"""Unit tests for the conflict detection engine."""
import pytest

from app.engines.conflict import detect_conflicts, predict_conflicts
from app.schemas.aircraft import AircraftState


def _make_ac(icao: str, lat: float, lon: float, alt: float, hdg: float = 90.0) -> AircraftState:
    return AircraftState(
        icao=icao, callsign=None,
        latitude=lat, longitude=lon,
        altitude=alt, velocity=800.0, heading=hdg,
    )


class TestDetectConflicts:
    def test_no_aircraft_returns_empty(self):
        assert detect_conflicts([]) == []

    def test_single_aircraft_no_conflict(self):
        ac = [_make_ac("A", 20.0, 77.0, 35000)]
        assert detect_conflicts(ac) == []

    def test_well_separated_aircraft_no_conflict(self):
        ac = [
            _make_ac("A", 20.0, 77.0, 35000),
            _make_ac("B", 25.0, 80.0, 40000),
        ]
        assert detect_conflicts(ac) == []

    def test_horizontal_violation_detected(self):
        # Place two aircraft < 10km apart at same altitude
        ac = [
            _make_ac("A", 20.0000, 77.0000, 35000),
            _make_ac("B", 20.0001, 77.0001, 35000),  # ~15m apart
        ]
        conflicts = detect_conflicts(ac)
        assert len(conflicts) == 1
        assert {conflicts[0].aircraft_1, conflicts[0].aircraft_2} == {"A", "B"}

    def test_vertical_separation_prevents_conflict(self):
        ac = [
            _make_ac("A", 20.0000, 77.0000, 35000),
            _make_ac("B", 20.0001, 77.0001, 37000),  # > 1000ft apart
        ]
        assert detect_conflicts(ac) == []

    def test_no_duplicate_pairs(self):
        # Three aircraft all in conflict with each other → 3 pairs
        ac = [
            _make_ac("A", 20.0000, 77.0000, 35000),
            _make_ac("B", 20.0001, 77.0001, 35000),
            _make_ac("C", 20.0002, 77.0002, 35000),
        ]
        conflicts = detect_conflicts(ac)
        pairs = [(c.aircraft_1, c.aircraft_2) for c in conflicts]
        assert len(pairs) == len(set(pairs))  # no duplicates

    def test_custom_separation_thresholds(self):
        ac = [
            _make_ac("A", 20.0000, 77.0000, 35000),
            _make_ac("B", 20.005, 77.005, 35000),  # ~700m apart
        ]
        # Default 10km threshold → conflict
        assert len(detect_conflicts(ac, h_sep_km=10.0)) == 1
        # Tighter 0.1km threshold → no conflict
        assert len(detect_conflicts(ac, h_sep_km=0.1)) == 0


class TestPredictConflicts:
    def test_no_aircraft_returns_empty(self):
        assert predict_conflicts([]) == []

    def test_predicted_in_seconds_set(self, sample_aircraft):
        # Use fixture from conftest
        conflicts = predict_conflicts(sample_aircraft, seconds_ahead=300)
        for c in conflicts:
            assert c.predicted_in_seconds == 300

    def test_returns_predicted_conflict_objects(self, sample_aircraft):
        from app.schemas.conflict import PredictedConflict
        conflicts = predict_conflicts(sample_aircraft)
        for c in conflicts:
            assert isinstance(c, PredictedConflict)
