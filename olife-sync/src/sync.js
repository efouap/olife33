// src/sync.js — O LIFE Bidirectional Sync Engine
//
// Strategy:
//   PUSH  local dirty rows → Supabase upsert (batched, retried)
//   PUSH  local _deleted rows → Supabase delete, then purge local
//   PULL  rows changed on server since last cursor → merge into local
//
// Conflict resolution: server wins on pull (last-write-wins by updated_at).
// Dirty local rows are pushed first so they land on the server before we pull.
//
// Events emitted on the exported `syncBus` EventTarget:
//   'start'     { trigger }
//   'progress'  { phase, done, total }
//   'complete'  { pushed, pulled, deleted, duration_ms }
//   'error'     { phase, error, attempt, willRetry }
//   'online'    {}
//   'offline'   {}
//   'realtime'  { eventType, record }

import { db, getLastSyncCursor, setLastSyncCursor, localUpsertMission } from './db.js';
import { supabase } from './supabase.js';

// ── Config ─────────────────────────────────────────────────────────────────
const BATCH_SIZE   = 50;     // rows per upsert call
const MAX_RETRIES  = 4;
const RETRY_BASE   = 800;    // ms, doubles each attempt
const AUTO_INTERVAL= 30_000; // 30 s auto-sync
const PULL_LIMIT   = 500;    // max rows to pull per sync

// ── Event bus ─────────────────────────────────────────────────────────────
export const syncBus = new EventTarget();

function emit(type, detail = {}) {
  syncBus.dispatchEvent(new CustomEvent(type, { detail }));
}

// ── State ──────────────────────────────────────────────────────────────────
let _syncing   = false;
let _autoTimer = null;
let _rtChannel = null;
let _online    = navigator.onLine;

window.addEventListener('online',  () => { _online = true;  emit('online');  triggerSync('online');  });
window.addEventListener('offline', () => { _online = false; emit('offline'); });

// ── Retry wrapper ──────────────────────────────────────────────────────────
async function withRetry(fn, phase) {
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await fn();
    } catch (err) {
      const willRetry = attempt < MAX_RETRIES && _online;
      emit('error', { phase, error: err.message, attempt, willRetry });
      if (!willRetry) throw err;
      await new Promise(r => setTimeout(r, RETRY_BASE * Math.pow(2, attempt - 1)));
    }
  }
}

// ── Strip local-only fields before sending to Supabase ─────────────────────
function toRemote(row) {
  // eslint-disable-next-line no-unused-vars
  const { _dirty, _deleted, _synced_at, dbKey, ...clean } = row;
  return clean;
}

// ── PUSH — local dirty → Supabase ─────────────────────────────────────────
async function pushDirty(stats) {
  const dirty = await db.missions
    .where('_dirty').equals(1)
    .and(r => !r._deleted)
    .toArray();

  if (!dirty.length) return;

  // Batch upserts
  for (let i = 0; i < dirty.length; i += BATCH_SIZE) {
    const batch = dirty.slice(i, i + BATCH_SIZE).map(toRemote);

    await withRetry(async () => {
      const { error } = await supabase.from('missions').upsert(batch, {
        onConflict: 'id',
        ignoreDuplicates: false,
      });
      if (error) throw new Error(error.message);
    }, 'push');

    // Mark as clean
    await Promise.all(dirty.slice(i, i + BATCH_SIZE).map(r =>
      db.missions.update(r.id, { _dirty: 0, _synced_at: new Date().toISOString() })
    ));

    stats.pushed += batch.length;
    emit('progress', { phase: 'push', done: stats.pushed, total: dirty.length });
  }
}

// ── PUSH DELETES — local soft-deleted → Supabase DELETE ────────────────────
async function pushDeletes(stats) {
  const deleted = await db.missions
    .where('_deleted').equals(1)
    .toArray();

  if (!deleted.length) return;

  const ids = deleted.map(r => r.id);

  await withRetry(async () => {
    const { error } = await supabase.from('missions').delete().in('id', ids);
    if (error) throw new Error(error.message);
  }, 'push_delete');

  // Permanently remove from local DB
  await db.missions.bulkDelete(ids);
  stats.deleted += ids.length;
}

