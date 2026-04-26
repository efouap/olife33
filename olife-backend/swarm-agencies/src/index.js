'use strict';
require('dotenv').config();

const { createClient } = require('redis');

const createAgency = require('./agency-factory');
const savings    = require('./agencies/savings');
const health     = require('./agencies/health');
const dating     = require('./agencies/dating');
const quantum    = require('./agencies/quantum');
const prediction = require('./agencies/prediction');
const concierge  = require('./agencies/concierge');
const comms      = require('./agencies/comms');
const trading    = require('./agencies/trading');
const booking    = require('./agencies/booking');
const delivery   = require('./agencies/delivery');

// ─── Redis ───────────────────────────────────────────────────────────────────
const redis = createClient({ url: process.env.REDIS_URL || 'redis://localhost:6379' });
redis.on('error', (err) => console.error('[Redis]', err.message));
redis.connect().then(() => console.log('[Redis] agencies connected'));

// ─── Agency definitions ────────────────────────────────────────────────────────
const AGENCIES = [
  { name: 'savings',    port: 8000, handler: savings    },
  { name: 'health',     port: 8080, handler: health     },
  { name: 'dating',     port: 8090, handler: dating     },
  { name: 'quantum',    port: 8095, handler: quantum    },
  { name: 'prediction', port: 8101, handler: prediction },
  { name: 'concierge',  port: 8110, handler: concierge  },
  { name: 'comms',      port: 8120, handler: comms      },
  { name: 'trading',    port: 8130, handler: trading    },
  { name: 'booking',    port: 8140, handler: booking    },
  { name: 'delivery',   port: 8150, handler: delivery   },
];

// Boot all agencies
AGENCIES.forEach(({ name, port, handler }) => {
  const app = createAgency(name, handler, redis);
  app.listen(port, () => {
    console.log(`[${name.toUpperCase()} Agency] :${port}`);
  });
});
