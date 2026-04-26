// src/routes/plaid.js
import { Router } from 'express';
import {
  Configuration,
  PlaidApi,
  PlaidEnvironments,
  Products,
  CountryCode,
} from 'plaid';

const router = Router();

const config = new Configuration({
  basePath: PlaidEnvironments[process.env.PLAID_ENV || 'sandbox'],
  baseOptions: {
    headers: {
      'PLAID-CLIENT-ID': process.env.PLAID_CLIENT_ID,
      'PLAID-SECRET':    process.env.PLAID_SECRET,
    },
  },
});

const client = new PlaidApi(config);

// In-memory access token store (use DB in production)
const accessTokens = new Map();

// ── POST /plaid/link-token ─────────────────────────────────────────────────
// Creates a Plaid Link token to initialise the Link flow in the browser.
router.post('/link-token', async (req, res) => {
  try {
    const { user_id = 'olife-user-001' } = req.body;

    const response = await client.linkTokenCreate({
      user: { client_user_id: user_id },
      client_name: 'O LIFE Supreme Intelligence',
      products: [Products.Transactions, Products.Auth],
      country_codes: [CountryCode.Us],
      language: 'en',
    });

    res.json({ link_token: response.data.link_token });
  } catch (err) {
    const msg = err.response?.data?.error_message || err.message;
    res.status(500).json({ error: msg });
  }
});

// ── POST /plaid/exchange ───────────────────────────────────────────────────
// Exchanges a public_token (from Plaid Link) for an access_token.
router.post('/exchange', async (req, res) => {
  try {
    const { public_token, user_id = 'olife-user-001' } = req.body;
    if (!public_token) return res.status(400).json({ error: 'public_token required' });

    const response = await client.itemPublicTokenExchange({ public_token });
    const { access_token, item_id } = response.data;

    accessTokens.set(user_id, access_token);
    res.json({ item_id, success: true });
  } catch (err) {
    const msg = err.response?.data?.error_message || err.message;
    res.status(500).json({ error: msg });
  }
});

// ── GET /plaid/balances ────────────────────────────────────────────────────
router.get('/balances', async (req, res) => {
  try {
    const { user_id = 'olife-user-001' } = req.query;
    const access_token = accessTokens.get(user_id);
    if (!access_token) return res.status(401).json({ error: 'No linked account. Complete Plaid Link first.' });

    const response = await client.accountsBalanceGet({ access_token });
    const accounts = response.data.accounts.map(a => ({
      id:              a.account_id,
      name:            a.name,
      official_name:   a.official_name,
      type:            a.type,
      subtype:         a.subtype,
      balance_current: a.balances.current,
      balance_available: a.balances.available,
      iso_currency:    a.balances.iso_currency_code,
    }));

    res.json({ accounts });
  } catch (err) {
    const msg = err.response?.data?.error_message || err.message;
    res.status(500).json({ error: msg });
  }
});

// ── GET /plaid/transactions ────────────────────────────────────────────────
router.get('/transactions', async (req, res) => {
  try {
    const { user_id = 'olife-user-001', days = 30 } = req.query;
    const access_token = accessTokens.get(user_id);
    if (!access_token) return res.status(401).json({ error: 'No linked account.' });

    const end   = new Date().toISOString().split('T')[0];
    const start = new Date(Date.now() - days * 86400000).toISOString().split('T')[0];

    const response = await client.transactionsGet({
      access_token,
      start_date: start,
      end_date:   end,
      options: { count: 250, offset: 0 },
    });

    const transactions = response.data.transactions.map(t => ({
      id:          t.transaction_id,
      name:        t.name,
      amount:      t.amount,
      date:        t.date,
      category:    t.category?.[0] ?? 'Other',
      account_id:  t.account_id,
      pending:     t.pending,
      merchant:    t.merchant_name,
    }));

    // Detect recurring (subscription) charges
    const recurring = detectSubscriptions(transactions);

    res.json({
      total: transactions.length,
      transactions,
      recurring,
      total_spend: transactions.filter(t => t.amount > 0).reduce((s, t) => s + t.amount, 0),
    });
  } catch (err) {
    const msg = err.response?.data?.error_message || err.message;
    res.status(500).json({ error: msg });
  }
});

function detectSubscriptions(txns) {
  const byMerchant = {};
  txns.forEach(t => {
    const key = (t.merchant || t.name || '').toLowerCase().trim();
    if (!key) return;
    if (!byMerchant[key]) byMerchant[key] = [];
    byMerchant[key].push(t);
  });
  return Object.entries(byMerchant)
    .filter(([, ts]) => ts.length >= 2)
    .map(([merchant, ts]) => ({
      merchant,
      occurrences:  ts.length,
      avg_amount:   +(ts.reduce((s, t) => s + Math.abs(t.amount), 0) / ts.length).toFixed(2),
      annual_cost:  +(ts.reduce((s, t) => s + Math.abs(t.amount), 0) / ts.length * 12).toFixed(2),
    }))
    .sort((a, b) => b.annual_cost - a.annual_cost);
}

export default router;
