// src/routes/gmail.js
// Gmail OAuth2 flow:
//   GET  /gmail/auth        → redirect URL for user consent
//   GET  /gmail/callback    → exchanges code → tokens, stores in memory
//   GET  /gmail/messages    → fetches financial emails (receipts, bank alerts)
//   GET  /gmail/subscriptions → AI-assisted subscription extraction from email body

import { Router } from 'express';
import axios from 'axios';

const router = Router();

const CLIENT_ID     = process.env.GMAIL_CLIENT_ID;
const CLIENT_SECRET = process.env.GMAIL_CLIENT_SECRET || '';
const REDIRECT_URI  = process.env.GMAIL_REDIRECT_URI || 'http://localhost:3001/gmail/callback';
const SCOPES        = [
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/userinfo.email',
].join(' ');

// In-memory token store (use encrypted DB in production)
const tokenStore = new Map();

// ── GET /gmail/auth ────────────────────────────────────────────────────────
router.get('/auth', (req, res) => {
  const { user_id = 'olife-user-001' } = req.query;

  const params = new URLSearchParams({
    client_id:     CLIENT_ID,
    redirect_uri:  REDIRECT_URI,
    response_type: 'code',
    scope:         SCOPES,
    access_type:   'offline',
    prompt:        'consent',
    state:         user_id,
  });

  res.json({ auth_url: `https://accounts.google.com/o/oauth2/v2/auth?${params}` });
});

// ── GET /gmail/callback ────────────────────────────────────────────────────
router.get('/callback', async (req, res) => {
  const { code, state: user_id = 'olife-user-001', error } = req.query;
  if (error) return res.status(400).json({ error });
  if (!code) return res.status(400).json({ error: 'No code in callback' });

  try {
    const { data } = await axios.post('https://oauth2.googleapis.com/token', {
      code,
      client_id:     CLIENT_ID,
      client_secret: CLIENT_SECRET,
      redirect_uri:  REDIRECT_URI,
      grant_type:    'authorization_code',
    });

    tokenStore.set(user_id, {
      access_token:  data.access_token,
      refresh_token: data.refresh_token,
      expires_at:    Date.now() + data.expires_in * 1000,
    });

    res.json({ success: true, user_id, scope: data.scope });
  } catch (err) {
    res.status(500).json({ error: err.response?.data?.error_description || err.message });
  }
});

// ── Token refresh ──────────────────────────────────────────────────────────
async function getValidToken(user_id) {
  const stored = tokenStore.get(user_id);
  if (!stored) throw new Error('No Gmail tokens. Complete OAuth flow first.');

  if (Date.now() < stored.expires_at - 60000) return stored.access_token;

  // Refresh
  const { data } = await axios.post('https://oauth2.googleapis.com/token', {
    refresh_token: stored.refresh_token,
    client_id:     CLIENT_ID,
    client_secret: CLIENT_SECRET,
    grant_type:    'refresh_token',
  });

  tokenStore.set(user_id, {
    ...stored,
    access_token: data.access_token,
    expires_at:   Date.now() + data.expires_in * 1000,
  });

  return data.access_token;
}

// ── GET /gmail/messages ────────────────────────────────────────────────────
// Fetches financial emails: receipts, bank alerts, subscription invoices
router.get('/messages', async (req, res) => {
  try {
    const { user_id = 'olife-user-001', max = 20 } = req.query;
    const token = await getValidToken(user_id);

    // Query for financial emails
    const query = [
      'subject:(receipt OR invoice OR "payment confirmation" OR "subscription" OR "bank" OR "charged" OR "billing")',
      'newer_than:90d',
    ].join(' ');

    // List message IDs
    const listRes = await axios.get('https://gmail.googleapis.com/gmail/v1/users/me/messages', {
      headers: { Authorization: `Bearer ${token}` },
      params:  { q: query, maxResults: max },
    });

    const ids = (listRes.data.messages || []).map(m => m.id);
    if (!ids.length) return res.json({ messages: [], count: 0 });

    // Fetch each message (subject + snippet + from)
    const messages = await Promise.all(ids.map(async id => {
      const msgRes = await axios.get(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}`,
        {
          headers: { Authorization: `Bearer ${token}` },
          params:  { format: 'metadata', metadataHeaders: ['Subject', 'From', 'Date'] },
        }
      );
      const hdrs    = msgRes.data.payload.headers;
      const get     = name => hdrs.find(h => h.name === name)?.value ?? '';
      return {
        id,
        subject:  get('Subject'),
        from:     get('From'),
        date:     get('Date'),
        snippet:  msgRes.data.snippet,
      };
    }));

    res.json({ messages, count: messages.length });
  } catch (err) {
    res.status(err.message.includes('OAuth') ? 401 : 500).json({ error: err.message });
  }
});

// ── GET /gmail/subscriptions ───────────────────────────────────────────────
// Extracts subscription charges from email snippets
router.get('/subscriptions', async (req, res) => {
  try {
    const { user_id = 'olife-user-001' } = req.query;
    const token = await getValidToken(user_id);

    const query = 'subject:(subscription OR "your plan" OR "monthly" OR "annual" OR "renewal") newer_than:180d';
    const listRes = await axios.get('https://gmail.googleapis.com/gmail/v1/users/me/messages', {
      headers: { Authorization: `Bearer ${token}` },
      params:  { q: query, maxResults: 30 },
    });

    const ids = (listRes.data.messages || []).map(m => m.id);
    if (!ids.length) return res.json({ subscriptions: [], raw_count: 0 });

    const snippets = await Promise.all(ids.map(async id => {
      const r = await axios.get(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}`,
        {
          headers: { Authorization: `Bearer ${token}` },
          params:  { format: 'metadata', metadataHeaders: ['Subject', 'From'] },
        }
      );
      const hdrs = r.data.payload.headers;
      const get  = n => hdrs.find(h => h.name === n)?.value ?? '';
      return `From: ${get('From')} | Subject: ${get('Subject')} | ${r.data.snippet}`;
    }));

    // Extract amounts using regex patterns — no AI call needed
    const subscriptions = extractSubscriptionData(snippets);
    res.json({ subscriptions, raw_count: ids.length });
  } catch (err) {
    res.status(err.message.includes('OAuth') ? 401 : 500).json({ error: err.message });
  }
});

function extractSubscriptionData(snippets) {
  const results = [];
  const seen    = new Set();

  const amtPattern = /\$[\d,]+\.?\d{0,2}/g;
  const namePattern = /From:\s*([^|<\n]+?)(?:\s+<|\s+\|)/;

  snippets.forEach(s => {
    const nameMatch = s.match(namePattern);
    const amounts   = s.match(amtPattern) || [];
    if (!nameMatch || !amounts.length) return;

    const name = nameMatch[1].trim();
    const key  = name.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);

    const amount = parseFloat(amounts[0].replace(/[$,]/g, ''));
    if (!isNaN(amount) && amount > 0 && amount < 5000) {
      results.push({ name, amount, annual_estimate: +(amount * 12).toFixed(2), source: 'gmail' });
    }
  });

  return results.sort((a, b) => b.amount - a.amount);
}

export default router;
