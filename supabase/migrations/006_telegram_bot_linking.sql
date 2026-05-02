-- Table for storing temporary telegram linking codes
CREATE TABLE IF NOT EXISTS telegram_links (
  code text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamp with time zone DEFAULT timezone('utc', now()) NOT NULL,
  expires_at timestamp with time zone DEFAULT timezone('utc', now() + interval '30 minutes') NOT NULL
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_telegram_links_expires_at ON telegram_links(expires_at);
