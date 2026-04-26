"""
core/heartbeat.py — Periodic health-polling of every registered agent.

Every INTERVAL seconds:
  1. HTTP GET  http://localhost:{port}/health
  2. Update registry status → idle/error/offline
  3. Publish event to WebSocket bus
"""

from __future__ import annotations

import asyncio
import time
from typing import Optional

import httpx

from core.registry import registry

INTERVAL = 15          # seconds between polls
TIMEOUT  = 5           # per-request timeout


async def _probe_one(client: httpx.AsyncClient, name: str, port: int) -> None:
    start = time.perf_counter()
    try:
        r = await client.get(f"http://localhost:{port}/health", timeout=TIMEOUT)
        latency = (time.perf_counter() - start) * 1000
        if r.status_code == 200:
            data = r.json()
            queue = data.get("task_queue", 0)
            status = "active" if queue > 0 else "idle"
            await registry.update_status(name, status, task_queue=queue)
            await registry.record_call(name, latency_ms=latency)
        else:
            await registry.update_status(name, "error", error=f"HTTP {r.status_code}")
    except (httpx.ConnectError, httpx.TimeoutException):
        await registry.update_status(name, "offline", error="unreachable")
    except Exception as exc:
        await registry.update_status(name, "error", error=str(exc)[:120])


async def heartbeat_loop() -> None:
    """Run forever — probe all agents every INTERVAL seconds."""
    async with httpx.AsyncClient() as client:
        while True:
            tasks = [
                _probe_one(client, a.name, a.port)
                for a in registry.all()
            ]
            await asyncio.gather(*tasks, return_exceptions=True)
            await asyncio.sleep(INTERVAL)
