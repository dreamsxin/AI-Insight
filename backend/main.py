"""FastAPI application entry point."""

from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.routers import chapters, compute, terms


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    print(f"🚀 AI-Insight API running on http://{settings.HOST}:{settings.PORT}")
    print(f"   Docs available at http://{settings.HOST}:{settings.PORT}/docs")
    yield
    # Shutdown
    print("👋 Shutting down...")


app = FastAPI(
    title="AI-Insight API",
    description="Backend API for AI-Insight - Interactive AI Principles Visualization",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routers under /api
app.include_router(chapters.router, prefix=settings.API_PREFIX)
app.include_router(compute.router, prefix=settings.API_PREFIX)
app.include_router(terms.router, prefix=settings.API_PREFIX)


@app.get("/")
async def root():
    return {
        "name": "AI-Insight API",
        "version": "1.0.0",
        "docs": "/docs",
    }


@app.get("/health")
async def health():
    return {"status": "ok"}
