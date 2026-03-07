"""
Conflict service — loads aircraft from Redis and runs the conflict engine.
"""
from __future__ import annotations

import logging

from app.cache.redis_client import RedisClient
from app.core.config import get_settings
from app.engines.conflict import detect_conflicts, predict_conflicts
from app.schemas.conflict import ConflictResponse, PredictedConflictResponse
from app.services.aircraft_service import list_aircraft

logger = logging.getLogger(__name__)
settings = get_settings()


async def get_conflicts(redis: RedisClient) -> ConflictResponse:
    ac_response = await list_aircraft(redis)
    conflicts = detect_conflicts(
        ac_response.aircraft,
        h_sep_km=settings.CONFLICT_H_SEP_KM,
        v_sep_ft=settings.CONFLICT_V_SEP_FT,
    )
    logger.info("Conflict detection complete", extra={"conflicts": len(conflicts)})
    return ConflictResponse(count=len(conflicts), conflicts=conflicts)


async def get_predicted_conflicts(redis: RedisClient) -> PredictedConflictResponse:
    ac_response = await list_aircraft(redis)
    conflicts = predict_conflicts(
        ac_response.aircraft,
        seconds_ahead=settings.CONFLICT_LOOKAHEAD_SECONDS,
        h_sep_km=settings.CONFLICT_H_SEP_KM,
        v_sep_ft=settings.CONFLICT_V_SEP_FT,
    )
    logger.info(
        "Predicted conflict detection complete",
        extra={"predicted_conflicts": len(conflicts)},
    )
    return PredictedConflictResponse(
        count=len(conflicts),
        lookahead_seconds=settings.CONFLICT_LOOKAHEAD_SECONDS,
        conflicts=conflicts,
    )
