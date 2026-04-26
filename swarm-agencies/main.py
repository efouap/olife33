"""
swarm-agencies/main.py
======================
Production FastAPI implementation of the O LIFE swarm-agencies service.

Replaces the original stub with:
  • GET  /health              — liveness (backward-compatible)
  • GET  /agents              — all agent states
  • GET  /agents/{name}       — single agent
  • POST /agents/{name}/task  — dispatch task to agent
  • GET  /metrics             — aggregated stats
  • GET  /metrics/events      — recent event log
  • WS   /ws/status           — real-time status stream (replaces stub loop)
  • WS   /ws/events           — raw event firehose
  • GET  /                    — live dashboard (static HTML)
"""

import asyncio
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from core.heartbeat import heartbeat_loop
from routers.api import router as api_router
from routers.ws import router as ws_router


# ── Lifespan ───────────────────────────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Start background heartbeat probe
    task = asyncio.create_task(heartbeat_loop())
    yield
    task.cancel()
    try:
        await task
    except asyncio.CancelledError:
        pass


# ── App ────────────────────────────────────────────────────────────────────────

app = FastAPI(
    title="O LIFE Swarm Agencies",
    version="2.33",
    description="Real-time swarm agent orchestration layer",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Routes ─────────────────────────────────────────────────────────────────────
app.include_router(api_router)
app.include_router(ws_router)

# Static dashboard
_STATIC = os.path.join(os.path.dirname(__file__), "static")
if os.path.isdir(_STATIC):
    app.mount("/static", StaticFiles(directory=_STATIC), name="static")

@app.get("/", include_in_schema=False)
async def dashboard():
    index = os.path.join(_STATIC, "index.html")
    if os.path.exists(index):
        return FileResponse(index)
    return {"message": "O LIFE Swarm Agencies v2.33 — visit /docs"}


# ── Dev entry-point ────────────────────────────────────────────────────────────
if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
