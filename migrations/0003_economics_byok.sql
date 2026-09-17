-- Economics delta: included API buffer = 0% on owner-keys path.
-- Burn SoT = credit_wallets (+ optional BYOK). Never store plaintext provider keys.

-- Document intent: buffer columns remain for ledger compatibility but must stay 0
-- when studio keys are owner-funded (no %-of-sub subsidy).
alter table entitlements
  drop constraint if exists entitlements_free_zero_buffer;

alter table entitlements
  add constraint entitlements_owner_keys_zero_buffer
  check (buffer_cents_total = 0 and buffer_cents_remaining = 0);

comment on column entitlements.buffer_cents_total is
  'Deprecated as included subsidy on owner-keys path; always 0. Usage burns credit_wallets or BYOK.';
comment on column entitlements.buffer_cents_remaining is
  'Deprecated as included subsidy on owner-keys path; always 0.';

-- Ensure wallets exist for every future entitlement user (app inserts on signup/webhook).
alter table credit_wallets
  add column if not exists created_at timestamptz not null default now();

alter table founding_counters
  add column if not exists created_at timestamptz not null default now();

-- BYOK: per-user per-provider secrets, encrypted at rest (ciphertext only).
create table if not exists byok_credentials (
  id text primary key,
  user_id text not null references "user" ("id") on delete cascade,
  provider text not null
    check (provider in ('openai', 'anthropic', 'xai')),
  ciphertext text not null,
  nonce text not null,
  key_version text not null default 'v1',
  label text,
  last_used_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, provider)
);

create index if not exists byok_credentials_user_idx
  on byok_credentials (user_id);

comment on table byok_credentials is
  'BYOK provider secrets encrypted at rest. Decrypt only in server provider adapters. Never return raw keys to client.';
