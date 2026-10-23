import asyncio
import logging
from contextlib import asynccontextmanager, suppress

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

from app.api import router
from app.errors import ApiError
from app.services.holds import purge_expired

log = logging.getLogger("tickets")


async def _purge_loop() -> None:
    while True:
        try:
            await purge_expired()
        except Exception:
            log.exception("не удалось убрать истёкшие брони")
        await asyncio.sleep(60)


@asynccontextmanager
async def lifespan(_: FastAPI):
    task = asyncio.create_task(_purge_loop())
    try:
        yield
    finally:
        task.cancel()
        with suppress(asyncio.CancelledError):
            await task


app = FastAPI(title="Tickets", lifespan=lifespan)
app.include_router(router)


@app.get("/api/health")
async def health():
    return {"ok": True}


@app.exception_handler(ApiError)
async def api_error_handler(_: Request, exc: ApiError):
    return JSONResponse(exc.body, status_code=exc.status)


def _path(loc) -> str:
    out = ""
    for part in loc[1:]:  # первый элемент — "body"
        out += f"[{part}]" if isinstance(part, int) else ("." if out else "") + str(part)
    return out


@app.exception_handler(RequestValidationError)
async def validation_handler(_: Request, exc: RequestValidationError):
    errors = [{"field": _path(e["loc"]), "code": "INVALID", "message": e["msg"]}
              for e in exc.errors()]
    return JSONResponse({"code": "VALIDATION", "errors": errors}, status_code=422)
