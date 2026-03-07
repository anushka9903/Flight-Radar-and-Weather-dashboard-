"""
FastAPI dependency injection providers.
"""
from __future__ import annotations

from typing import Annotated

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError

from app.cache.redis_client import RedisClient, get_redis
from app.core.security import get_subject_from_token

bearer_scheme = HTTPBearer(auto_error=True)


async def get_current_user(
    credentials: Annotated[HTTPAuthorizationCredentials, Depends(bearer_scheme)],
) -> str:
    """
    Validate Bearer JWT and return the subject (username/user_id).
    Raises HTTP 401 on invalid or expired tokens.
    """
    try:
        subject = get_subject_from_token(credentials.credentials)
    except JWTError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        ) from exc
    return subject


# Type aliases for use in route signatures
CurrentUser = Annotated[str, Depends(get_current_user)]
Redis = Annotated[RedisClient, Depends(get_redis)]
