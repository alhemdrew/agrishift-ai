from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app import models  # noqa: F401  (registers tables)
from app.config import settings
from app.db import Base, engine
from app.routers.auth import router as auth_router
from app.routers.explore import router as explore_router
from app.routers.intelligence import router as intelligence_router
from app.routers.assistant import router as assistant_router
from app.routers.geocode import router as geocode_router


@asynccontextmanager
async def lifespan(_app: FastAPI):
    Base.metadata.create_all(bind=engine)
    yield


app = FastAPI(title="AgriShift API", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.frontend_url],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(RequestValidationError)
async def validation_error_handler(_request: Request, exc: RequestValidationError):
    """Return one clear message in the same {"detail": "..."} shape the frontend expects."""
    first = exc.errors()[0]
    message = str(first.get("msg", "Invalid input.")).replace("Value error, ", "")
    if "email" in first.get("loc", ()):
        message = "Enter a valid email address."
    return JSONResponse(status_code=422, content={"detail": message})


app.include_router(auth_router)
app.include_router(explore_router)
app.include_router(intelligence_router)
app.include_router(assistant_router)
app.include_router(geocode_router)


@app.get("/health")
def health():
    return {"status": "ok"}
