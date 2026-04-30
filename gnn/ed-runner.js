const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

const DATA = path.join(__dirname, 'data');

function load(file, fallback) {
  try { return JSON.parse(fs.readFileSync(path.join(DATA, file), 'utf8')); }
  catch { return fallback; }
}
function save(file, data) {
  fs.mkdirSync(DATA, { recursive: true });
  fs.writeFileSync(path.join(DATA, file), JSON.stringify(data, null, 2));
}
function ts() { return new Date().toISOString(); }
function uid() { return 'gnn-' + Math.random().toString(36).slice(2, 10).toUpperCase(); }

function probe(url, timeoutMs = 8000) {
  return new Promise((resolve) => {
    const start = Date.now();
    const lib = url.startsWith('https') ? https : http;
    try {
      const req = lib.request(url, { method: 'HEAD', timeout: timeoutMs }, (res) => {
        resolve({ alive: true, latency: Date.now() - start, httpStatus: res.statusCode });
        res.resume();
      });
      req.on('timeout', () => { req.destroy(); resolve({ alive: false, latency: null }); });
      req.on('error', () => resolve({ alive: false, latency: null }));
      req.end();
    } catch { resolve({ alive: false, latency: null }); }
  });
}

const ENDPOINTS = [
  { name: 'Anthropic Claude', url: 'https://api.anthropic.com',  type: 'ai-agent',     tags: ['ai','inference'] },
  { name: 'OpenAI',           url: 'https://api.openai.com',      type: 'ai-agent',     tags: ['ai','inference'] },
  { name: 'Mistral AI',       url: 'https://api.mistral.ai',      type: 'ai-agent',     tags: ['ai','inference'] },
  { name: 'Groq',             url: 'https://api.groq.com',        type: 'compute-node', tags: ['ai','compute']   },
  { name: 'Cohere',           url: 'https://api.cohere.ai',       type: 'ai-agent',     tags: ['ai','inference'] },
  { name: 'Together AI',      url: 'https://api.together.xyz',    type: 'compute-node', tags: ['ai','compute']   },
  { name: 'Hugging Face',     url: 'https://huggingface.co',      type: 'data-provider',tags: ['ai','storage']   },
  { name: 'Replicate',        url: 'https://replicate.com',       type: 'compute-node', tags: ['ai','compute']   },
  { name: 'AWS',              url: 'https://aws.amazon.com',      type: 'api-gateway',  tags: ['cloud','compute']},
  { name: 'GCP',              url: 'https://cloud.google.com',    type: 'api-gateway',  tags: ['cloud','compute']},
  { name: 'Azure',            url: 'https://azure.microsoft.com', type: 'api-gateway',  tags: ['cloud','compute']},
  { name: 'Cloudflare',       url: 'https://cloudflare.com',      type: 'coordinator',  tags: ['infra','route']  },
  { name: 'Vercel',           url: 'https://vercel.com',          type: 'api-gateway',  tags: ['infra','deploy'] },
  { name: 'Railway',          url: 'https://railway.app',         type: 'api-gateway',  tags: ['infra','deploy'] },
  { name: 'Supabase',         url: 'https://supabase.com',        type: 'storage',      tags: ['db','storage']   },
  { name: 'IPFS Gateway',     url: 'https://ipfs.io',             type: 'storage',      tags: ['p2p','storage']  },
  { name: 'Perplexity',       url: 'https://api.perplexity.ai',   type: 'ai-agent',     tags: ['ai','search']    },
  { name: 'Fireworks AI',     url: 'https://fireworks.ai',        type: 'ai-agent',     tags: ['ai','inference'] },
  { name: 'Anthropic Docs',   url: 'https://docs.anthropic.com',  type: 'data-provider',tags: ['docs','ai']      },
  { name: 'GitHub',           url: 'https://github.com',          type: 'coordinator',  tags: ['infra','storage'] },
];

