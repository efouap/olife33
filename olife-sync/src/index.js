// src/index.js — Public API
export { db, localUpsertMission, localDeleteMission } from './db.js';
export { supabase } from './supabase.js';
export {
  syncMissions,
  startAutoSync,
  stopAutoSync,
  startRealtime,
  stopRealtime,
  triggerSync,
  getSyncState,
  syncBus,
} from './sync.js';
