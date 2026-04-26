# O LIFE — Companion Tools

Standalone HTML dashboards. Open directly in any browser — no build step required.

| File | Purpose | Connects To |
|------|---------|-------------|
| `agency-status.html` | Live health monitor — polls all 10 swarm agency ports, shows latency history | `olife-backend` agencies `:8000–:8150` |
| `mission-runner.html` | Mission Runner — Subscription Graveyard task UI | AI Bridge `:3000` |
| `mission-runner-live.html` | Mission Runner with live IndexedDB persistence | AI Bridge `:3000` + IndexedDB |
| `olife-db-dashboard.html` | Supabase DB Admin — browse tables, view transactions | Supabase URL + anon key |
| `olife-sync.html` | Sync Control Plane — Supabase ↔ local Dexie sync | Supabase + Dexie (IndexedDB) |

## Usage

All tools are self-contained. Open them with:

```bash
# Any local server works
npx serve .
# or just open the file directly in Chrome/Firefox
```

Each tool reads its backend URL from a UI input or `localStorage`. Set your
AI Bridge URL once and it persists across sessions:

```javascript
localStorage.setItem('olife_api_bridge', 'http://localhost:3000');
```