// ── PULL — Supabase changes since cursor → local ───────────────────────────
async function pullRemote(stats) {
  const cursor = await getLastSyncCursor();
  const now    = new Date().toISOString();

  let q = supabase
    .from('missions')
    .select('*')
    .order('updated_at', { ascending: true })
    .limit(PULL_LIMIT);

  if (cursor) q = q.gt('updated_at', cursor);

  const { data, error } = await withRetry(async () => {
    const res = await q;
    if (res.error) throw new Error(res.error.message);
    return res;
  }, 'pull');

  if (!data?.length) return;

  // Conflict resolution: server wins unless local is dirty AND newer
  const toMerge = await Promise.all(data.map(async remote => {
    const local = await db.missions.get(remote.id);

    if (local?._dirty && local.updated_at > remote.updated_at) {
      // Local is newer and dirty — skip this remote record
      // (it'll be pushed on next push phase)
      return null;
    }

    return {
      ...remote,
      _dirty:    0,
      _deleted:  0,
      _synced_at: now,
    };
  }));

  const valid = toMerge.filter(Boolean);
  if (valid.length) {
    await db.missions.bulkPut(valid);
    stats.pulled += valid.length;
    emit('progress', { phase: 'pull', done: stats.pulled, total: data.length });
  }

  // Advance cursor to newest updated_at we received
  const newest = data[data.length - 1].updated_at;
  await setLastSyncCursor(newest);
}

// ── syncMissions — exact original function, fully implemented ──────────────
export async function syncMissions() {
  if (_syncing || !_online) return;
  _syncing = true;

  const stats   = { pushed: 0, pulled: 0, deleted: 0 };
  const startMs = Date.now();

  emit('start', { trigger: 'manual' });

  try {
    await pushDirty(stats);
    await pushDeletes(stats);
    await pullRemote(stats);

    const duration_ms = Date.now() - startMs;
    emit('complete', { ...stats, duration_ms });
  } catch (err) {
    emit('error', { phase: 'sync', error: err.message, attempt: MAX_RETRIES, willRetry: false });
  } finally {
    _syncing = false;
  }
}

// ── Auto-sync scheduler ────────────────────────────────────────────────────
export function startAutoSync(intervalMs = AUTO_INTERVAL) {
  stopAutoSync();
  syncMissions(); // immediate first run
  _autoTimer = setInterval(syncMissions, intervalMs);
}

export function stopAutoSync() {
  if (_autoTimer) { clearInterval(_autoTimer); _autoTimer = null; }
}

// ── Realtime subscription — server pushes → local merge ────────────────────
export function startRealtime(userId) {
  if (_rtChannel) stopRealtime();

  _rtChannel = supabase
    .channel(`sync:missions:${userId}`)
    .on(
      'postgres_changes',
      {
        event:  '*',
        schema: 'public',
        table:  'missions',
        filter: `user_id=eq.${userId}`,
      },
      async (payload) => {
        emit('realtime', { eventType: payload.eventType, record: payload.new ?? payload.old });

        if (payload.eventType === 'DELETE') {
          // Only remove if not dirty (we may have local changes)
          const local = await db.missions.get(payload.old.id);
          if (!local?._dirty) await db.missions.delete(payload.old.id);
          return;
        }

        const remote = payload.new;
        const local  = await db.missions.get(remote.id);

        // Conflict: local dirty + newer → keep local
        if (local?._dirty && local.updated_at > remote.updated_at) return;

        await localUpsertMission({
          ...remote,
          _dirty:    0,
          _synced_at: new Date().toISOString(),
        });
      }
    )
    .subscribe();
}

export function stopRealtime() {
  if (_rtChannel) { supabase.removeChannel(_rtChannel); _rtChannel = null; }
}

// ── Trigger sync helper ────────────────────────────────────────────────────
export function triggerSync(trigger = 'manual') {
  if (!_syncing && _online) syncMissions();
}

// ── Sync status ────────────────────────────────────────────────────────────
export function getSyncState() {
  return { syncing: _syncing, online: _online };
}
