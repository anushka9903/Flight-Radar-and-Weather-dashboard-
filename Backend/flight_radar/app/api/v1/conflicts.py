"""Conflict detection API endpoints."""
from __future__ import annotations

from fastapi import APIRouter

from app.core.dependencies import CurrentUser, Redis
from app.schemas.conflict import ConflictResponse, PredictedConflictResponse
from app.services.conflict_service import get_conflicts, get_predicted_conflicts

router = APIRouter(prefix="/conflicts", tags=["Conflicts"])


@router.get("", response_model=ConflictResponse)
async def current_conflicts(
    redis: Redis,
    _: CurrentUser,
) -> ConflictResponse:
    """Detect current separation violations."""
    return await get_conflicts(redis)


@router.get("/predicted", response_model=PredictedConflictResponse)
async def predicted_conflicts(
    redis: Redis,
    _: CurrentUser,
) -> PredictedConflictResponse:
    """Predict future separation violations within the configured lookahead window."""
    return await get_predicted_conflicts(redis)
