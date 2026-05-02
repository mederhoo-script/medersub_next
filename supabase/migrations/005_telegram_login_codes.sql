-- Temporary table for telegram auto-login codes
CREATE TABLE IF NOT EXISTS telegram_login_codes (
  code text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamp with time zone DEFAULT timezone('utc', now()) NOT NULL,
  expires_at timestamp with time zone DEFAULT timezone('utc', now() + interval '15 minutes') NOT NULL
);

-- Clean up expired codes (run periodically or via cron)
DELETE FROM telegram_login_codes WHERE expires_at < now();
