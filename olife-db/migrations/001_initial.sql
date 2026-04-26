-- ============================================================
-- O LIFE Supreme Intelligence OS — Database Schema
-- Migration: 001_initial
-- ============================================================

-- Extensions
create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";


-- ════════════════════════════════════════════════════════════
-- TABLE: users
-- ════════════════════════════════════════════════════════════
create table if not exists users (
  id          uuid primary key default uuid_generate_v4(),
  email       text not null,
  pin_hash    text not null,
  created_at  timestamptz default now(),

  -- constraints
  constraint users_email_unique unique (email),
  constraint users_email_format check (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$')
);

create index idx_users_email      on users (email);
create index idx_users_created_at on users (created_at desc);

comment on table  users           is 'O LIFE user accounts. PIN stored as bcrypt hash via pgcrypto.';
comment on column users.pin_hash  is 'bcrypt hash of 6-digit PIN. Never store plaintext.';


-- ════════════════════════════════════════════════════════════
-- TABLE: missions
-- ════════════════════════════════════════════════════════════
create table if not exists missions (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid not null references users (id) on delete cascade,
  mission     text not null,
  payload     jsonb not null default '{}',
  status      text not null default 'pending',
  created_at  timestamptz default now(),
  updated_at  timestamptz default now(),

  -- constraints
  constraint missions_status_values check (
    status in ('pending', 'running', 'complete', 'failed', 'cancelled')
  ),
  constraint missions_mission_nonempty check (length(trim(mission)) > 0)
);

create index idx_missions_user_id    on missions (user_id);
create index idx_missions_status     on missions (status);
create index idx_missions_created_at on missions (created_at desc);
create index idx_missions_user_status on missions (user_id, status);
create index idx_missions_payload    on missions using gin (payload);

comment on table  missions          is 'AI mission executions. Payload is the full input/output JSONB.';
comment on column missions.mission  is 'Mission identifier, e.g. subscription_graveyard, wealth_scan.';
comment on column missions.payload  is 'Full JSONB: { input, output, model, tokens, latency_ms }';


-- Auto-update updated_at on mission changes
create or replace function update_missions_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_missions_updated_at
  before update on missions
  for each row execute function update_missions_updated_at();


-- ════════════════════════════════════════════════════════════
-- TABLE: audit_logs
-- ════════════════════════════════════════════════════════════
create table if not exists audit_logs (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid references users (id) on delete set null,  -- keep logs even if user deleted
  action      text not null,
  metadata    jsonb not null default '{}',
  timestamp   timestamptz default now(),

  constraint audit_logs_action_nonempty check (length(trim(action)) > 0)
);

create index idx_audit_user_id   on audit_logs (user_id);
create index idx_audit_action    on audit_logs (action);
create index idx_audit_timestamp on audit_logs (timestamp desc);
create index idx_audit_metadata  on audit_logs using gin (metadata);

comment on table  audit_logs          is 'Immutable audit trail. Never update or delete rows.';
comment on column audit_logs.action   is 'Action name, e.g. user.login, mission.start, token.transfer';
comment on column audit_logs.metadata is 'Contextual data: ip, user_agent, mission_id, amount, etc.';


-- ════════════════════════════════════════════════════════════
-- TABLE: olst_tokens
-- ════════════════════════════════════════════════════════════
create table if not exists olst_tokens (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid not null references users (id) on delete cascade,
  amount      numeric(20, 8) not null,
  tx_hash     text,
  chain       text not null default 'base',
  created_at  timestamptz default now(),

  constraint olst_tokens_amount_nonzero check (amount <> 0),
  constraint olst_tokens_chain_values   check (
    chain in ('base', 'ethereum', 'polygon', 'arbitrum', 'optimism', 'solana')
  ),
  constraint olst_tokens_tx_hash_unique unique (tx_hash)  -- prevent duplicate tx ingestion
);

create index idx_olst_user_id    on olst_tokens (user_id);
create index idx_olst_chain      on olst_tokens (chain);
create index idx_olst_created_at on olst_tokens (created_at desc);
create index idx_olst_tx_hash    on olst_tokens (tx_hash);

comment on table  olst_tokens          is 'OLST token ledger. Positive = received, negative = sent.';
comment on column olst_tokens.amount   is 'OLST amount with 8 decimal places. Positive=credit, negative=debit.';
comment on column olst_tokens.tx_hash  is 'On-chain transaction hash. Unique to prevent double-processing.';
comment on column olst_tokens.chain    is 'Source chain identifier.';


-- ════════════════════════════════════════════════════════════
-- ROW LEVEL SECURITY
-- ════════════════════════════════════════════════════════════

-- users
alter table users           enable row level security;
alter table missions        enable row level security;
alter table audit_logs      enable row level security;
alter table olst_tokens     enable row level security;

-- Users: can only see/update their own row
create policy "users_select_own" on users
  for select using (auth.uid() = id);

create policy "users_update_own" on users
  for update using (auth.uid() = id)
  with check (auth.uid() = id);

-- Missions: full CRUD on own rows (from brief)
create policy "Users see own missions" on missions
  for select using (auth.uid() = user_id);

create policy "missions_insert_own" on missions
  for insert with check (auth.uid() = user_id);

create policy "missions_update_own" on missions
  for update using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "missions_delete_own" on missions
  for delete using (auth.uid() = user_id);

-- Audit logs: read-only for own entries; insert via service role only
create policy "audit_select_own" on audit_logs
  for select using (auth.uid() = user_id);

-- OLST tokens: read own balance; insert via service role only
create policy "olst_select_own" on olst_tokens
  for select using (auth.uid() = user_id);


-- ════════════════════════════════════════════════════════════
-- REALTIME SUBSCRIPTIONS
-- ════════════════════════════════════════════════════════════
-- Enable realtime publication for live mission status updates
-- (missions already has RLS, so only own rows are pushed)

-- Add tables to supabase realtime publication
-- Note: run in Supabase dashboard or via service role connection
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'missions'
  ) then
    alter publication supabase_realtime add table missions;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'olst_tokens'
  ) then
    alter publication supabase_realtime add table olst_tokens;
  end if;
