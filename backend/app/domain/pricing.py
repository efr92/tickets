"""Бизнес-правила заказа. Чистые функции без IO — всё, что нужно менять
при смене условий (цены, возрастные пороги, лимит участников), лежит здесь."""
from __future__ import annotations

import re
from collections.abc import Sequence
from dataclasses import dataclass

FULL_PRICE = 2000        # от 14 лет
CHILD_PRICE = 1000       # младше 14 лет
CHILD_MAX_AGE = 13       # ребёнок: возраст <= 13
ADULT_MIN_AGE = 18       # сопровождающий: возраст >= 18
MIN_PARTICIPANTS = 1
MAX_PARTICIPANTS = 4
MAX_AGE = 120

_EMAIL = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


@dataclass(frozen=True)
class Issue:
    field: str      # "email", "participants", "participants[0].name"
    code: str
    message: str


@dataclass(frozen=True)
class Line:
    name: str
    age: int
    ticket_type: str   # "full" | "child"
    price_rub: int


@dataclass(frozen=True)
class Quote:
    lines: tuple[Line, ...]
    total_rub: int
    issues: tuple[Issue, ...]

    @property
    def valid(self) -> bool:
        return not self.issues


def ticket_type(age: int) -> str:
    return "child" if age <= CHILD_MAX_AGE else "full"


def price_for(kind: str) -> int:
    return CHILD_PRICE if kind == "child" else FULL_PRICE


def build_quote(email: str, people: Sequence[tuple[str, int | None]]) -> Quote:
    issues: list[Issue] = []
    lines: list[Line] = []

    if not MIN_PARTICIPANTS <= len(people) <= MAX_PARTICIPANTS:
        issues.append(Issue(
            "participants", "COUNT",
            f"В заказе может быть от {MIN_PARTICIPANTS} до {MAX_PARTICIPANTS} участников",
        ))

    all_ages_known = True
    for i, (raw_name, age) in enumerate(people):
        name = raw_name.strip()
        if not name:
            issues.append(Issue(f"participants[{i}].name", "NAME_REQUIRED", "Укажите имя"))
        if age is None:
            issues.append(Issue(f"participants[{i}].age", "AGE_REQUIRED", "Укажите возраст"))
        elif not 0 <= age <= MAX_AGE:
            issues.append(Issue(f"participants[{i}].age", "AGE_INVALID",
                                f"Возраст должен быть от 0 до {MAX_AGE}"))
        if age is None or not 0 <= age <= MAX_AGE:
            all_ages_known = False
        elif name:
            kind = ticket_type(age)
            lines.append(Line(name, age, kind, price_for(kind)))

    if all_ages_known and people:
        ages = [a for _, a in people if a is not None]
        if any(a <= CHILD_MAX_AGE for a in ages) and not any(a >= ADULT_MIN_AGE for a in ages):
            issues.append(Issue(
                "participants", "ADULT_REQUIRED",
                f"Ребёнок может прийти только с участником от {ADULT_MIN_AGE} лет в том же заказе",
            ))

    if not _EMAIL.match(email.strip()):
        issues.append(Issue("email", "EMAIL_INVALID", "Укажите корректный email"))

    return Quote(tuple(lines), sum(l.price_rub for l in lines), tuple(issues))
