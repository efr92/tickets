"""Бронь мест.

Инвариант: capacity >= sold + сумма активных броней. Его держит блокировка строки
события (SELECT ... FOR UPDATE): создание брони и подтверждение заказа для одного
события выполняются по очереди, поэтому гонок «проверил — а потом занял» нет.
"""
import uuid
from datetime import datetime, timedelta, timezone

from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import SessionLocal
from app.errors import EventNotFound, SoldOut
from app.models import Event, SeatHold
from app.settings import HOLD_TTL_SECONDS


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


async def lock_event(session: AsyncSession, event_id: int) -> Event:
    event = await session.scalar(select(Event).where(Event.id == event_id).with_for_update())
    if event is None:
        raise EventNotFound
    return event


async def held_seats(session: AsyncSession, event_id: int, now: datetime) -> int:
    return await session.scalar(
        select(func.coalesce(func.sum(SeatHold.seats), 0)).where(
            SeatHold.event_id == event_id, SeatHold.expires_at > now
        )
    )


async def available_seats(session: AsyncSession, event: Event, now: datetime | None = None) -> int:
    """Сколько мест видит новый покупатель: без проданных и без чужих броней."""
    held = await held_seats(session, event.id, now or utcnow())
    return max(event.capacity - event.sold - held, 0)


async def create_hold(
    event_id: int, seats: int, replace_hold_id: uuid.UUID | None = None
) -> SeatHold:
    """Закрепляет места. replace_hold_id — прежняя бронь этого покупателя: она
    освобождается в той же транзакции, а при нехватке мест (SoldOut) откатывается
    вместе со всем, то есть старая бронь остаётся на месте."""
    async with SessionLocal() as session, session.begin():
        event = await lock_event(session, event_id)
        now = utcnow()
        if replace_hold_id:
            await session.execute(
                delete(SeatHold).where(
                    SeatHold.id == replace_hold_id, SeatHold.event_id == event_id
                )
            )
        available = await available_seats(session, event, now)
        if seats > available:
            raise SoldOut(seats_left=available, requested=seats)
        hold = SeatHold(
            id=uuid.uuid4(),
            event_id=event_id,
            seats=seats,
            expires_at=now + timedelta(seconds=HOLD_TTL_SECONDS),
            created_at=now,
        )
        session.add(hold)
    return hold


async def purge_expired() -> int:
    """Уборка старых броней (для подсчёта они и так не учитываются после expires_at)."""
    async with SessionLocal() as session, session.begin():
        result = await session.execute(
            delete(SeatHold).where(SeatHold.expires_at < utcnow() - timedelta(minutes=1))
        )
        return result.rowcount
