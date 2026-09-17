-- Scale v1: entitlements, usage ledger, credit wallet, founding + referral counters.
-- Money truth = server (Neon when DATABASE_URL set). Never store provider API keys here.
-- user_id TEXT matches Better Auth "user"."id".

create table if not exists entitlements (
  user_id text primary key references "user" ("id") on delete cascade,
  plan text not null default 'free'
    check (plan in ('free', 'pro', 'premium')),
  billing_interval text
    check (billing_interval is null or billing_interval in ('monthly', 'annual')),
  stripe_customer_id text unique,
  stripe_subscription_id text unique,
  period_start timestamptz,
  period_end timestamptz,
  buffer_rate_bps integer not null default 1200
    check (buffer_rate_bps between 1000 and 1500),
  buffer_cents_total integer not null default 0 check (buffer_cents_total >= 0),
  buffer_cents_remaining integer not null default 0 check (buffer_cents_remaining >= 0),
  is_founding boolean not null default false,
  founding_bonus_pro_months integer not null default 0 check (founding_bonus_pro_months >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint entitlements_buffer_leq_total
    check (buffer_cents_remaining <= buffer_cents_total),
  constraint entitlements_free_zero_buffer
    check (plan <> 'free' or (buffer_cents_total = 0 and buffer_cents_remaining = 0))
);

create index if not exists entitlements_stripe_customer_idx
  on entitlements (stripe_customer_id);
create index if not exists entitlements_plan_period_idx
  on entitlements (plan, period_end);

create table if not exists usage_ledger (
  id text primary key,
  user_id text not null references "user" ("id") on delete cascade,
  created_at timestamptz not null default now(),
  kind text not null
    check (kind in ('mesh_debit', 'period_reset', 'credit_spend', 'credit_grant', 'adjust')),
  seat text
    check (seat is null or seat in ('architect', 'coder', 'visual', 'security')),
  provider text,
  model_id text,
  tokens_in integer check (tokens_in is null or tokens_in >= 0),
  tokens_out integer check (tokens_out is null or tokens_out >= 0),
  cents_delta integer not null,
  buffer_remaining_after integer check (buffer_remaining_after is null or buffer_remaining_after >= 0),
  stripe_event_id text,
  mesh_run_id text,
  meta jsonb not null default '{}'::jsonb
);

create index if not exists usage_ledger_user_created_idx
  on usage_ledger (user_id, created_at desc);
create index if not exists usage_ledger_user_period_idx
  on usage_ledger (user_id, kind, created_at desc);
create unique index if not exists usage_ledger_stripe_event_uidx
  on usage_ledger (stripe_event_id)
  where stripe_event_id is not null;

create table if not exists credit_wallets (
  user_id text primary key references "user" ("id") on delete cascade,
  credit_cents integer not null default 0 check (credit_cents >= 0),
  updated_at timestamptz not null default now()
);

create table if not exists founding_counters (
  id text primary key default 'global',
  paid_pro_seats integer not null default 0 check (paid_pro_seats >= 0),
  cap integer not null default 50 check (cap > 0),
  updated_at timestamptz not null default now()
);

insert into founding_counters (id, paid_pro_seats, cap)
values ('global', 0, 50)
on conflict (id) do nothing;

create table if not exists referrals (
  id text primary key,
  referrer_user_id text not null references "user" ("id") on delete cascade,
  referee_user_id text not null references "user" ("id") on delete cascade,
  status text not null default 'pending'
    check (status in ('pending', 'paid', 'rewarded', 'rejected')),
  reward_days integer not null default 14 check (reward_days >= 0),
  rewarded_at timestamptz,
  created_at timestamptz not null default now(),
  unique (referee_user_id)
);

create index if not exists referrals_referrer_idx on referrals (referrer_user_id, created_at desc);

create table if not exists referral_reward_limits (
  referrer_user_id text primary key references "user" ("id") on delete cascade,
  rewards_this_month integer not null default 0 check (rewards_this_month >= 0),
  month_key text not null default '',
  rewards_lifetime_free_origin integer not null default 0 check (rewards_lifetime_free_origin >= 0),
  updated_at timestamptz not null default now()
);
