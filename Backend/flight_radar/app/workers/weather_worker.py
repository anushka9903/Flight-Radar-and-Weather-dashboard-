"""
Background weather ingestion worker.
Iterates over the airspace grid, fetches OpenWeather data for each cell,
and caches results in Redis.
"""
from __future__ import annotations

import asyncio
import logging

import redis.asyncio as aioredis

from app.cache.redis_client import RedisClient, get_pool
from app.core.config import get_settings
from app.ingestion.openweather import fetch_weather

logger = logging.getLogger(__name__)
settings = get_settings()


def _grid_points() -> list[tuple[float, float]]:
    step = settings.WEATHER_GRID_STEP
    points: list[tuple[float, float]] = []
    lat = settings.AIRSPACE_MIN_LAT
    while lat < settings.AIRSPACE_MAX_LAT:
        lon = settings.AIRSPACE_MIN_LON
        while lon < settings.AIRSPACE_MAX_LON:
            points.append((float(lat), float(lon)))
            lon += step
        lat += step
    return points


async def weather_ingestion_loop() -> None:
    """Runs forever; designed to be launched as an asyncio task."""
    logger.info(
        "Weather ingestion worker started",
        extra={"interval": settings.OPENWEATHER_POLL_INTERVAL},
    )
    pool = get_pool()
    grid = _grid_points()
    logger.info("Weather grid size", extra={"cells": len(grid)})

    while True:
        updated = 0
        errors = 0

        client = aioredis.Redis(connection_pool=pool, decode_responses=True)
        redis = RedisClient(client)
        try:
            for lat, lon in grid:
                try:
                    weather = await fetch_weather(lat, lon, redis)
                    if weather:
                        updated += 1
                    else:
                        errors += 1
                    # Small sleep to avoid hammering the API
                    await asyncio.sleep(0.25)
                except asyncio.CancelledError:
                    raise
                except Exception as exc:
                    logger.warning("Weather cell error (%s, %s): %s", lat, lon, exc)
                    errors += 1
        except asyncio.CancelledError:
            logger.info("Weather ingestion worker cancelled")
            raise
        finally:
            await client.aclose()

        logger.info(
            "Weather grid cycle complete",
            extra={"updated": updated, "errors": errors},
        )
        await asyncio.sleep(settings.OPENWEATHER_POLL_INTERVAL)
