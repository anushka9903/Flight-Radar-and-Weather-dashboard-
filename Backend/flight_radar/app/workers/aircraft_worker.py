"""
Background aircraft ingestion worker.
Fetches from OpenSky on a configurable interval and writes to Redis.
"""
from __future__ import annotations

import asyncio
import logging

import redis.asyncio as aioredis

from app.cache.redis_client import RedisClient, get_pool
from app.core.config import get_settings
from app.ingestion.opensky import fetch_aircraft
from app.services.aircraft_service import write_aircraft

logger = logging.getLogger(__name__)
settings = get_settings()


async def aircraft_ingestion_loop() -> None:
    """Runs forever; designed to be launched as an asyncio task."""
    logger.info(
        "Aircraft ingestion worker started",
        extra={"interval": settings.OPENSKY_POLL_INTERVAL},
    )
    pool = get_pool()

    while True:
        try:
            aircraft = await fetch_aircraft()
            if aircraft:
                client = aioredis.Redis(connection_pool=pool, decode_responses=True)
                redis = RedisClient(client)
                try:
                    count = await write_aircraft(redis, aircraft)
                    logger.info("Aircraft ingestion cycle", extra={"count": count})
                finally:
                    await client.aclose()
        except asyncio.CancelledError:
            logger.info("Aircraft ingestion worker cancelled")
            raise
        except Exception as exc:
            logger.exception("Aircraft ingestion cycle error: %s", exc)

        await asyncio.sleep(settings.OPENSKY_POLL_INTERVAL)
