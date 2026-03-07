"""Unit tests for the weather advisory engine."""
import pytest

from app.engines.weather_advisory import build_advisory, _evaluate_severity
from app.schemas.aircraft import AircraftState
from app.schemas.weather import WeatherData


def _make_ac(icao: str = "TEST") -> AircraftState:
    return AircraftState(
        icao=icao, callsign=None,
        latitude=20.0, longitude=77.0,
        altitude=35000, velocity=800, heading=90,
    )


def _make_weather(**kwargs) -> WeatherData:
    defaults = dict(
        latitude=20.0, longitude=77.0,
        temperature=25.0, humidity=60.0, pressure=1013.0,
        wind_speed=5.0, wind_direction=90.0,
        cloud_cover=20.0, visibility=10000.0,
        condition="clear sky",
    )
    defaults.update(kwargs)
    return WeatherData(**defaults)


class TestEvaluateSeverity:
    def test_severe_wind_is_high(self):
        assert _evaluate_severity(["Severe wind"]) == "HIGH"

    def test_very_low_visibility_is_high(self):
        assert _evaluate_severity(["Very low visibility"]) == "HIGH"

    def test_heavy_precipitation_is_medium(self):
        assert _evaluate_severity(["Heavy precipitation"]) == "MEDIUM"

    def test_dense_cloud_is_medium(self):
        assert _evaluate_severity(["Dense cloud cover"]) == "MEDIUM"

    def test_moderate_wind_is_low(self):
        assert _evaluate_severity(["Moderate wind"]) == "LOW"

    def test_multiple_warnings_take_highest(self):
        assert _evaluate_severity(["Moderate wind", "Severe wind"]) == "HIGH"


class TestBuildAdvisory:
    def test_clear_conditions_return_none(self):
        result = build_advisory(_make_ac(), _make_weather())
        assert result is None

    def test_severe_wind_triggers_advisory(self):
        w = _make_weather(wind_speed=25.0)
        result = build_advisory(_make_ac(), w)
        assert result is not None
        assert result.severity == "HIGH"
        assert "Severe wind" in result.warnings

    def test_very_low_visibility_triggers_advisory(self):
        w = _make_weather(visibility=1500.0)
        result = build_advisory(_make_ac(), w)
        assert result is not None
        assert "Very low visibility" in result.warnings

    def test_reduced_visibility(self):
        w = _make_weather(visibility=3000.0)
        result = build_advisory(_make_ac(), w)
        assert result is not None
        assert "Reduced visibility" in result.warnings

    def test_dense_cloud_triggers_advisory(self):
        w = _make_weather(cloud_cover=95.0)
        result = build_advisory(_make_ac(), w)
        assert result is not None
        assert "Dense cloud cover" in result.warnings

    def test_stormy_condition_triggers_advisory(self):
        w = _make_weather(condition="thunderstorm with rain")
        result = build_advisory(_make_ac(), w)
        assert result is not None
        assert "Heavy precipitation" in result.warnings

    def test_aircraft_icao_preserved(self):
        w = _make_weather(wind_speed=25.0)
        result = build_advisory(_make_ac("MYICAO"), w)
        assert result is not None
        assert result.aircraft == "MYICAO"
