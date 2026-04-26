// src/dal.js — Data Access Layer
// One function per operation. Every write also writes to audit_logs.
// All functions throw on error — caller decides how to handle.

import { supabase, supabaseAdmin } from './client.js';


// ── INTERNAL ──────────────────────────────────────────────────────────────────

function admin() {
  if (!supabaseAdmin) throw new Error('Service role key not configured');
  return supabaseAdmin;
}

function assert(data, error) {
  if (error) throw new Error(error.message ?? JSON.stringify(error));
  return data;
}

async function writeAudit(userId, action, metadata = {}) {
  const { error } = await admin()
    .from('audit_logs')
    .insert({ user_id: userId, action, metadata });
  if (error) console.error('[audit] failed to write:', action, error.message);
}


// ════════════════════════════════════════════════════════════════════════════
// USERS
// ════════════════════════════════════════════════════════════════════════════

/**
 * Register a new user. PIN is hashed via the database hash_pin() function.
 *
 * @param {{ email: string, pin: string }} params
 * @returns {Promise<{ id, email, created_at }>}
 */
export async function createUser({ email, pin }) {
  // Hash PIN using Postgres pgcrypto — never touches JS layer in plaintext
  const { data: hashData, error: hashErr } = await admin()
    .rpc('hash_pin', { pin });
  assert(hashData, hashErr);

  const { data, error } = await admin()
    .from('users')
    .insert({ email, pin_hash: hashData })
    .select('id, email, created_at')
    .single();

  assert(data, error);

  await writeAudit(data.id, 'user.register', { email });
  return data;
}

/**
 * Authenticate a user by email + PIN.
 * Uses database verify_pin() — PIN never compared in JS.
 *
 * @param {{ email: string, pin: string }} params
 * @returns {Promise<{ id, email, created_at } | null>} null = wrong credentials
 */
export async function authenticateUser({ email, pin }) {
  const { data: user, error } = await admin()
    .from('users')
    .select('id, email, pin_hash, created_at')
    .eq('email', email)
    .single();

  if (error || !user) return null;

  const { data: valid } = await admin()
    .rpc('verify_pin', { pin, hash: user.pin_hash });

  if (!valid) {
    await writeAudit(user.id, 'user.login_failed', { email });
    return null;
  }

  await writeAudit(user.id, 'user.login', { email });

  // eslint-disable-next-line no-unused-vars
  const { pin_hash: _, ...safeUser } = user;
  return safeUser;
}

/**
 * Get a user's full summary including mission counts and OLST balance.
 */
export async function getUserSummary(userId) {
  const { data, error } = await admin()
    .from('user_summary')
    .select('*')
    .eq('id', userId)
    .single();
  return assert(data, error);
}

/**
 * Update user's PIN.
 */
export async function updatePin(userId, newPin) {
  const { data: hash, error: hashErr } = await admin()
    .rpc('hash_pin', { pin: newPin });
  assert(hash, hashErr);

  const { error } = await admin()
    .from('users')
    .update({ pin_hash: hash })
    .eq('id', userId);

  assert(null, error);
  await writeAudit(userId, 'user.pin_changed', {});
}


// ════════════════════════════════════════════════════════════════════════════
// MISSIONS
// ════════════════════════════════════════════════════════════════════════════

/**
 * Create a new mission record (status: pending).
 *
 * @param {{ userId: string, mission: string, payload?: object }} params
 * @returns {Promise<Mission>}
 */
export async function createMission({ userId, mission, payload = {} }) {
  const { data, error } = await admin()
    .from('missions')
    .insert({
      user_id: userId,
      mission,
      payload,
      status: 'pending',
    })
    .select()
    .single();

  assert(data, error);
  await writeAudit(userId, 'mission.created', { mission_id: data.id, mission });
  return data;
}

/**
 * Update a mission's status and/or payload.
 * Audit trigger handles the status-change log automatically.
 */
export async function updateMission(missionId, { status, payload }) {
  const updates = {};
  if (status)  updates.status  = status;
  if (payload) updates.payload = payload;

  const { data, error } = await admin()
    .from('missions')
    .update(updates)
    .eq('id', missionId)
    .select()
    .single();

  return assert(data, error);
}

/**
 * Full mission lifecycle helper — create → run fn → persist result.
 *
 * @param {{ userId, mission }} params
 * @param {Function} runFn  async (missionId) => result
 */
export async function runMission({ userId, mission }, runFn) {
  const record = await createMission({ userId, mission });

  await updateMission(record.id, { status: 'running' });

  try {
    const start  = Date.now();
    const output = await runFn(record.id);
    const latency = Date.now() - start;

    const finalRecord = await updateMission(record.id, {
      status:  'complete',
      payload: { ...record.payload, output, latency_ms: latency },
    });

    await writeAudit(userId, 'mission.complete', {
      mission_id:  record.id,
      mission,
      latency_ms:  latency,
    });

    return finalRecord;

  } catch (err) {
    await updateMission(record.id, {
      status:  'failed',
      payload: { ...record.payload, error: err.message },
    });
    await writeAudit(userId, 'mission.failed', {
      mission_id: record.id,
      mission,
      error:      err.message,
    });
    throw err;
  }
}

