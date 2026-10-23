import os
import uuid
from datetime import timedelta

from fastapi import APIRouter, Depends, Header, Query
from sqlalchemy import update
from sqlalchemy.ext.asyncio import AsyncSession

from app import cache
from app.db import get_session
from app.domain import pricing
from app.domain.pricing import Quote, build_quote
from app.errors import ApiError, EventNotFound, SoldOut
from app.models import Event, Order, SeatHold
from app.schemas import (
    EventOut, HoldIn, HoldOut, OrderCreateIn, OrderIn, OrderOut, QuoteOut, RulesOut,
)
from app.services import holds, orders
from app.settings import HOLD_TTL_SECONDS

router = APIRouter(prefix="/api")
DEV_ENDPOINTS = os.environ.get("ENABLE_DEV_ENDPOINTS") == "1"


def _quote(body: OrderIn) -> Quote:
    return build_quote(body.email, [(p.name, p.age) for p in body.participants])


def _issues(q: Quote) -> list[dict]:
    return [vars(i) for i in q.issues]


def _lines(q: Quote) -> list[dict]:
    return [vars(l) for l in q.lines]


def _validated(body: OrderIn) -> Quote:
    q = _quote(body)
    if not q.valid:
        raise ApiError(422, {"code": "VALIDATION", "errors": _issues(q)})
    return q


def _sold_out(e: SoldOut) -> ApiError:
    return ApiError(409, {"code": "SOLD_OUT", "seats_left": e.seats_left, "requested": e.requested})


@router.get("/events/{event_id}", response_model=EventOut)
async def get_event(event_id: int, session: AsyncSession = Depends(get_session)):
    event = await session.get(Event, event_id)
    if event is None:
        raise ApiError(404, {"code": "NOT_FOUND"})
    return EventOut(
        id=event.id, title=event.title, venue=event.venue, starts_at=event.starts_at,
        capacity=event.capacity, seats_left=await holds.available_seats(session, event),
        rules=RulesOut(
            full_price=pricing.FULL_PRICE, child_price=pricing.CHILD_PRICE,
            child_max_age=pricing.CHILD_MAX_AGE, adult_min_age=pricing.ADULT_MIN_AGE,
            min_participants=pricing.MIN_PARTICIPANTS, max_participants=pricing.MAX_PARTICIPANTS,
        ),
    )


@router.post("/orders/quote", response_model=QuoteOut)
async def quote_order(body: OrderIn):
    """Проверка и расчёт без записи и без брони мест."""
    q = _quote(body)
    return {"valid": q.valid, "lines": _lines(q), "total_rub": q.total_rub, "issues": _issues(q)}


@router.post("/holds", response_model=HoldOut, status_code=201)
async def create_hold(body: HoldIn):
    """Проверяет данные и закрепляет места на HOLD_TTL_SECONDS."""
    q = _validated(body)
    try:
        hold = await holds.create_hold(body.event_id, len(q.lines), body.replace_hold_id)
    except SoldOut as e:
        raise _sold_out(e)
    except EventNotFound:
        raise ApiError(404, {"code": "NOT_FOUND"})
    return {
        "hold_id": hold.id, "expires_at": hold.expires_at, "ttl_seconds": HOLD_TTL_SECONDS,
        "lines": _lines(q), "total_rub": q.total_rub,
    }


@router.post("/orders", response_model=OrderOut, status_code=201)
async def create_order(
    body: OrderCreateIn, idempotency_key: str | None = Header(default=None)
):
    q = _validated(body)
    if idempotency_key and not await cache.try_lock(idempotency_key):
        raise ApiError(409, {"code": "IN_PROGRESS"})
    try:
        return await orders.confirm_order(
            body.event_id, body.email, q, body.hold_id, idempotency_key
        )
    except SoldOut as e:
        raise _sold_out(e)
    except EventNotFound:
        raise ApiError(404, {"code": "NOT_FOUND"})
    finally:
        if idempotency_key:
            await cache.release(idempotency_key)


@router.get("/orders/{order_id}", response_model=OrderOut)
async def get_order(order_id: uuid.UUID, session: AsyncSession = Depends(get_session)):
    order = await session.get(Order, order_id)
    if order is None:
        raise ApiError(404, {"code": "NOT_FOUND"})
    return order


@router.post("/dev/events/{event_id}/seats")
async def dev_set_seats(
    event_id: int, left: int = Query(ge=0), session: AsyncSession = Depends(get_session)
):
    """Только для демо и e2e: сбрасывает все брони и оставляет `left` свободных мест
    («бронь истекла, места разобрали»). Включается ENABLE_DEV_ENDPOINTS=1."""
    if not DEV_ENDPOINTS:
        raise ApiError(404, {"code": "NOT_FOUND"})
    event = await session.get(Event, event_id)
    if event is None:
        raise ApiError(404, {"code": "NOT_FOUND"})
    await session.execute(
        update(SeatHold)
        .where(SeatHold.event_id == event_id)
        .values(expires_at=holds.utcnow() - timedelta(seconds=1))
    )
    event.sold = max(event.capacity - left, 0)
    await session.commit()
    return {"seats_left": event.capacity - event.sold}
