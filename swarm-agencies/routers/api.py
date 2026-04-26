"""
routers/api.py — HTTP endpoints.

GET  /health                    liveness probe (matches original contract)
GET  /agents                    list all agents with full state
GET  /agents/{name}             single agent state
POST /agents/{name}/task        dispatch a task to an agent
GET  /metrics                   aggregated summary
GET  /metrics/events?n=50       recent event log
"""

from __future__ import annotations

import time
import asyncio
from typing import Any, Dict, Optional

import httpx
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

from core.registry import registry

router = APIRouter()

_START = time.time()


# ── Models ────────────────────────────────────────────────────────────────────

class TaskRequest(BaseModel):
    task: str
    data: Dict[str, Any] = {}
    timeout: int = 60


# ── Health ────────────────────────────────────────────────────────────────────

@router.get("/health")
async def health() -> Dict:
    uptime = time.time() - _START
    summary = registry.summary()
    return {
        "status":        "online",
        "version":       "2.33",
        "uptime_s":      round(uptime, 1),
        "latency_ms":    12,          # self-latency stub (matches original)
        "agents_total":  summary["total_agents"],
        "agents_active": summary["active_agents"],
    }


# ── Agents ────────────────────────────────────────────────────────────────────

@router.get("/agents")
async def list_agents() -> Dict:
    return registry.summary()


@router.get("/agents/{name}")
async def get_agent(name: str) -> Dict:
    agent = registry.get(name)
    if not agent:
        raise HTTPException(404, f"Agent '{name}' not found")
    return agent.to_dict()


# ── Task dispatch ─────────────────────────────────────────────────────────────

@router.post("/agents/{name}/task")
async def dispatch_task(name: str, body: TaskRequest) -> Dict:
    agent = registry.get(name)
    if not agent:
        raise HTTPException(404, f"Agent '{name}' not found")
    if agent.status == "offline":
        raise HTTPException(503, f"Agent '{name}' is offline")

    # Mark busy
    agent.task_queue += 1
    await registry.update_status(name, "active", task_queue=agent.task_queue)

    start = time.perf_counter()
    try:
        async with httpx.AsyncClient() as client:
            r = await client.post(
                f"http://localhost:{agent.port}/run",
                json={"task": body.task, "data": body.data},
                timeout=body.timeout,
            )
        latency = (time.perf_counter() - start) * 1000
        r.raise_for_status()
        result = r.json()

        await registry.record_call(name, latency_ms=latency)
        agent.task_queue = max(0, agent.task_queue - 1)
        await registry.update_status(
            name,
            "active" if agent.task_queue > 0 else "idle",
            task_queue=agent.task_queue,
        )
        return {"agent": name, "latency_ms": round(latency, 1), "result": result}

    except Exception as exc:
        latency = (time.perf_counter() - start) * 1000
        agent.task_queue = max(0, agent.task_queue - 1)
        await registry.record_call(name, latency_ms=latency, error=True)
        await registry.update_status(name, "error", error=str(exc)[:200])
        raise HTTPException(502, f"Agent error: {exc}") from exc


# ── Metrics ───────────────────────────────────────────────────────────────────

@router.get("/metrics")
async def metrics() -> Dict:
    return registry.summary()


@router.get("/metrics/events")
async def metric_events(n: int = Query(50, le=200)) -> Dict:
    return {"events": registry.bus.history(n)}
