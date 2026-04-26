-- ============================================================
-- O LIFE Supreme Intelligence OS — Database Schema
-- ============================================================

-- Enable extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- ── Users & Identity ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  device_id     TEXT UNIQUE NOT NULL,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  last_seen_at  TIMESTAMPTZ DEFAULT NOW(),
  identity_json JSONB DEFAULT '{}'
);

-- ── Mission State ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS mission_states (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID REFERENCES users(id) ON DELETE CASCADE,
  mission     TEXT NOT NULL CHECK (mission IN ('M1','M2','M3','M4','M5','M6')),
  state_json  JSONB DEFAULT '{}',
  score       NUMERIC(5,2) DEFAULT 0,
  updated_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, mission)
);

-- ── Mission Log ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS mission_log (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id    UUID REFERENCES users(id) ON DELETE CASCADE,
  mission    TEXT NOT NULL,
  insight    TEXT NOT NULL,
  tags       TEXT[] DEFAULT '{}',
  ts         TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_mission_log_user ON mission_log(user_id);
CREATE INDEX idx_mission_log_ts   ON mission_log(ts DESC);

-- ── Agency Results ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS agency_results (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID REFERENCES users(id) ON DELETE CASCADE,
  agency      TEXT NOT NULL,
  task        TEXT NOT NULL,
  payload     JSONB DEFAULT '{}',
  result      JSONB DEFAULT '{}',
  latency_ms  INTEGER,
  ts          TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_agency_results_user   ON agency_results(user_id);
CREATE INDEX idx_agency_results_agency ON agency_results(agency, ts DESC);

-- ── AI Conversations ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS conversations (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID REFERENCES users(id) ON DELETE CASCADE,
  title       TEXT,
  messages    JSONB DEFAULT '[]',
  provider    TEXT,
  mission     TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_conv_user ON conversations(user_id, updated_at DESC);

-- ── Knowledge / Wisdom Store ──────────────────────────────────
CREATE TABLE IF NOT EXISTS wisdom_store (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id    UUID REFERENCES users(id) ON DELETE CASCADE,
  text       TEXT NOT NULL,
  source     TEXT,
  rating     NUMERIC(3,2) DEFAULT 0.5,
  weight     NUMERIC(5,4) DEFAULT 1.0,
  ts         TIMESTAMPTZ DEFAULT NOW()
);

-- ── Subscriptions (M1) ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS subscriptions (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID REFERENCES users(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  amount          NUMERIC(10,2) NOT NULL,
  frequency       TEXT DEFAULT 'monthly',
  category        TEXT,
  status          TEXT DEFAULT 'active',
  cancel_priority INTEGER DEFAULT 0,
  detected_at     TIMESTAMPTZ DEFAULT NOW()
);

-- ── Biometrics (M5) ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS biometrics (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id    UUID REFERENCES users(id) ON DELETE CASCADE,
  type       TEXT NOT NULL,
  value      NUMERIC,
  unit       TEXT,
  source     TEXT DEFAULT 'manual',
  ts         TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_biometrics_user ON biometrics(user_id, type, ts DESC);

-- ── Prediction Bets ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS predictions (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID REFERENCES users(id) ON DELETE CASCADE,
  question        TEXT NOT NULL,
  your_probability NUMERIC(5,2),
  market_probability NUMERIC(5,2),
  resolution_date DATE,
  outcome         TEXT,
  resolved_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ── Provider Health Log ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS provider_health (
  id           SERIAL PRIMARY KEY,
  provider     TEXT NOT NULL,
  status       TEXT NOT NULL,
  latency_ms   INTEGER,
  error        TEXT,
  ts           TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_provider_health_ts ON provider_health(provider, ts DESC);

-- ── Materialized view: user dashboard summary ─────────────────
CREATE OR REPLACE VIEW user_dashboard AS
SELECT
  u.id,
  u.device_id,
  u.last_seen_at,
  COUNT(DISTINCT ml.id)   AS total_insights,
  COUNT(DISTINCT ar.id)   AS total_agency_runs,
  COUNT(DISTINCT c.id)    AS total_conversations,
  COALESCE(SUM(s.amount), 0) AS monthly_subscriptions
FROM users u
LEFT JOIN mission_log    ml ON ml.user_id = u.id
LEFT JOIN agency_results ar ON ar.user_id = u.id
LEFT JOIN conversations  c  ON c.user_id  = u.id
LEFT JOIN subscriptions  s  ON s.user_id  = u.id AND s.status = 'active'
GROUP BY u.id;
