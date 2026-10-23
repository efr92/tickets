"""Нужна мигрированная БД: RUN_DB_TESTS=1 pytest (подключение — из ../.env)"""
import asyncio
import os

import pytest
from sqlalchemy import update

from app.db import SessionLocal
from app.domain.pricing import build_quote
from app.errors import SoldOut
from app.models import Event
from app.services.holds import create_hold
from app.services.orders import confirm_order

pytestmark = pytest.mark.skipif(
    os.environ.get("RUN_DB_TESTS") != "1", reason="нужна PostgreSQL (RUN_DB_TESTS=1)"
)

QUOTE = build_quote("a@b.ru", [("Олег", 30)])


async def _capacity(n: int) -> None:
    async with SessionLocal() as s, s.begin():
        await s.execute(update(Event).where(Event.id == 1).values(capacity=n, sold=0))


async def test_parallel_orders_never_oversell():
    await _capacity(3)
    results = await asyncio.gather(
        *(confirm_order(1, "a@b.ru", QUOTE) for _ in range(10)), return_exceptions=True
    )
    assert sum(not isinstance(r, Exception) for r in results) == 3
    assert sum(isinstance(r, SoldOut) for r in results) == 7


async def test_parallel_holds_never_overbook():
    await _capacity(3)
    results = await asyncio.gather(
        *(create_hold(1, 1) for _ in range(10)), return_exceptions=True
    )
    assert sum(not isinstance(r, Exception) for r in results) == 3
    assert sum(isinstance(r, SoldOut) for r in results) == 7
