"""
Sliding-window rate limiter backed by Redis INCR + EXPIRE.
Returns HTTP 429 when the request count exceeds the limit within the window.
"""
from __future__ import annotations

import logging

from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.requests import Request
from starlette.responses import JSONResponse, Response

from app.cache.redis_client import get_pool
from app.core.config import get_settings

import redis.asyncio as aioredis

logger = logging.getLogger(__name__)
settings = get_settings()


def _client_key(request: Request) -> str:
    """Derive a rate-limit key from client IP."""
    forwarded_for = request.headers.get("X-Forwarded-For")
    if forwarded_for:
        client_ip = forwarded_for.split(",")[0].strip()
    else:
        client_ip = (request.client.host if request.client else "unknown")
    return f"ratelimit:{client_ip}"


class RateLimitMiddleware(BaseHTTPMiddleware):
    """
    Exempt paths: /health/*, /metrics, /docs, /openapi.json
    """
    _EXEMPT_PREFIXES = ("/health", "/metrics", "/docs", "/openapi", "/redoc")

    async def dispatch(
        self, request: Request, call_next: RequestResponseEndpoint
    ) -> Response:
        if not settings.RATE_LIMIT_ENABLED:
            return await call_next(request)

        path: str = request.url.path
        if any(path.startswith(p) for p in self._EXEMPT_PREFIXES):
            return await call_next(request)

        key = _client_key(request)
        pool = get_pool()
        r = aioredis.Redis(connection_pool=pool, decode_responses=True)
        try:
            count = await r.incr(key)
            if count == 1:
                await r.expire(key, settings.RATE_LIMIT_WINDOW_SECONDS)
        except Exception as exc:
            logger.warning("Rate limit Redis error (allowing request): %s", exc)
            return await call_next(request)
        finally:
            await r.aclose()

        if count > settings.RATE_LIMIT_REQUESTS:
            logger.warning(
                "Rate limit exceeded",
                extra={"key": key, "count": count},
            )
            return JSONResponse(
                status_code=429,
                content={
                    "detail": "Too many requests",
                    "limit": settings.RATE_LIMIT_REQUESTS,
                    "window_seconds": settings.RATE_LIMIT_WINDOW_SECONDS,
                },
                headers={"Retry-After": str(settings.RATE_LIMIT_WINDOW_SECONDS)},
            )

        return await call_next(request)
