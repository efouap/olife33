"""
routers/ws.py — WebSocket endpoints.

/ws/status   — real-time agent status stream (replaces the stub loop)
/ws/events   — raw event bus tap (all call/status/error events)
"""

from __future__ import annotations

import asyncio
import time
from typing import Any, Dict

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from core.registry import registry

router = APIRouter()


async def _sender(ws: WebSocket, q: asyncio.Queue) -> None:
    """Drain the queue and forward each event to the WebSocket."""
    while True:
        event = await q.get()
        await ws.send_json(event)


# ── /ws/status ────────────────────────────────────────────────────────────────
# On connect: send a full snapshot, then stream incremental updates.
# Maintains the original contract  { status, task_queue }  but enriches it.

@router.websocket("/ws/status")
async def ws_status(websocket: WebSocket) -> None:
    await websocket.accept()
    q = registry.bus.subscribe()

    try:
        # 1. Immediate snapshot
        await websocket.send_json(
            {
                "type":    "snapshot",
                "ts":      time.time(),
                "status":  "active",           # top-level contract compat
                "task_queue": sum(a.task_queue for a in registry.all()),
                "agents":  [a.to_dict() for a in registry.all()],
            }
        )

        # 2. Replay recent events so the UI doesn't start cold
        for evt in registry.bus.history(20):
            await websocket.send_json(evt)

        # 3. Stream live — run sender and keep-alive pinger concurrently
        async def _ping() -> None:
            while True:
                await asyncio.sleep(5)
                total_queue = sum(a.task_queue for a in registry.all())
                await websocket.send_json(
                    {
                        "type":       "ping",
                        "ts":         time.time(),
                        "status":     "active",
                        "task_queue": total_queue,
                    }
                )

        sender_task = asyncio.create_task(_sender(websocket, q))
        ping_task   = asyncio.create_task(_ping())

        # Block until client disconnects (recv returns or raises)
        try:
            while True:
                await websocket.receive_text()   # client can send "ping"
        except WebSocketDisconnect:
            pass
        finally:
            sender_task.cancel()
            ping_task.cancel()

    finally:
        registry.bus.unsubscribe(q)


# ── /ws/events ────────────────────────────────────────────────────────────────
# Raw firehose — every call/status/error event, no throttling.

@router.websocket("/ws/events")
async def ws_events(websocket: WebSocket) -> None:
    await websocket.accept()
    q = registry.bus.subscribe()
    try:
        for evt in registry.bus.history(50):
            await websocket.send_json(evt)
        while True:
            event = await q.get()
            await websocket.send_json(event)
    except WebSocketDisconnect:
        pass
    finally:
        registry.bus.unsubscribe(q)