/**
 * List missions for a user, newest first.
 */
export async function listMissions(userId, { limit = 50, status } = {}) {
  let q = admin()
    .from('missions')
    .select('id, mission, status, created_at, updated_at, payload->latency_ms as latency_ms')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (status) q = q.eq('status', status);

  const { data, error } = await q;
  return assert(data, error);
}

/**
 * Get a single mission by ID.
 */
export async function getMission(missionId) {
  const { data, error } = await admin()
    .from('missions')
    .select('*')
    .eq('id', missionId)
    .single();
  return assert(data, error);
}

/**
 * Delete a mission (and cascade via FK).
 */
export async function deleteMission(userId, missionId) {
  const { error } = await admin()
    .from('missions')
    .delete()
    .eq('id', missionId)
    .eq('user_id', userId);

  assert(null, error);
  await writeAudit(userId, 'mission.deleted', { mission_id: missionId });
}


// ════════════════════════════════════════════════════════════════════════════
// AUDIT LOGS
// ════════════════════════════════════════════════════════════════════════════

/**
 * Write an audit event. Called internally by other DAL functions,
 * but can also be called directly by the app layer.
 */
export { writeAudit };

/**
 * Query audit log for a user, newest first.
 */
export async function getAuditLog(userId, { limit = 100, action } = {}) {
  let q = admin()
    .from('audit_logs')
    .select('id, action, metadata, timestamp')
    .eq('user_id', userId)
    .order('timestamp', { ascending: false })
    .limit(limit);

  if (action) q = q.eq('action', action);

  const { data, error } = await q;
  return assert(data, error);
}

/**
 * Admin: get all audit events across all users (service role only).
 */
export async function getAllAuditEvents({ limit = 200 } = {}) {
  const { data, error } = await admin()
    .from('audit_logs')
    .select('*, users!audit_logs_user_id_fkey(email)')
    .order('timestamp', { ascending: false })
    .limit(limit);
  return assert(data, error);
}


// ════════════════════════════════════════════════════════════════════════════
// OLST TOKENS
// ════════════════════════════════════════════════════════════════════════════

/**
 * Record an OLST token credit or debit.
 *
 * @param {{ userId, amount, txHash?, chain? }} params
 */
export async function recordTokenTransaction({ userId, amount, txHash = null, chain = 'base' }) {
  const { data, error } = await admin()
    .from('olst_tokens')
    .insert({
      user_id:  userId,
      amount,
      tx_hash:  txHash,
      chain,
    })
    .select()
    .single();

  assert(data, error);

  await writeAudit(userId, amount > 0 ? 'token.credit' : 'token.debit', {
    amount,
    chain,
    tx_hash: txHash,
    token_id: data.id,
  });

  return data;
}

/**
 * Get OLST balance for a user.
 */
export async function getOlstBalance(userId) {
  const { data, error } = await admin()
    .rpc('get_olst_balance', { p_user_id: userId });
  return assert(data, error);
}

/**
 * List OLST transactions for a user, newest first.
 */
export async function listTokenTransactions(userId, { limit = 50 } = {}) {
  const { data, error } = await admin()
    .from('olst_tokens')
    .select('id, amount, tx_hash, chain, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);
  return assert(data, error);
}


// ════════════════════════════════════════════════════════════════════════════
// REALTIME SUBSCRIPTIONS
// ════════════════════════════════════════════════════════════════════════════

/**
 * Subscribe to mission status changes for a specific user.
 * RLS on the Supabase connection ensures only own rows are received.
 *
 * @param {string} userId
 * @param {Function} onUpdate   (mission) => void
 * @returns {Function} unsubscribe
 */
export function subscribeMissions(userId, onUpdate) {
  const channel = supabase
    .channel(`missions:${userId}`)
    .on(
      'postgres_changes',
      {
        event:  '*',
        schema: 'public',
        table:  'missions',
        filter: `user_id=eq.${userId}`,
      },
      (payload) => onUpdate(payload)
    )
    .subscribe();

  return () => supabase.removeChannel(channel);
}

/**
 * Subscribe to OLST token events for a specific user.
 *
 * @param {string} userId
 * @param {Function} onCredit   (tokenRecord) => void
 * @returns {Function} unsubscribe
 */
export function subscribeTokens(userId, onCredit) {
  const channel = supabase
    .channel(`olst:${userId}`)
    .on(
      'postgres_changes',
      {
        event:  'INSERT',
        schema: 'public',
        table:  'olst_tokens',
        filter: `user_id=eq.${userId}`,
      },
      (payload) => onCredit(payload.new)
    )
    .subscribe();

  return () => supabase.removeChannel(channel);
}


// ════════════════════════════════════════════════════════════════════════════
// ADMIN VIEWS
// ════════════════════════════════════════════════════════════════════════════

export async function getMissionFeed({ limit = 100 } = {}) {
  const { data, error } = await admin()
    .from('mission_feed')
    .select('*')
    .limit(limit);
  return assert(data, error);
}

export async function getAllUserSummaries() {
  const { data, error } = await admin()
    .from('user_summary')
    .select('*')
    .order('created_at', { ascending: false });
  return assert(data, error);
}
