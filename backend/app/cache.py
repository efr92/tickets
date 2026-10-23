"""Redis — необязательный. Нужен только как быстрая защита от двойного клика:
пока запрос с одним Idempotency-Key выполняется, второй получает 409.
Источник правды — уникальный idempotency_key в БД; без Redis всё работает."""
import os

import redis.asyncio as aioredis

_url = os.environ.get("REDIS_URL")
_redis = aioredis.from_url(_url) if _url else None


async def try_lock(key: str, ttl: int = 30) -> bool:
    if _redis is None:
        return True
    try:
        return bool(await _redis.set(f"lock:order:{key}", "1", nx=True, ex=ttl))
    except Exception:  # Redis недоступен — не блокируем покупку
        return True


async def release(key: str) -> None:
    if _redis is None:
        return
    try:
        await _redis.delete(f"lock:order:{key}")
    except Exception:
        pass
