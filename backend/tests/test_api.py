"""Интеграционные тесты API на реальной PostgreSQL: RUN_DB_TESTS=1 pytest"""
import os
from datetime import timedelta

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy import update

from app.db import SessionLocal
from app.main import app
from app.models import Event, SeatHold
from app.services.holds import utcnow

pytestmark = pytest.mark.skipif(
    os.environ.get("RUN_DB_TESTS") != "1", reason="нужна PostgreSQL (RUN_DB_TESTS=1)"
)

ADULT = ("Олег", 40)
KID = ("Аня", 8)


@pytest_asyncio.fixture
async def client():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        yield c


def body(people, email="a@b.ru", **extra):
    return {
        "event_id": 1,
        "email": email,
        "participants": [{"name": n, "age": a} for n, a in people],
        **extra,
    }


async def seats_left(client) -> int:
    return (await client.get("/api/events/1")).json()["seats_left"]


async def set_event(**values) -> None:
    async with SessionLocal() as s, s.begin():
        await s.execute(update(Event).where(Event.id == 1).values(**values))


async def expire_all_holds() -> None:
    async with SessionLocal() as s, s.begin():
        await s.execute(update(SeatHold).values(expires_at=utcnow() - timedelta(seconds=5)))


async def test_event_exposes_rules_and_seats(client):
    data = (await client.get("/api/events/1")).json()
    assert data["seats_left"] == 12
    assert data["rules"]["full_price"] == 2000 and data["rules"]["child_price"] == 1000


async def test_hold_then_order_happy_path(client):
    r = await client.post("/api/holds", json=body([ADULT, KID]))
    assert r.status_code == 201
    hold = r.json()
    assert hold["total_rub"] == 3000 and hold["ttl_seconds"] > 0
    assert await seats_left(client) == 10          # места закреплены

    r = await client.post("/api/orders", json=body([ADULT, KID], hold_id=hold["hold_id"]))
    assert r.status_code == 201
    order = r.json()
    assert order["total_rub"] == 3000
    assert [p["ticket_type"] for p in order["participants"]] == ["full", "child"]
    assert await seats_left(client) == 10          # бронь превратилась в продажу, без двойного учёта

    again = await client.get(f"/api/orders/{order['id']}")
    assert again.status_code == 200 and again.json()["email"] == "a@b.ru"


async def test_child_without_adult_is_rejected(client):
    r = await client.post("/api/holds", json=body([KID]))
    assert r.status_code == 422
    errors = r.json()["errors"]
    assert {"field": "participants", "code": "ADULT_REQUIRED"}.items() <= errors[0].items()
    assert await seats_left(client) == 12          # при ошибке ничего не забронировано


async def test_hold_blocks_other_buyers(client):
    await set_event(capacity=4)
    assert (await client.post("/api/holds", json=body([ADULT] * 4))).status_code == 201
    r = await client.post("/api/holds", json=body([ADULT]))
    assert r.status_code == 409
    assert r.json() == {"code": "SOLD_OUT", "seats_left": 0, "requested": 1}


async def test_expired_hold_and_seats_gone_means_sold_out(client):
    hold = (await client.post("/api/holds", json=body([ADULT]))).json()
    await expire_all_holds()
    await set_event(sold=12)                       # места разобрали
    r = await client.post("/api/orders", json=body([ADULT], hold_id=hold["hold_id"]))
    assert r.status_code == 409 and r.json()["code"] == "SOLD_OUT"


async def test_expired_hold_with_free_seats_still_succeeds(client):
    hold = (await client.post("/api/holds", json=body([ADULT]))).json()
    await expire_all_holds()
    r = await client.post("/api/orders", json=body([ADULT], hold_id=hold["hold_id"]))
    assert r.status_code == 201


async def test_order_is_idempotent(client):
    headers = {"Idempotency-Key": "abc-123"}
    first = await client.post("/api/orders", json=body([ADULT]), headers=headers)
    second = await client.post("/api/orders", json=body([ADULT]), headers=headers)
    assert first.status_code == second.status_code == 201
    assert first.json()["id"] == second.json()["id"]
    assert await seats_left(client) == 11          # продано одно место, не два


async def test_replacing_hold_frees_the_old_one(client):
    first = (await client.post("/api/holds", json=body([ADULT, KID]))).json()
    second = await client.post(
        "/api/holds", json=body([ADULT, KID, ADULT], replace_hold_id=first["hold_id"])
    )
    assert second.status_code == 201
    assert await seats_left(client) == 9           # учитывается только новая бронь


async def test_failed_replace_keeps_old_hold(client):
    await set_event(capacity=3)
    mine = (await client.post("/api/holds", json=body([ADULT, ADULT]))).json()
    assert (await client.post("/api/holds", json=body([ADULT]))).status_code == 201
    r = await client.post(
        "/api/holds", json=body([ADULT] * 3, replace_hold_id=mine["hold_id"])
    )
    assert r.status_code == 409 and r.json()["seats_left"] == 2
    assert await seats_left(client) == 0           # прежняя бронь на 2 места цела


async def test_dev_endpoint_resets_holds_and_sets_seats(client):
    await client.post("/api/holds", json=body([ADULT]))
    r = await client.post("/api/dev/events/1/seats", params={"left": 3})
    assert r.json() == {"seats_left": 3}
    assert await seats_left(client) == 3
