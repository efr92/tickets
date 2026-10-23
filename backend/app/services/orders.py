import uuid

from sqlalchemy import delete, select
from sqlalchemy.exc import IntegrityError

from app.db import SessionLocal
from app.domain.pricing import Quote
from app.errors import SoldOut
from app.models import Order, Participant, SeatHold
from app.services.holds import available_seats, lock_event, utcnow


async def confirm_order(
    event_id: int,
    email: str,
    quote: Quote,
    hold_id: uuid.UUID | None = None,
    idempotency_key: str | None = None,
) -> Order:
    """Подтверждение: места списываются и заказ создаётся в одной транзакции.

    Бронь покупателя (если есть) удаляется до подсчёта свободных мест, поэтому
    живая бронь «сама себе» места не мешает, а истёкшая просто не учитывается:
    тогда места добираются заново, и если их не осталось — SoldOut.
    """
    seats = len(quote.lines)
    try:
        async with SessionLocal() as session, session.begin():
            event = await lock_event(session, event_id)

            if idempotency_key:
                existing = await session.scalar(
                    select(Order).where(Order.idempotency_key == idempotency_key)
                )
                if existing:
                    return existing

            if hold_id:
                await session.execute(
                    delete(SeatHold).where(SeatHold.id == hold_id, SeatHold.event_id == event_id)
                )
            available = await available_seats(session, event, utcnow())
            if seats > available:
                raise SoldOut(seats_left=available, requested=seats)

            event.sold += seats
            order = Order(
                id=uuid.uuid4(),
                event_id=event_id,
                email=email.strip(),
                total_rub=quote.total_rub,
                idempotency_key=idempotency_key,
                participants=[
                    Participant(
                        position=i, name=l.name, age=l.age,
                        ticket_type=l.ticket_type, price_rub=l.price_rub,
                    )
                    for i, l in enumerate(quote.lines)
                ],
            )
            session.add(order)
        return order
    except IntegrityError:
        # Страховка на случай гонки двух запросов с одним Idempotency-Key.
        if not idempotency_key:
            raise
        async with SessionLocal() as session:
            return await session.scalar(
                select(Order).where(Order.idempotency_key == idempotency_key)
            )
