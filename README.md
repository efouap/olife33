# O LIFE Supreme Intelligence OS

> **One file. Supreme intelligence. All missions.**

O LIFE is an AI-powered personal operating system — a self-contained HTML app that
orchestrates 17 AI providers, 10 swarm agencies, and 63+ feature modules across
6 Supreme Missions of human optimization.

**Live:** Deployed via Cloudflare Pages from GitHub. Push to `main` → auto-deploys in ~30s.

---

## OLIFE Token — On-Chain ✓

The OLIFE Token is deployed, verified, and live on Polygon Mainnet.

| Field | Value |
|-------|-------|
| **Contract Name** | OLIFEToken |
| **Network** | Polygon Mainnet (Chain ID: 137) |
| **Contract Address** | `0x14692FAB14906C9c792C7a10A5bfC2F81691Ac5F` |
| **Deployer** | `0x52028Eb2dbD3654B756a7492C35A59975A98cAce` |
| **Verified** | 2026-04-25 05:59:30 UTC ✓ |
| **Polygonscan** | [View Contract](https://polygonscan.com/token/0x14692FAB14906C9c792C7a10A5bfC2F81691Ac5F) |

---

## File Stats

| Format | Size |
|--------|------|
| Raw HTML | ~8MB (343 script blocks, 47 style blocks) |
| Gzipped | ~1.97MB (Cloudflare serves this automatically) |
| Brotli | ~1.41MB (Cloudflare Pages serves this automatically) |

---

## Repository Structure

```
olife33/
├── index.html              ← MAIN APP (O LIFE Beta 2.33 — deploy this)
├── dist/index.html         ← Production build (fonts fixed, bugs patched)
├── _headers                ← Cloudflare Pages security headers
├── _redirects              ← Cloudflare Pages SPA routing
├── olife-deploy-guide.md   ← Full Cloudflare deployment guide
├── olife-supreme.html      ← O LIFE Supreme Security OS companion
├── build.js                ← Build pipeline (npm run build)
│
├── tools/                  ← Companion dashboards (open in browser)
│   ├── agency-status.html
│   ├── mission-runner.html
│   ├── mission-runner-live.html
│   ├── olife-db-dashboard.html
│   └── olife-sync.html
│
├── olife-backend/          ← AI Bridge + 10 swarm agencies (Docker)
├── swarm-agencies/         ← Python FastAPI swarm runtime
├── olife-integrations/     ← Plaid / Gmail / Alpaca / NewsAPI bridge
├── olife-db/               ← Migrations + DAL
└── olife-sync/             ← Supabase ↔ local sync engine
```

---

## The 6 Supreme Missions

| # | Mission | Focus |
|---|---------|-------|
| M1 | **Wealth** | Markets, savings, trading |
| M2 | **Efficiency** | Lifestyle, travel, procurement |
| M3 | **Intelligence** | OmniParallel AI broadcast (17 providers) |
| M4 | **Connection** | Dating & relationships |
| M5 | **Wellbeing** | Health & longevity |
| M6 | **Truth** | Prediction & decision science |

---

## Deployment (Cloudflare Pages)

Push to `main` branch → Cloudflare Pages auto-deploys. See `olife-deploy-guide.md` for full setup.

**Settings:**
- Build command: *(none — static file)*
- Output directory: `/` (root)
- Branch: `main`

---

## ⚠️ Security Note

Hardcoded API keys in the `_olife_autokeys_v1` script are written to localStorage
at runtime. These are semi-public. Rotate any sensitive keys:

| Key | Where |
|-----|-------|
| Turso token | turso.tech → your DB → Tokens |
| Cloudflare R2 token | Cloudflare dashboard → API Tokens |
| Resend API key | resend.com → API Keys |
| Finnhub key | finnhub.io → API |

---

## Backend Quick Start

```bash
cd olife-backend
cp .env.template .env   # add your API keys
docker-compose up --build
```

---

## Contributing

1. Fork → feature branch → PR
2. Never commit `.env` files — use `.env.template` only
3. Run `npm run build` after editing `index.html` to update `dist/`

---

## License

MIT — build your supreme life.
