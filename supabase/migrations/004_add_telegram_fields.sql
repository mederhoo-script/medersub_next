-- Add Telegram identity fields to profiles
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS telegram_id text;

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS telegram_username text;

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS telegram_linked_at timestamp with time zone;

-- Index for quick lookup by telegram_id
CREATE INDEX IF NOT EXISTS idx_profiles_telegram_id ON profiles(telegram_id);
