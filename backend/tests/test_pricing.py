from app.domain.pricing import build_quote

OK_EMAIL = "a@b.ru"


def codes(q):
    return {(i.field, i.code) for i in q.issues}


def test_adult_and_child_total():
    q = build_quote(OK_EMAIL, [("Олег", 40), ("Аня", 8)])
    assert q.valid and q.total_rub == 3000
    assert [l.ticket_type for l in q.lines] == ["full", "child"]


def test_age_boundaries():
    q = build_quote(OK_EMAIL, [("A", 18), ("B", 14), ("C", 13)])
    assert [l.price_rub for l in q.lines] == [2000, 2000, 1000]


def test_child_alone_is_rejected():
    assert ("participants", "ADULT_REQUIRED") in codes(build_quote(OK_EMAIL, [("Аня", 8)]))


def test_child_with_teen_is_rejected():
    q = build_quote(OK_EMAIL, [("Аня", 8), ("Петя", 17)])
    assert ("participants", "ADULT_REQUIRED") in codes(q)


def test_teen_alone_is_allowed():
    assert build_quote(OK_EMAIL, [("Петя", 15)]).valid


def test_limits():
    five = [(f"P{i}", 30) for i in range(5)]
    assert ("participants", "COUNT") in codes(build_quote(OK_EMAIL, five))
    assert ("participants", "COUNT") in codes(build_quote(OK_EMAIL, []))


def test_required_fields():
    q = build_quote("nope", [("", None)])
    assert codes(q) >= {
        ("participants[0].name", "NAME_REQUIRED"),
        ("participants[0].age", "AGE_REQUIRED"),
        ("email", "EMAIL_INVALID"),
    }
    assert ("participants", "ADULT_REQUIRED") not in codes(q)  # возраст неизвестен
