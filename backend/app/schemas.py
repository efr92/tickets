import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict


class ParticipantIn(BaseModel):
    name: str = ""
    age: int | None = None


class OrderIn(BaseModel):
    event_id: int
    email: str = ""
    participants: list[ParticipantIn]


class HoldIn(OrderIn):
    replace_hold_id: uuid.UUID | None = None   # прежняя бронь этого покупателя


class OrderCreateIn(OrderIn):
    hold_id: uuid.UUID | None = None


class IssueOut(BaseModel):
    field: str
    code: str
    message: str


class LineOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    name: str
    age: int
    ticket_type: str
    price_rub: int


class QuoteOut(BaseModel):
    valid: bool
    lines: list[LineOut]
    total_rub: int
    issues: list[IssueOut]


class HoldOut(BaseModel):
    hold_id: uuid.UUID
    expires_at: datetime
    ttl_seconds: int       # сколько живёт бронь с момента ответа (часы клиента не нужны)
    lines: list[LineOut]
    total_rub: int


class RulesOut(BaseModel):
    full_price: int
    child_price: int
    child_max_age: int
    adult_min_age: int
    min_participants: int
    max_participants: int


class EventOut(BaseModel):
    id: int
    title: str
    venue: str
    starts_at: datetime
    capacity: int
    seats_left: int
    rules: RulesOut


class OrderOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    event_id: int
    email: str
    total_rub: int
    created_at: datetime
    participants: list[LineOut]