exception when others then
  -- publication may not exist in non-Supabase environments
  raise notice 'supabase_realtime publication not found — skipping';
end $$;


-- ════════════════════════════════════════════════════════════
-- HELPER FUNCTIONS
-- ════════════════════════════════════════════════════════════

-- Hash a PIN with bcrypt (cost=10)
create or replace function hash_pin(pin text)
returns text language sql as $$
  select crypt(pin, gen_salt('bf', 10));
$$;

-- Verify a PIN against its stored hash
create or replace function verify_pin(pin text, hash text)
returns boolean language sql as $$
  select crypt(pin, hash) = hash;
$$;

-- Get OLST balance for a user (sum of all credits/debits)
create or replace function get_olst_balance(p_user_id uuid)
returns numeric language sql stable as $$
  select coalesce(sum(amount), 0)
  from olst_tokens
  where user_id = p_user_id;
$$;

-- Write an audit log entry (called from app layer or triggers)
create or replace function write_audit(
  p_user_id uuid,
  p_action  text,
  p_meta    jsonb default '{}'
)
returns uuid language plpgsql security definer as $$
declare
  v_id uuid := uuid_generate_v4();
begin
  insert into audit_logs (id, user_id, action, metadata)
  values (v_id, p_user_id, p_action, p_meta);
  return v_id;
end;
$$;

-- Auto-audit mission status changes
create or replace function audit_mission_status_change()
returns trigger language plpgsql security definer as $$
begin
  if old.status is distinct from new.status then
    perform write_audit(
      new.user_id,
      'mission.status_change',
      jsonb_build_object(
        'mission_id', new.id,
        'mission',    new.mission,
        'from',       old.status,
        'to',         new.status
      )
    );
  end if;
  return new;
end;
$$;

create trigger trg_audit_mission_status
  after update on missions
  for each row execute function audit_mission_status_change();


-- ════════════════════════════════════════════════════════════
-- VIEWS
-- ════════════════════════════════════════════════════════════

-- User dashboard summary (used by frontend)
create or replace view user_summary as
select
  u.id,
  u.email,
  u.created_at,
  count(distinct m.id)                                          as total_missions,
  count(distinct m.id) filter (where m.status = 'complete')    as completed_missions,
  count(distinct m.id) filter (where m.status = 'failed')      as failed_missions,
  count(distinct al.id)                                         as audit_events,
  coalesce(get_olst_balance(u.id), 0)                          as olst_balance,
  max(m.created_at)                                             as last_mission_at
from users u
left join missions   m  on m.user_id  = u.id
left join audit_logs al on al.user_id = u.id
group by u.id;

-- Mission activity feed (newest first, with user email)
create or replace view mission_feed as
select
  m.id,
  m.mission,
  m.status,
  m.created_at,
  m.updated_at,
  m.payload -> 'output' -> 'total_savings' as total_savings,
  m.payload -> 'model'                     as model,
  (m.payload ->> 'latency_ms')::int        as latency_ms,
  u.email                                  as user_email
from missions m
join users u on u.id = m.user_id
order by m.created_at desc;


-- ════════════════════════════════════════════════════════════
-- SEED: admin user for local dev (remove before production)
-- ════════════════════════════════════════════════════════════
do $$
begin
  if current_setting('app.env', true) = 'development' then
    insert into users (id, email, pin_hash)
    values (
      '00000000-0000-0000-0000-000000000001',
      'admin@olife.dev',
      hash_pin('000000')
    )
    on conflict (email) do nothing;

    perform write_audit(
      '00000000-0000-0000-0000-000000000001',
      'system.seed',
      '{"note": "dev seed user created"}'
    );
  end if;
end $$;
