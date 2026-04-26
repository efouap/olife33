// src/index.js — Public API of olife-db

export { supabase, supabaseAdmin } from './client.js';

export {
  // Users
  createUser,
  authenticateUser,
  getUserSummary,
  updatePin,

  // Missions
  createMission,
  updateMission,
  runMission,
  listMissions,
  getMission,
  deleteMission,

  // Audit
  writeAudit,
  getAuditLog,
  getAllAuditEvents,

  // OLST Tokens
  recordTokenTransaction,
  getOlstBalance,
  listTokenTransactions,

  // Realtime
  subscribeMissions,
  subscribeTokens,

  // Admin views
  getMissionFeed,
  getAllUserSummaries,
} from './dal.js';
