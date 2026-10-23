class ApiError(Exception):
    """Ошибка с готовым телом ответа (HTTP-статус + JSON)."""

    def __init__(self, status: int, body: dict):
        self.status = status
        self.body = body


class EventNotFound(Exception):
    pass


class SoldOut(Exception):
    def __init__(self, seats_left: int, requested: int):
        self.seats_left = seats_left
        self.requested = requested
