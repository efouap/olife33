'use strict';

const express = require('express');
const cors    = require('cors');
const morgan  = require('morgan');
const { v4: uuidv4 } = require('uuid');
const axios   = require('axios');

const AI_BRIDGE = process.env.AI_BRIDGE_URL || 'http://ai-bridge:3000';

/**
 * Creates a self-contained Express app for an O LIFE swarm agency.
 *
 * Each agency exposes:
 *   GET  /health      — liveness
 *   POST /run         — main task execution
 *   GET  /history     — last 50 task results (from Redis)
 *
 * @param {string}   name     Agency name (e.g. 'savings')
 * @param {object}   handler  { describe(), run(payload, ctx) }
 * @param {object}   redis    Connected ioredis/redis client
 */
function createAgency(name, handler, redis) {
  const app = express();
  app.use(cors({ origin: '*' }));
  app.use(express.json({ limit: '2mb' }));
  app.use(morgan('tiny'));

  // ── Context helpers available to all handlers ───────────────────────────
  const ctx = {
    redis,
    /** Ask AI Bridge for a single-provider response */
    async ai(messages, opts = {}) {
      const res = await axios.post(`${AI_BRIDGE}/chat`, {
        messages,
        ...opts,
      }, { timeout: 45_000 });
      return res.data.content;
    },
    /** Broadcast an event to all connected WS clients via Redis pub/sub */
    async emit(event, data) {
      try {
        await redis.publish('olife:events', JSON.stringify({ agency: name, event, data, ts: Date.now() }));
      } catch (_) {}
    },
    /** Store a result in Redis list (keep last 50) */
    async store(key, value) {
      const full = `agency:${name}:${key}`;
      await redis.lPush(full, JSON.stringify({ value, ts: Date.now() }));
      await redis.lTrim(full, 0, 49);
    },
    /** Retrieve stored results */
    async retrieve(key, count = 10) {
      const full = `agency:${name}:${key}`;
      const raw  = await redis.lRange(full, 0, count - 1);
      return raw.map((r) => JSON.parse(r));
    },
  };

  // ── Health ─────────────────────────────────────────────────────────────
  app.get('/health', (req, res) => {
    res.json({ agency: name, status: 'ok', ts: Date.now(), ...handler.describe() });
  });

  // ── Run task ───────────────────────────────────────────────────────────
  app.post('/run', async (req, res) => {
    const runId = uuidv4();
    const start = Date.now();

    try {
      const result = await handler.run(req.body, ctx);
      const record = { runId, agency: name, result, latency_ms: Date.now() - start, ts: Date.now() };
      await ctx.store('results', record).catch(() => {});
      await ctx.emit('task_complete', record);
      res.json(record);
    } catch (err) {
      const record = { runId, agency: name, error: err.message, latency_ms: Date.now() - start, ts: Date.now() };
      await ctx.emit('task_error', record);
      res.status(500).json(record);
    }
  });

  // ── History ────────────────────────────────────────────────────────────
  app.get('/history', async (req, res) => {
    const limit = Math.min(parseInt(req.query.limit) || 20, 50);
    const items = await ctx.retrieve('results', limit).catch(() => []);
    res.json({ agency: name, items });
  });

  return app;
}

module.exports = createAgency;
