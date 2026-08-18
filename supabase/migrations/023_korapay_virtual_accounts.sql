-- ============================================================
-- Migration 023: KoraPay Virtual Accounts + Webhook Idempotency
-- ============================================================

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS bvn text,
  ADD COLUMN IF NOT EXISTS nin text;

ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS charged_amount numeric,
  ADD COLUMN IF NOT EXISTS provider text,
  ADD COLUMN IF NOT EXISTS provider_ref text;

CREATE TABLE IF NOT EXISTS virtual_accounts (
  id                 uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id            uuid        REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  provider           text        NOT NULL,
  account_reference  text        NOT NULL UNIQUE,
  account_number     text        NOT NULL,
  account_name       text        NOT NULL,
  bank_name          text        NOT NULL,
  bank_code          text,
  currency           text        NOT NULL DEFAULT 'NGN',
  status             text        NOT NULL DEFAULT 'active',
  raw_response       jsonb,
  created_at         timestamptz DEFAULT now() NOT NULL,
  UNIQUE (user_id, provider)
);

ALTER TABLE virtual_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own virtual accounts" ON virtual_accounts
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own virtual accounts" ON virtual_accounts
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own virtual accounts" ON virtual_accounts
  FOR UPDATE USING (auth.uid() = user_id);

INSERT INTO system_settings (key, value)
VALUES ('payment_provider', '"monnify"')
ON CONFLICT (key) DO NOTHING;

CREATE UNIQUE INDEX IF NOT EXISTS virtual_accounts_user_provider_unique
  ON virtual_accounts(user_id, provider);

CREATE INDEX IF NOT EXISTS virtual_accounts_account_reference_idx
  ON virtual_accounts(account_reference);

CREATE INDEX IF NOT EXISTS transactions_reference_idx
  ON transactions(reference);
