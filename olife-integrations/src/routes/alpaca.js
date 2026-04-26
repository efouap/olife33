// src/routes/alpaca.js
import { Router } from 'express';
import axios from 'axios';

const router = Router();

const BASE    = process.env.ALPACA_BASE_URL || 'https://paper-api.alpaca.markets';
const DATA    = 'https://data.alpaca.markets';
const HEADERS = {
  'APCA-API-KEY-ID':     process.env.ALPACA_API_KEY,
  'APCA-API-SECRET-KEY': process.env.ALPACA_SECRET_KEY || '',
};

async function alpaca(path, base = BASE) {
  const res = await axios.get(`${base}${path}`, { headers: HEADERS, timeout: 15000 });
  return res.data;
}

// ── GET /alpaca/account ────────────────────────────────────────────────────
router.get('/account', async (req, res) => {
  try {
    const data = await alpaca('/v2/account');
    res.json({
      id:               data.id,
      status:           data.status,
      equity:           +data.equity,
      cash:             +data.cash,
      portfolio_value:  +data.portfolio_value,
      buying_power:     +data.buying_power,
      pnl_today:        +(data.equity - data.last_equity),
      pnl_pct:          +((data.equity - data.last_equity) / data.last_equity * 100).toFixed(3),
      day_trade_count:  data.daytrade_count,
    });
  } catch (err) {
    res.status(500).json({ error: err.response?.data?.message || err.message });
  }
});

// ── GET /alpaca/positions ──────────────────────────────────────────────────
router.get('/positions', async (req, res) => {
  try {
    const data = await alpaca('/v2/positions');
    const positions = data.map(p => ({
      symbol:       p.symbol,
      qty:          +p.qty,
      side:         p.side,
      avg_price:    +p.avg_entry_price,
      current_price:+p.current_price,
      market_value: +p.market_value,
      unrealized_pl:+p.unrealized_pl,
      unrealized_plpc: +(p.unrealized_plpc * 100).toFixed(2),
      change_today: +(p.change_today * 100).toFixed(2),
    }));
    const total_value = positions.reduce((s, p) => s + p.market_value, 0);
    const total_pnl   = positions.reduce((s, p) => s + p.unrealized_pl, 0);
    res.json({ positions, total_value, total_pnl });
  } catch (err) {
    res.status(500).json({ error: err.response?.data?.message || err.message });
  }
});

// ── GET /alpaca/orders ─────────────────────────────────────────────────────
router.get('/orders', async (req, res) => {
  try {
    const { status = 'all', limit = 20 } = req.query;
    const data = await alpaca(`/v2/orders?status=${status}&limit=${limit}&direction=desc`);
    const orders = data.map(o => ({
      id:          o.id,
      symbol:      o.symbol,
      qty:         o.qty,
      side:        o.side,
      type:        o.type,
      status:      o.status,
      filled_qty:  o.filled_qty,
      filled_price:o.filled_avg_price,
      submitted_at:o.submitted_at,
      filled_at:   o.filled_at,
    }));
    res.json({ orders });
  } catch (err) {
    res.status(500).json({ error: err.response?.data?.message || err.message });
  }
});

// ── POST /alpaca/order ─────────────────────────────────────────────────────
router.post('/order', async (req, res) => {
  try {
    const { symbol, qty, side, type = 'market', time_in_force = 'day' } = req.body;
    if (!symbol || !qty || !side) return res.status(400).json({ error: 'symbol, qty, side required' });

    const result = await axios.post(`${BASE}/v2/orders`, {
      symbol, qty: String(qty), side, type, time_in_force,
    }, { headers: HEADERS, timeout: 10000 });

    res.json(result.data);
  } catch (err) {
    res.status(500).json({ error: err.response?.data?.message || err.message });
  }
});

// ── GET /alpaca/bars ───────────────────────────────────────────────────────
router.get('/bars/:symbol', async (req, res) => {
  try {
    const { symbol } = req.params;
    const { timeframe = '1Day', limit = 30 } = req.query;
    const data = await alpaca(
      `/v2/stocks/${symbol}/bars?timeframe=${timeframe}&limit=${limit}&sort=desc`,
      DATA
    );
    const bars = (data.bars || []).map(b => ({
      t: b.t, o: b.o, h: b.h, l: b.l, c: b.c, v: b.v,
    }));
    res.json({ symbol, bars });
  } catch (err) {
    res.status(500).json({ error: err.response?.data?.message || err.message });
  }
});

// ── GET /alpaca/clock ──────────────────────────────────────────────────────
router.get('/clock', async (req, res) => {
  try {
    const data = await alpaca('/v2/clock');
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.response?.data?.message || err.message });
  }
});

export default router;
