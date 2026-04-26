'use strict';

const { Router } = require('express');
const axios = require('axios');

const router = Router();

const AGENCY_MAP = {
  savings:    'http://agencies:8000',
  health:     'http://agencies:8080',
  dating:     'http://agencies:8090',
  quantum:    'http://agencies:8095',
  prediction: 'http://agencies:8101',
  concierge:  'http://agencies:8110',
  comms:      'http://agencies:8120',
  trading:    'http://agencies:8130',
  booking:    'http://agencies:8140',
  delivery:   'http://agencies:8150',
};

// POST /agency/:name  { payload }
router.post('/:name', async (req, res) => {
  const { name } = req.params;
  const base = AGENCY_MAP[name];
  if (!base) return res.status(404).json({ error: `agency '${name}' not found` });

  try {
    const upstream = await axios.post(`${base}/run`, req.body, {
      timeout: 60_000,
      headers: { 'content-type': 'application/json' },
    });
    res.json(upstream.data);
  } catch (err) {
    const status = err.response?.status || 502;
    res.status(status).json({ agency: name, error: err.message });
  }
});

// GET /agency/:name/status
router.get('/:name/status', async (req, res) => {
  const { name } = req.params;
  const base = AGENCY_MAP[name];
  if (!base) return res.status(404).json({ error: `agency '${name}' not found` });

  try {
    const upstream = await axios.get(`${base}/health`, { timeout: 5_000 });
    res.json({ agency: name, ...upstream.data });
  } catch (err) {
    res.status(502).json({ agency: name, status: 'unreachable', error: err.message });
  }
});

module.exports = router;
