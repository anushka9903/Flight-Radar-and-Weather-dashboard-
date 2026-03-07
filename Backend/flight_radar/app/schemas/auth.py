"""Auth request/response schemas."""
from __future__ import annotations

from pydantic import BaseModel, Field


class LoginRequest(BaseModel):
    username: str = Field(..., min_length=1)
    password: str = Field(..., min_length=1)


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int


class HealthLive(BaseModel):
    status: str
    version: str
    environment: str


class HealthReady(BaseModel):
    status: str
    redis: str
    opensky_circuit: str
    openweather_circuit: str
