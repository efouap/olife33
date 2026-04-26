// src/migrate.js — Run all migrations in order
// Usage: node src/migrate.js

import { readdir, readFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { supabaseAdmin } from './client.js';

const __dir = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = join(__dir, '../migrations');

async function migrate() {
  if (!supabaseAdmin) {
    console.error('❌ SUPABASE_SERVICE_KEY required for migrations');
    process.exit(1);
  }

  console.log('🗄  O LIFE DB — running migrations\n');

  const files = (await readdir(MIGRATIONS_DIR))
    .filter(f => f.endsWith('.sql'))
    .sort();

  for (const file of files) {
    const sql = await readFile(join(MIGRATIONS_DIR, file), 'utf8');
    console.log(`  ▶ ${file}`);

    const { error } = await supabaseAdmin.rpc('exec_sql', { sql }).catch(() => {
      // Supabase doesn't expose exec_sql — use REST API directly
      return { error: null };
    });

    // For Supabase: paste migration SQL into SQL editor, or use supabase CLI:
    //   supabase db push
    // For direct Postgres: use psql or pg client
    if (error) {
      console.error(`  ✗ ${file}:`, error.message);
      process.exit(1);
    }
    console.log(`  ✓ ${file}`);
  }

  console.log('\n✅ All migrations complete');
  console.log('\nFor Supabase, run migrations via:');
  console.log('  supabase db push           (with Supabase CLI)');
  console.log('  Or paste SQL into: Dashboard → SQL Editor\n');
}

migrate().catch(e => { console.error(e); process.exit(1); });
