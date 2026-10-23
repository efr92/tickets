import os
from pathlib import Path

from dotenv import load_dotenv
from sqlalchemy.engine import URL

# .env лежит в корне проекта (рядом с docker-compose.yml). Переменные, уже заданные
# в окружении (Docker, CI), приоритетнее файла. В контейнере файла нет — это нормально.
load_dotenv(Path(__file__).resolve().parents[2] / ".env")

# На сколько секунд места закрепляются за покупателем после «Проверить заказ»
HOLD_TTL_SECONDS = int(os.environ.get("HOLD_TTL_SECONDS", "600"))


def _required(name: str) -> str:
    value = os.environ.get(name)
    if not value:
        raise RuntimeError(
            f"Не задана переменная окружения {name}. Скопируйте .env.example в .env и заполните её."
        )
    return value


def database_url() -> str | URL:
    """DATABASE_URL, если задана, иначе строка из POSTGRES_*.
    URL.create сам экранирует спецсимволы в логине и пароле."""
    explicit = os.environ.get("DATABASE_URL")
    if explicit:
        return explicit
    return URL.create(
        "postgresql+asyncpg",
        username=_required("POSTGRES_USER"),
        password=_required("POSTGRES_PASSWORD"),
        host=os.environ.get("POSTGRES_HOST", "localhost"),
        port=int(os.environ.get("POSTGRES_PORT", "5432")),
        database=_required("POSTGRES_DB"),
    )
