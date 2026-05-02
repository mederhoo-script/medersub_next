-- Add temporary password column to telegram_login_codes
ALTER TABLE IF EXISTS telegram_login_codes
ADD COLUMN IF NOT EXISTS temporary_password text;

-- Backfill is not attempted here; new login codes will include a temporary password.
