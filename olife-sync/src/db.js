// src/db.js — Local IndexedDB via Dexie
// Mirrors the Supabase `missions` table schema,
// with extra sync-tracking columns (_dirty, _deleted, _synced_at).

import Dexie from 'dexie';

export const db = new Dexie('olife_local');

db.version(1).stores({
  // Primary tables
  missions: [
    'id',           // uuid — primary key
    'user_id',      // uuid — foreign key
    'mission',      // string — mission identifier
    'status',       // pending|running|complete|failed|cancelled
    'created_at',   // ISO timestamp
    'updated_at',   // ISO timestamp
    // Sync control fields (not in Supabase schema)
    '_dirty',       // boolean — 1 = needs push to cloud
    '_deleted',     // boolean — 1 = soft-deleted, push DELETE then remove
    '_synced_at',   // ISO timestamp — last successful sync
  ].join(', '),

  // Sync metadata store
  sync_meta: 'key',
});

// ── Helpers ────────────────────────────────────────────────────────────────

/** Mark a mission as dirty (needs sync) whenever it's written locally */
export async function localUpsertMission(mission) {
  const now = new Date().toISOString();
  return db.missions.put({
    ...mission,
    updated_at: mission.updated_at ?? now,
    created_at: mission.created_at ?? now,
    _dirty:     1,
    _deleted:   mission._deleted ?? 0,
    _synced_at: mission._synced_at ?? null,
  });
}

/** Soft-delete — marks for remote deletion on next sync */
export async function localDeleteMission(id) {
  return db.missions.update(id, {
    _dirty:   1,
    _deleted: 1,
    updated_at: new Date().toISOString(),
  });
}

/** Get/set last sync cursor (server timestamp) */
export async function getLastSyncCursor() {
  const row = await db.sync_meta.get('last_sync_cursor');
  return row?.value ?? null;
}

export async function setLastSyncCursor(ts) {
  return db.sync_meta.put({ key: 'last_sync_cursor', value: ts });
}
