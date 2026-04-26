// src/server.js
import 'dotenv/config';
import express from 'express';
import cors    from 'cors';
import morgan  from 'morgan';
import path    from 'path';
import { fileURLToPath } from 'url';

import plaidRouter  from './routes/plaid.js';
import alpacaRouter from './routes/alpaca.js';
import gmailRouter  from './routes/gmail.js';
import newsRouter   from './routes/news.js';

const app  = express();
const PORT = process.env.PORT || 3001;
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ── Middleware ────────────────────────────────────────────────────────────────
app.use(cors({ origin: '*' }));
app.use(express.json());
app.use(morgan('tiny'));
app.use(express.static(path.join(__dirname, '../public')));

// ── Routes ────────────────────────────────────────────────────────────────────
app.use('/plaid',  plaidRouter);
app.use('/alpaca', alpacaRouter);
app.use('/gmail',  gmailRouter);
app.use('/news',   newsRouter);

// ── Health ────────────────────────────────────────────────────────────────────
app.get('/health', (_, res) => {
  res.json({
    status: 'ok',
    ts:     Date.now(),
    integrations: {
      plaid:   !!process.env.PLAID_CLIENT_ID,
      alpaca:  !!process.env.ALPACA_API_KEY,
      gmail:   !!process.env.GMAIL_CLIENT_ID,
      news:    !!process.env.NEWS_API_KEY,
    },
  });
});

// ── Serve dashboard ───────────────────────────────────────────────────────────
app.get('*', (_, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

app.listen(PORT, () => {
  console.log(`\n  O LIFE Integrations running on http://localhost:${PORT}`);
  console.log(`  Plaid:  ${process.env.PLAID_CLIENT_ID   ? '✓' : '✗ missing key'}`);
  console.log(`  Alpaca: ${process.env.ALPACA_API_KEY     ? '✓' : '✗ missing key'}`);
  console.log(`  Gmail:  ${process.env.GMAIL_CLIENT_ID    ? '✓' : '✗ missing key'}`);
  console.log(`  News:   ${process.env.NEWS_API_KEY        ? '✓' : '✗ missing key'}\n`);
});
