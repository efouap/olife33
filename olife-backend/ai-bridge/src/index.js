'use strict';
require('dotenv').config();

const express    = require('express');
const cors       = require('cors');
const helmet     = require('helmet');
const morgan     = require('morgan');
const { createClient } = require('redis');
const rateLimit  = require('express-rate-limit');
const { v4: uuidv4 } = require('uuid');
const WebSocket  = require('ws');
const http       = require('http');

const providers  = require('./providers');
const router     = require('./router');

// ─── App ──────────────────────────────────────────────────────────────────────
const app    = express();
const server = http.createServer(app);

// ─── Redis ───────────────────────────────────────────────────────────────────
const redis = createClient({ url: process.env.REDIS_URL || 'redis://localhost:6379' });
redis.on('error', (err) => console.error('[Redis]', err.message));
redis.connect().then(() => console.log('[Redis] connected'));
app.locals.redis = redis;

// ─── Middleware ───────────────────────────────────────────────────────────────
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: '*' }));
app.use(express.json({ limit: '4mb' }));
app.use(morgan('tiny'));

// Global rate limit — 600 req/min per IP
app.use(rateLimit({
  windowMs: 60_000,
  max: 600,
  standardHeaders: true,
  legacyHeaders: false,
}));

// ─── Health ───────────────────────────────────────────────────────────────────
app.get('/health', async (req, res) => {
  const redisOk = redis.isReady;
  res.json({
    status: 'ok',
    ts: Date.now(),
    redis: redisOk ? 'up' : 'down',
    providers: providers.list(),
  });
});

// ─── Provider catalogue ───────────────────────────────────────────────────────
app.get('/providers', (req, res) => {
  res.json({ providers: providers.list() });
});

// ─── OmniParallel broadcast ───────────────────────────────────────────────────
// POST /omni  { messages, providers?, max_tokens?, temperature? }
// Fans out to all (or selected) providers in parallel and streams results back
// via NDJSON.
app.post('/omni', async (req, res) => {
  const { messages, providers: selected, max_tokens = 1024, temperature = 0.7 } = req.body;
  if (!messages?.length) return res.status(400).json({ error: 'messages required' });

  const targets = selected?.length ? providers.subset(selected) : providers.all();
  if (!targets.length) return res.status(503).json({ error: 'no providers available' });

  res.setHeader('Content-Type', 'application/x-ndjson');
  res.setHeader('Transfer-Encoding', 'chunked');

  const broadcastId = uuidv4();
  const start = Date.now();

  // Fire all providers concurrently; write each result as it arrives
  const tasks = targets.map(async (p) => {
    const taskStart = Date.now();
    try {
      const result = await p.chat(messages, { max_tokens, temperature });
      const line = JSON.stringify({
        id: broadcastId,
        provider: p.id,
        model: p.model,
        content: result,
        latency_ms: Date.now() - taskStart,
        ts: Date.now(),
      });
      res.write(line + '\n');

      // Cache individual result for 5 min
      const cacheKey = `omni:${p.id}:${hashMessages(messages)}`;
      await redis.setEx(cacheKey, 300, result).catch(() => {});
    } catch (err) {
      const line = JSON.stringify({
        id: broadcastId,
        provider: p.id,
        error: err.message,
        latency_ms: Date.now() - taskStart,
        ts: Date.now(),
      });
      res.write(line + '\n');
    }
  });

  await Promise.allSettled(tasks);

  // Final summary line
  res.write(JSON.stringify({
    id: broadcastId,
    type: 'done',
    total_ms: Date.now() - start,
    providers_hit: targets.length,
  }) + '\n');
  res.end();
});

// ─── Single provider chat ─────────────────────────────────────────────────────
// POST /chat  { provider, messages, max_tokens?, temperature?, cache? }
app.post('/chat', async (req, res) => {
  const { provider: pid, messages, max_tokens = 1024, temperature = 0.7, cache = true } = req.body;
  if (!messages?.length) return res.status(400).json({ error: 'messages required' });

  const p = providers.get(pid);
  if (!p) return res.status(404).json({ error: `provider '${pid}' not found` });

  // Cache check
  if (cache) {
    const cacheKey = `chat:${pid}:${hashMessages(messages)}`;
    const cached = await redis.get(cacheKey).catch(() => null);
    if (cached) return res.json({ provider: pid, model: p.model, content: cached, cached: true });
  }

  try {
    const result = await p.chat(messages, { max_tokens, temperature });
    if (cache) {
      const cacheKey = `chat:${pid}:${hashMessages(messages)}`;
      await redis.setEx(cacheKey, 300, result).catch(() => {});
    }
    res.json({ provider: pid, model: p.model, content: result, cached: false });
  } catch (err) {
    res.status(502).json({ provider: pid, error: err.message });
  }
});

// ─── Agency relay ─────────────────────────────────────────────────────────────
// POST /agency/:name  — proxied internally by swarm services
app.use('/agency', router);

// ─── Mission context store ─────────────────────────────────────────────────────
app.post('/mission/log', async (req, res) => {
  const { mission, insight, ts } = req.body;
  if (!mission || !insight) return res.status(400).json({ error: 'mission + insight required' });
  const entry = { mission, insight, ts: ts || Date.now() };
  await redis.lPush('mission:log', JSON.stringify(entry));
  await redis.lTrim('mission:log', 0, 499);        // keep 500
  res.json({ ok: true });
});

app.get('/mission/log', async (req, res) => {
  const raw = await redis.lRange('mission:log', 0, 99);
  res.json({ entries: raw.map((r) => JSON.parse(r)) });
});

// ─── WebSocket hub for real-time events ──────────────────────────────────────
const wss = new WebSocket.Server({ server });
const clients = new Set();

wss.on('connection', (ws) => {
  clients.add(ws);
  ws.send(JSON.stringify({ type: 'connected', ts: Date.now() }));
  ws.on('close', () => clients.delete(ws));
});

// Expose broadcast to other modules
app.locals.broadcast = (event) => {
  const msg = JSON.stringify(event);
  clients.forEach((ws) => {
    if (ws.readyState === WebSocket.OPEN) ws.send(msg);
  });
};

// ─── Redis pub/sub — forward agency events to WS clients ─────────────────────
(async () => {
  const sub = redis.duplicate();
  await sub.connect();
  await sub.subscribe('olife:events', (msg) => {
    try {
      const event = JSON.parse(msg);
      app.locals.broadcast(event);
    } catch (_) {}
  });
})();

// ─── Helpers ──────────────────────────────────────────────────────────────────
function hashMessages(messages) {
  const str = JSON.stringify(messages);
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (Math.imul(31, h) + str.charCodeAt(i)) >>> 0;
  }
  return h.toString(16);
}

// ─── Boot ─────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`[AI Bridge] listening on :${PORT}`);
  console.log(`[AI Bridge] providers: ${providers.list().join(', ')}`);
});
