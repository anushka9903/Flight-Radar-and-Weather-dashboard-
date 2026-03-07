"""Health-check endpoints."""
from __future__ import annotations

from fastapi import APIRouter, Response

from app.cache.redis_client import RedisClient, get_pool
from app.core.config import get_settings
from app.ingestion.opensky import get_opensky_circuit
from app.ingestion.openweather import get_openweather_circuit
from app.schemas.auth import HealthLive, HealthReady

import redis.asyncio as aioredis

router = APIRouter(prefix="/health", tags=["Health"])
settings = get_settings()


@router.get("/live", response_model=HealthLive)
async def liveness() -> HealthLive:
    """Kubernetes liveness probe — always returns 200 if the process is alive."""
    return HealthLive(
        status="ok",
        version=settings.APP_VERSION,
        environment=settings.ENVIRONMENT,
    )


@router.get("/ready", response_model=HealthReady)
async def readiness(response: Response) -> HealthReady:
    """
    Kubernetes readiness probe.
    Returns 200 only when all critical dependencies are healthy.
    """
    # Check Redis
    try:
        client = aioredis.Redis(connection_pool=get_pool(), decode_responses=True)
        redis = RedisClient(client)
        redis_ok = await redis.ping()
        await client.aclose()
    except Exception:
        redis_ok = False

    opensky_state = get_opensky_circuit().state.value
    openweather_state = get_openweather_circuit().state.value

    all_ok = redis_ok and opensky_state != "open" and openweather_state != "open"

    if not all_ok:
        response.status_code = 503

    return HealthReady(
        status="ok" if all_ok else "degraded",
        redis="ok" if redis_ok else "error",
        opensky_circuit=opensky_state,
        openweather_circuit=openweather_state,
    )
