// src/client.js
// Two clients:
//   supabase       — anon key, RLS enforced, used for user-scoped queries
//   supabaseAdmin  — service role, bypasses RLS, used for admin ops and audit writes

import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const URL  = process.env.SUPABASE_URL;
const ANON = process.env.SUPABASE_ANON_KEY;
const SVC  = process.env.SUPABASE_SERVICE_KEY;

if (!URL || !ANON) {
  throw new Error('Missing SUPABASE_URL or SUPABASE_ANON_KEY in environment');
}

// User-scoped client — RLS policies apply
export const supabase = createClient(URL, ANON, {
  auth: { persistSession: false },
  realtime: { params: { eventsPerSecond: 10 } },
});

// Admin client — service role, bypasses RLS
// ONLY use server-side. Never expose service key to browser.
export const supabaseAdmin = SVC
  ? createClient(URL, SVC, { auth: { persistSession: false } })
  : null;
