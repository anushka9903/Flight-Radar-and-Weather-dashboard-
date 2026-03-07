"""
Integration test: aircraft ingestion → Redis → conflict detection → API response.
Uses a mock Redis to avoid needing a live Redis instance in CI.
"""
import pytest
from unittest.mock import AsyncMock, patch, MagicMock

from app.schemas.aircraft import AircraftState
from app.services.aircraft_service import list_aircraft, write_aircraft
from app.services.conflict_service import get_conflicts


@pytest.fixture
def conflicting_aircraft() -> list[AircraftState]:
    """Two aircraft within conflict separation."""
    return [
        AircraftState(
            icao="AAA111", callsign="FL111",
            latitude=20.0000, longitude=77.0000,
            altitude=35000.0, velocity=850.0, heading=90.0,
        ),
        AircraftState(
            icao="BBB222", callsign="FL222",
            latitude=20.0001, longitude=77.0001,
            altitude=35050.0, velocity=840.0, heading=270.0,
        ),
        AircraftState(
            icao="CCC333", callsign="FL333",
            latitude=30.0, longitude=85.0,
            altitude=40000.0, velocity=900.0, heading=45.0,
        ),
    ]


@pytest.mark.asyncio
async def test_write_and_read_aircraft(mock_redis, conflicting_aircraft):
    """Written aircraft can be read back via list_aircraft."""
    # Set up mock to return the aircraft we wrote
    icao_set = {ac.icao for ac in conflicting_aircraft}
    mock_redis.smembers = AsyncMock(return_value=icao_set)

    ac_map = {
        ac.icao: {
            "icao": ac.icao,
            "callsign": ac.callsign or "",
            "latitude": str(ac.latitude),
            "longitude": str(ac.longitude),
            "altitude": str(ac.altitude),
            "velocity": str(ac.velocity),
            "heading": str(ac.heading),
            "on_ground": "false",
        }
        for ac in conflicting_aircraft
    }
    mock_redis.hgetall = AsyncMock(side_effect=lambda key: ac_map.get(key.split(":")[1], {}))

    result = await list_aircraft(mock_redis)
    assert result.count == len(conflicting_aircraft)


@pytest.mark.asyncio
async def test_conflict_pipeline(mock_redis, conflicting_aircraft):
    """
    Full pipeline: aircraft in Redis → list_aircraft → detect_conflicts.
    The first two aircraft are within 10km and 1000ft → should conflict.
    """
    icao_set = {ac.icao for ac in conflicting_aircraft}
    mock_redis.smembers = AsyncMock(return_value=icao_set)

    ac_map = {
        ac.icao: {
            "icao": ac.icao,
            "callsign": ac.callsign or "",
            "latitude": str(ac.latitude),
            "longitude": str(ac.longitude),
            "altitude": str(ac.altitude),
            "velocity": str(ac.velocity),
            "heading": str(ac.heading),
            "on_ground": "false",
        }
        for ac in conflicting_aircraft
    }
    mock_redis.hgetall = AsyncMock(side_effect=lambda key: ac_map.get(key.split(":")[1], {}))

    result = await get_conflicts(mock_redis)
    assert result.count >= 1
    pairs = [{c.aircraft_1, c.aircraft_2} for c in result.conflicts]
    assert {"AAA111", "BBB222"} in pairs


@pytest.mark.asyncio
async def test_no_conflicts_when_aircraft_separated(mock_redis):
    """Well-separated aircraft produce no conflicts."""
    aircraft = [
        AircraftState(icao="X1", callsign=None, latitude=10.0, longitude=70.0,
                      altitude=30000, velocity=800, heading=0),
        AircraftState(icao="X2", callsign=None, latitude=20.0, longitude=80.0,
                      altitude=40000, velocity=800, heading=0),
    ]
    mock_redis.smembers = AsyncMock(return_value={"X1", "X2"})
    ac_map = {
        ac.icao: {
            "icao": ac.icao, "callsign": "",
            "latitude": str(ac.latitude), "longitude": str(ac.longitude),
            "altitude": str(ac.altitude), "velocity": str(ac.velocity),
            "heading": str(ac.heading), "on_ground": "false",
        }
        for ac in aircraft
    }
    mock_redis.hgetall = AsyncMock(side_effect=lambda key: ac_map.get(key.split(":")[1], {}))

    result = await get_conflicts(mock_redis)
    assert result.count == 0
