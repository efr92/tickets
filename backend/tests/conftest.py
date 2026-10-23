import os

os.environ.setdefault("ENABLE_DEV_ENDPOINTS", "1")  # до импорта app.api

import pytest_asyncio
from sqlalchemy import delete, update

RUN_DB = os.environ.get("RUN_DB_TESTS") == "1"


@pytest_asyncio.fixture(autouse=True)
async def clean_db():
    """Перед каждым БД-тестом: пустые заказы и брони, событие 1 на 12 мест."""
    if not RUN_DB:
        yield
        return
    from app.db import SessionLocal
    from app.models import Event, Order, Participant, SeatHold

    async with SessionLocal() as s, s.begin():
        await s.execute(delete(SeatHold))
        await s.execute(delete(Participant))
        await s.execute(delete(Order))
        await s.execute(update(Event).where(Event.id == 1).values(capacity=12, sold=0))
    yield
