from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

from src.config import settings
from src.db import engine
from src.models import Base
from src.routes import health, jobs, projects, shares, uploads, webhooks


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Create tables on startup (use Alembic in production)
    async with engine.begin() as conn:
        await conn.execute(text("CREATE EXTENSION IF NOT EXISTS postgis"))
        await conn.execute(text('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"'))
        await conn.run_sync(Base.metadata.create_all)
    yield


app = FastAPI(
    title="Skyforge API",
    version="0.1.0",
    lifespan=lifespan,
    docs_url="/docs" if settings.environment == "development" else None,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.web_url, "https://skyforge.app"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Protected routes (Firebase JWT)
app.include_router(health.router)
app.include_router(projects.router, prefix="/api/projects", tags=["projects"])
app.include_router(uploads.router, prefix="/api/uploads", tags=["uploads"])
app.include_router(jobs.router, prefix="/api/jobs", tags=["jobs"])

# Public routes
app.include_router(shares.router, prefix="/s", tags=["shares"])
app.include_router(webhooks.router, prefix="/webhooks", tags=["webhooks"])