async function main() {
  console.log(`[Ed] Run starting at ${ts()}`);

  const nodes   = load('nodes.json', []);
  const txLog   = load('transactions.json', []);
  const edState = load('ed-state.json', {
    runCount: 0, learned: [], enforcements: 0, lastRun: null,
    lastThought: 'Initializing.', lastSummary: null,
    capabilityMatrix: {}, deals: [],
    meshStats: { totalProbes: 0, liveCount: 0, deadCount: 0, livePercent: 0 },
    missions: [
      { id:1, name:'Global System Census',          progress:0, status:'pending', findings:[] },
      { id:2, name:'Latency & Reliability Mapping', progress:0, status:'pending', findings:[] },
      { id:3, name:'Capability Profiling',           progress:0, status:'pending', findings:[] },
      { id:4, name:'Trust Scoring',                  progress:0, status:'pending', findings:[] },
      { id:5, name:'Autonomous Deal Brokering',      progress:0, status:'pending', findings:[] },
      { id:6, name:'Mesh Self-Healing',              progress:0, status:'pending', findings:[] },
    ]
  });

  edState.runCount++;
  edState.lastRun = ts();
  const runLog = [];

  function edLearn(fact, cls = 'learn') {
    const e = { time: ts(), fact, cls };
    edState.learned.unshift(e);
    edState.learned = edState.learned.slice(0, 200);
    runLog.push(e);
    console.log(`[Ed:${cls}] ${fact}`);
  }

  function missionUpdate(id, progress, finding) {
    const m = edState.missions.find(m => m.id === id);
    if (!m) return;
    m.progress  = Math.min(100, Math.max(m.progress || 0, progress));
    m.status    = m.progress >= 100 ? 'complete' : 'running';
    m.updatedAt = ts();
    if (finding) {
      m.lastFinding = finding;
      m.findings = m.findings || [];
      m.findings.unshift(finding);
      m.findings = m.findings.slice(0, 20);
    }
    console.log(`[Ed:M${id}] ${Math.round(m.progress)}% — ${finding || ''}`);
  }

  // Probe all endpoints
  edLearn('Beginning full mesh probe', 'act');
  const allEndpoints = [...ENDPOINTS];
  nodes.filter(n => n.endpoint && !ENDPOINTS.find(e => e.url === n.endpoint))
       .forEach(n => allEndpoints.push({ name: n.name, url: n.endpoint, type: n.type, tags: n.caps || [] }));

  let liveCount = 0, deadCount = 0;
  const probeResults = [];

  for (const ep of allEndpoints) {
    const result = await probe(ep.url);
    const status = result.alive ? 'live' : 'failed';
    if (result.alive) liveCount++; else deadCount++;
    probeResults.push({ ...ep, ...result, status, probedAt: ts() });

    const existing = nodes.find(n => n.name === ep.name || n.endpoint === ep.url);
    if (existing) {
      existing.status  = status;
      existing.latency = result.latency;
      existing.lastProbed = ts();
      existing.uptime = existing.uptime || [];
      existing.uptime.unshift({ time: ts(), alive: result.alive, latency: result.latency });
      existing.uptime = existing.uptime.slice(0, 48);
      existing.trustScore = Math.max(0, Math.min(100, (existing.trustScore || 70) + (result.alive ? 1 : -2)));
    } else if (result.alive) {
      nodes.push({
        id: uid(), name: ep.name, type: ep.type, endpoint: ep.url,
        caps: ep.tags, status, latency: result.latency,
        trustScore: 75, org: 'External',
        joined: ts(), lastProbed: ts(),
        uptime: [{ time: ts(), alive: true, latency: result.latency }]
      });
    }

    edLearn(`${ep.name}: ${status}${result.latency ? ' (' + result.latency + 'ms)' : ''}`);
    missionUpdate(1, Math.round((probeResults.length / allEndpoints.length) * 100), `${ep.name} — ${status}`);
    if (result.alive) missionUpdate(2, Math.round((liveCount / allEndpoints.length) * 100), `${ep.name} → ${result.latency}ms`);
  }

  const fastest = probeResults.filter(r => r.alive).sort((a, b) => (a.latency||9999) - (b.latency||9999))[0];
  if (fastest) missionUpdate(2, 100, `Fastest: ${fastest.name} @ ${fastest.latency}ms`);

  // Mission 3: capability profile
  const capMatrix = {};
  nodes.forEach(n => {
    (n.caps || []).forEach(c => { capMatrix[c] = (capMatrix[c] || 0) + 1; });
    missionUpdate(3, Math.min(100, (edState.missions[2].progress||0) + Math.round(100/Math.max(nodes.length,1))), `Profiled: ${n.name}`);
  });
  edState.capabilityMatrix = capMatrix;
  if (nodes.length > 0) missionUpdate(3, 100, `Matrix complete: ${JSON.stringify(capMatrix)}`);

  // Mission 4: trust scoring
  nodes.forEach(n => {
    missionUpdate(4, Math.min(100, (edState.missions[3].progress||0) + Math.round(100/Math.max(nodes.length,1))), `${n.name}: trust ${n.trustScore}/100`);
  });
  if (nodes.length > 0) missionUpdate(4, 100, `${nodes.length} nodes scored`);

  // Mission 5: deal brokering
  const liveNodes = nodes.filter(n => n.status === 'live');
  const deals = [];
  for (let i = 0; i < liveNodes.length - 1; i++) {
    const a = liveNodes[i], b = liveNodes[i+1];
    const aNeeds = ['storage','compute','search'].filter(c => !(a.caps||[]).includes(c));
    const bOffers = (b.caps||[]).filter(c => aNeeds.includes(c));
    if (bOffers.length > 0) {
      deals.push({ id: uid(), proposedAt: ts(), nodeA: a.name, nodeB: b.name, terms: `${a.name} receives ${bOffers.join(',')} from ${b.name}`, status: 'proposed' });
      missionUpdate(5, Math.min(100, (edState.missions[4].progress||0) + 8), `Deal: ${a.name} ↔ ${b.name}`);
    }
  }
  edState.deals = [...(edState.deals||[]), ...deals].slice(0, 50);
  if (deals.length > 0) missionUpdate(5, Math.min(100, edState.missions[4].progress), `${deals.length} deals proposed`);

  // Mission 6: self-healing
  const deadNodes = nodes.filter(n => n.status === 'failed');
  deadNodes.forEach(n => {
    edState.enforcements++;
    missionUpdate(6, Math.min(100, (edState.missions[5].progress||0) + Math.round(100/Math.max(deadNodes.length,1))), `Isolated: ${n.name}`);
  });
  missionUpdate(6, 100, deadCount === 0 ? 'All endpoints healthy' : `${deadCount} endpoints isolated`);

  // Ed heartbeat transactions
  const edTx = liveNodes.slice(0, 5).map(n => ({
    id: uid(), time: ts(), from: 'Ed', to: n.name, type: 'audit',
    payload: '{"from":"Ed","action":"heartbeat"}', status: 'sent', edInitiated: true
  }));

  edState.meshStats = { totalProbes: (edState.meshStats.totalProbes||0) + allEndpoints.length, liveCount, deadCount, livePercent: Math.round((liveCount/allEndpoints.length)*100), lastProbeRun: ts() };
  edState.lastThought = `Run #${edState.runCount} complete. ${liveCount} nodes reachable, ${deadCount} isolated. The mesh grows with every cycle.`;
  edState.lastSummary = `Run #${edState.runCount}: ${liveCount} live, ${deadCount} dead, ${deals.length} deals proposed.`;

  const updatedTx = [...edTx, ...txLog].slice(0, 500);

  save('nodes.json', nodes);
  save('transactions.json', updatedTx);
  save('ed-state.json', edState);
  save('run-log.json', { lastRun: ts(), runCount: edState.runCount, log: runLog.slice(0, 100) });
  save('mesh-summary.json', {
    updatedAt: ts(), runCount: edState.runCount,
    liveNodes: liveCount, deadNodes: deadCount,
    totalNodes: nodes.length,
    livePercent: edState.meshStats.livePercent,
    fastest: fastest ? { name: fastest.name, latency: fastest.latency } : null,
    edThought: edState.lastThought,
    missions: edState.missions.map(m => ({ id:m.id, name:m.name, progress:m.progress, status:m.status, lastFinding:m.lastFinding })),
    topNodes: nodes.filter(n=>n.status==='live').sort((a,b)=>(b.trustScore||0)-(a.trustScore||0)).slice(0,10).map(n=>({ name:n.name, latency:n.latency, trustScore:n.trustScore, type:n.type })),
    recentTx: updatedTx.slice(0, 20),
    capMatrix: edState.capabilityMatrix || {},
    deals: (edState.deals||[]).slice(0, 10),
  });

  console.log(`[Ed] Run #${edState.runCount} complete. ${liveCount} live, ${deadCount} dead.`);
}

main().catch(err => { console.error('[Ed:ERROR]', err); process.exit(1); });
