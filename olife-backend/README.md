# O LIFE Supreme Intelligence OS — Backend

Full-stack backend for the O LIFE Supreme Intelligence OS single-file HTML app.

## Architecture

```
Browser (index-7.html)
        │
        ▼
  ┌─────────────────────────────────────────────────┐
  │          AI Bridge  :3000                        │
  │  • OmniParallel broadcast (all providers)        │
  │  • Single-provider /chat with Redis cache        │
  │  • WebSocket hub for real-time events            │
  │  • Agency relay proxy                            │
  │  • Mission log API                               │
  └───────────┬──────────────────────┬──────────────┘
              │                      │
        ┌─────▼─────┐         ┌──────▼──────┐
        │   Redis   │         │  Supabase   │
        │  :6379    │         │  Postgres   │
        │ • Cache   │         │  :5432      │
        │ • Pub/sub │         │ • Users     │
        │ • Mission │         │ • Missions  │
        │   log     │         │ • History   │
        └───────────┘         └─────────────┘
              │
  ┌───────────▼───────────────────────────────────┐
  │          Swarm Agencies                        │
  │                                               │
  │  :8000  Savings     — M1 Wealth               │
  │  :8080  Health      — M5 Wellbeing            │
  │  :8090  Dating      — M4 Connection           │
  │  :8095  Quantum     — M6 Decision AI          │
  │  :8101  Prediction  — M6 Forecast             │
  │  :8110  Concierge   — M2 Lifestyle            │
  │  :8120  Comms/Edu   — M2 Learning             │
  │  :8130  Trading     — M1 Markets              │
  │  :8140  Booking     — M2 Travel               │
  │  :8150  Delivery    — M2 Procurement          │
  └───────────────────────────────────────────────┘
```

## Quick Start

### 1. Configure environment
```bash
cp .env.template .env
# Edit .env — add at least one AI provider API key
```

### 2. Launch
```bash
docker-compose up --build
```

### 3. Verify
```bash
curl http://localhost:3000/health        # AI Bridge
curl http://localhost:8000/health        # Savings Agency
curl http://localhost:8080/health        # Health Agency
```

## API Reference

### AI Bridge `:3000`

| Method | Path | Description |
|--------|------|-------------|
| GET  | `/health` | Status + active providers |
| GET  | `/providers` | List available AI providers |
| POST | `/omni` | OmniParallel broadcast (NDJSON stream) |
| POST | `/chat` | Single provider chat with caching |
| POST | `/agency/:name` | Relay to swarm agency |
| GET  | `/agency/:name/status` | Agency health check |
| POST | `/mission/log` | Store mission insight |
| GET  | `/mission/log` | Retrieve mission log |

### OmniParallel Broadcast
```json
POST /omni
{
  "messages": [{"role": "user", "content": "What is the best investment right now?"}],
  "providers": ["openai", "anthropic", "groq"],
  "max_tokens": 1024
}
```
Returns NDJSON stream — one line per provider as they respond.

### Agency Task
```json
POST /agency/savings
{
  "task": "subscription_scan",
  "data": {
    "transactions": [...],
    "monthly_income": 5000
  }
}
```

## Agency Tasks

### Savings `:8000`
- `subscription_scan` — detect recurring charges, recommend cancellations
- `bill_negotiation` — generate negotiation scripts
- `savings_analysis` — 90-day savings acceleration plan
- `budget_forecast` — multi-month spending forecast

### Health `:8080`
- `biometric_analysis` — score and optimize health metrics
- `supplement_stack` — evidence-based stack with dosages
- `sleep_optimization` — 30-day sleep protocol
- `longevity_protocol` — Bryan Johnson / Peter Attia inspired plan
- `workout_plan` — 12-week periodized program

### Dating `:8090`
- `profile_audit` — score and rewrite dating profile
- `opener_generation` — personalized conversation openers
- `conversation_coach` — next-message recommendations
- `date_planning` — 3 unique date experiences
- `attraction_analysis` — interest level analysis

### Quantum `:8095`
- `decision_tree` — probabilistic decision analysis
- `scenario_simulation` — future scenario modeling
- `probability_analysis` — Bayesian reasoning
- `risk_matrix` — comprehensive risk scoring
- `second_order_effects` — cascade effect mapping

### Prediction `:8101`
- `market_prediction` — prediction market analysis
- `sports_forecast` — statistical sports modeling
- `event_probability` — superforecaster methodology
- `kelly_criterion` — optimal bet sizing
- `edge_finder` — market edge detection

### Concierge `:8110`
- `travel_plan` — complete itinerary with insider tips
- `restaurant_research` — reservation strategy
- `task_automation` — workflow blueprints
- `vendor_research` — B2B supplier mapping
- `event_access` — VIP access paths

### Comms/Edu `:8120`
- `learning_path` — 12-week skill roadmap
- `skill_synthesis` — skill intersection analysis
- `explain_concept` — Feynman-method explanation
- `knowledge_audit` — gap analysis + remediation
- `accelerated_curriculum` — 80/20 crash course

### Trading `:8130`
- `technical_analysis` — chart and indicator analysis
- `portfolio_optimizer` — MPT-based optimization
- `sentiment_analysis` — multi-source sentiment scoring
- `options_strategy` — defined-risk strategy design
- `risk_sizing` — Kelly-based position sizing

### Booking `:8140`
- `flight_research` — route and timing optimization
- `hotel_research` — rate and upgrade strategy
- `points_optimizer` — loyalty program maximization
- `booking_timing` — optimal booking windows
- `upgrade_strategy` — complimentary upgrade tactics

### Delivery `:8150`
- `product_sourcing` — best products at best prices
- `price_comparison` — cross-channel price intelligence
- `delivery_optimization` — logistics + carrier selection
- `supplier_research` — B2B procurement mapping
- `bulk_negotiation` — vendor negotiation scripts

## Connecting to the HTML App

Add to `index-7.html` or set in localStorage:
```javascript
localStorage.setItem('olife_api_bridge', 'http://localhost:3000');
```

The frontend OmniParallel system will route broadcast calls through `/omni`
and agency calls through `/agency/:name`.
