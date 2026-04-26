"""
core/registry.py — Central agency registry and metrics store.

Holds runtime state for every named agent:
  - status   : idle | active | error | offline
  - task_queue: how many tasks are pending
  - metrics  : rolling latency, throughput, error counts
  - events   : ring-buffer of recent broadcast events
"""

from __future__ import annotations

import asyncio
import time
from collections import deque
from dataclasses import dataclass, field
from typing import Any, Deque, Dict, List, Literal, Optional

AgentStatus = Literal["idle", "active", "error", "offline"]


@dataclass
class AgentMetrics:
    calls: int = 0
    errors: int = 0
    total_latency_ms: float = 0.0
    total_tokens: int = 0

    @property
    def avg_latency_ms(self) -> float:
        return round(self.total_latency_ms / self.calls, 1) if self.calls else 0.0

    @property
    def success_rate(self) -> float:
        return round(((self.calls - self.errors) / self.calls) * 100, 1) if self.calls else 100.0

    def record(self, latency_ms: float, tokens: int = 0, error: bool = False) -> None:
        self.calls += 1
        self.total_latency_ms += latency_ms
        self.total_tokens += tokens
        if error:
            self.errors += 1


@dataclass
class AgentState:
    name: str
    port: int
    mission: str
    description: str
    status: AgentStatus = "idle"
    task_queue: int = 0
    metrics: AgentMetrics = field(default_factory=AgentMetrics)
    last_seen: float = field(default_factory=time.time)
    last_error: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        return {
            "name": self.name,
            "port": self.port,
            "mission": self.mission,
            "description": self.description,
            "status": self.status,
            "task_queue": self.task_queue,
            "last_seen": self.last_seen,
            "last_error": self.last_error,
            "metrics": {
                "calls": self.metrics.calls,
                "errors": self.metrics.errors,
                "avg_latency_ms": self.metrics.avg_latency_ms,
                "success_rate": self.metrics.success_rate,
                "total_tokens": self.metrics.total_tokens,
            },
        }


class EventBus:
    """Simple in-process pub/sub for WebSocket broadcasting."""

    MAX_HISTORY = 200

    def __init__(self) -> None:
        self._subscribers: List[asyncio.Queue] = []
        self._history: Deque[Dict] = deque(maxlen=self.MAX_HISTORY)

    def subscribe(self) -> asyncio.Queue:
        q: asyncio.Queue = asyncio.Queue(maxsize=50)
        self._subscribers.append(q)
        return q

    def unsubscribe(self, q: asyncio.Queue) -> None:
        try:
            self._subscribers.remove(q)
        except ValueError:
            pass

    async def publish(self, event: Dict[str, Any]) -> None:
        event.setdefault("ts", time.time())
        self._history.append(event)
        dead = []
        for q in self._subscribers:
            try:
                q.put_nowait(event)
            except asyncio.QueueFull:
                dead.append(q)
        for q in dead:
            self.unsubscribe(q)

    def history(self, n: int = 50) -> List[Dict]:
        items = list(self._history)
        return items[-n:]


class AgentRegistry:
    """Single source of truth for all agent states."""

    def __init__(self) -> None:
        self._agents: Dict[str, AgentState] = {}
        self.bus = EventBus()

    def register(self, state: AgentState) -> None:
        self._agents[state.name] = state

    def get(self, name: str) -> Optional[AgentState]:
        return self._agents.get(name)

    def all(self) -> List[AgentState]:
        return list(self._agents.values())

    async def update_status(
        self,
        name: str,
        status: AgentStatus,
        task_queue: int = 0,
        error: Optional[str] = None,
    ) -> None:
        agent = self._agents.get(name)
        if not agent:
            return
        agent.status = status
        agent.task_queue = task_queue
        agent.last_seen = time.time()
        if error:
            agent.last_error = error
        await self.bus.publish(
            {
                "type": "status",
                "agent": name,
                "status": status,
                "task_queue": task_queue,
                **({"error": error} if error else {}),
            }
        )

    async def record_call(
        self, name: str, latency_ms: float, tokens: int = 0, error: bool = False
    ) -> None:
        agent = self._agents.get(name)
        if not agent:
            return
        agent.metrics.record(latency_ms, tokens, error)
        await self.bus.publish(
            {
                "type": "call",
                "agent": name,
                "latency_ms": latency_ms,
                "tokens": tokens,
                "error": error,
            }
        )

    def summary(self) -> Dict[str, Any]:
        agents = self.all()
        total_calls  = sum(a.metrics.calls for a in agents)
        total_errors = sum(a.metrics.errors for a in agents)
        active       = sum(1 for a in agents if a.status == "active")
        return {
            "total_agents":  len(agents),
            "active_agents": active,
            "total_calls":   total_calls,
            "total_errors":  total_errors,
            "agents":        [a.to_dict() for a in agents],
        }


# ── Singleton ──────────────────────────────────────────────────────────────────
registry = AgentRegistry()

# Pre-register all 10 O LIFE swarm agents
_AGENTS = [
    ("savings",    8000, "M1", "Subscription scanning, bill negotiation, budget forecasting"),
    ("health",     8080, "M5", "Biometrics, supplement stacks, longevity protocols"),
    ("dating",     8090, "M4", "Profile audits, opener generation, conversation coaching"),
    ("quantum",    8095, "M6", "Decision trees, scenario simulation, Bayesian analysis"),
    ("prediction", 8101, "M6", "Market forecasting, Kelly criterion, edge detection"),
    ("concierge",  8110, "M2", "Travel planning, restaurant research, task automation"),
    ("comms",      8120, "M2", "Learning paths, skill synthesis, accelerated curricula"),
    ("trading",    8130, "M1", "Technical analysis, portfolio optimisation, risk sizing"),
    ("booking",    8140, "M2", "Flight/hotel research, points optimisation, upgrades"),
    ("delivery",   8150, "M2", "Product sourcing, price comparison, supplier research"),
]

for _name, _port, _mission, _desc in _AGENTS:
    registry.register(
        AgentState(name=_name, port=_port, mission=_mission, description=_desc)
    )
