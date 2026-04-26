// src/routes/news.js
import { Router } from 'express';
import axios from 'axios';

const router  = Router();
const API_KEY = process.env.NEWS_API_KEY;
const BASE    = 'https://newsapi.org/v2';

// Simple in-memory cache (5 min TTL)
const cache   = new Map();
const CACHE_TTL = 5 * 60 * 1000;

async function fetchNews(params) {
  const key = JSON.stringify(params);
  const hit  = cache.get(key);
  if (hit && Date.now() - hit.ts < CACHE_TTL) return hit.data;

  const res = await axios.get(`${BASE}/everything`, {
    params: { ...params, apiKey: API_KEY, language: 'en' },
    timeout: 10000,
  });

  const data = res.data;
  cache.set(key, { data, ts: Date.now() });
  return data;
}

// ── GET /news/market ───────────────────────────────────────────────────────
// Top financial & market news
router.get('/market', async (req, res) => {
  try {
    const { page = 1, pageSize = 20 } = req.query;

    const data = await fetchNews({
      q:         '(stock market OR S&P 500 OR Federal Reserve OR inflation OR earnings)',
      domains:   'reuters.com,bloomberg.com,wsj.com,cnbc.com,ft.com',
      sortBy:    'publishedAt',
      page,
      pageSize,
    });

    const articles = (data.articles || []).map(a => ({
      title:       a.title,
      description: a.description,
      source:      a.source.name,
      url:         a.url,
      published:   a.publishedAt,
      sentiment:   scoreSentiment(a.title + ' ' + (a.description || '')),
    }));

    const avgSentiment = articles.length
      ? +(articles.reduce((s, a) => s + a.sentiment, 0) / articles.length).toFixed(2)
      : 0;

    res.json({ articles, total: data.totalResults, avg_sentiment: avgSentiment });
  } catch (err) {
    res.status(500).json({ error: err.response?.data?.message || err.message });
  }
});

// ── GET /news/ticker/:symbol ───────────────────────────────────────────────
// News for a specific ticker / company
router.get('/ticker/:symbol', async (req, res) => {
  try {
    const { symbol } = req.params;
    const { pageSize = 10 } = req.query;

    const data = await fetchNews({
      q:        symbol,
      sortBy:   'publishedAt',
      pageSize,
    });

    const articles = (data.articles || []).map(a => ({
      title:     a.title,
      source:    a.source.name,
      url:       a.url,
      published: a.publishedAt,
      sentiment: scoreSentiment(a.title + ' ' + (a.description || '')),
    }));

    const bullish = articles.filter(a => a.sentiment > 0.1).length;
    const bearish = articles.filter(a => a.sentiment < -0.1).length;

    res.json({
      symbol,
      articles,
      signal: bullish > bearish ? 'bullish' : bearish > bullish ? 'bearish' : 'neutral',
      bullish_count: bullish,
      bearish_count: bearish,
    });
  } catch (err) {
    res.status(500).json({ error: err.response?.data?.message || err.message });
  }
});

// ── GET /news/headlines ────────────────────────────────────────────────────
// Top business headlines (faster endpoint)
router.get('/headlines', async (req, res) => {
  try {
    const { pageSize = 10, country = 'us' } = req.query;

    const res2 = await axios.get(`${BASE}/top-headlines`, {
      params: { category: 'business', country, pageSize, apiKey: API_KEY },
      timeout: 8000,
    });

    const articles = (res2.data.articles || []).map(a => ({
      title:     a.title,
      source:    a.source.name,
      url:       a.url,
      published: a.publishedAt,
      sentiment: scoreSentiment(a.title),
    }));

    res.json({ articles });
  } catch (err) {
    res.status(500).json({ error: err.response?.data?.message || err.message });
  }
});

// ── Sentiment scorer (lexicon-based, no AI call) ──────────────────────────
const BULLISH_WORDS = ['surge', 'soar', 'rally', 'beat', 'record', 'growth', 'profit',
  'gain', 'rise', 'bullish', 'upgrade', 'outperform', 'positive', 'strong', 'up'];
const BEARISH_WORDS = ['crash', 'plunge', 'fall', 'miss', 'loss', 'decline', 'drop',
  'concern', 'fear', 'risk', 'warning', 'downgrade', 'recession', 'weak', 'down'];

function scoreSentiment(text) {
  const lower = (text || '').toLowerCase();
  let score = 0;
  BULLISH_WORDS.forEach(w => { if (lower.includes(w)) score += 0.1; });
  BEARISH_WORDS.forEach(w => { if (lower.includes(w)) score -= 0.1; });
  return Math.max(-1, Math.min(1, +score.toFixed(2)));
}

export default router;
