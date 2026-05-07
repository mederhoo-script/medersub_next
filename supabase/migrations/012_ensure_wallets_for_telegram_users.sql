-- Ensure wallets table exists and is safe to upsert by user_id.
CREATE TABLE IF NOT EXISTS wallets (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  balance numeric DEFAULT 0 NOT NULL,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS wallets_user_id_key ON wallets (user_id);

ALTER TABLE wallets ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'wallets'
      AND policyname = 'Users can view own wallet.'
  ) THEN
    CREATE POLICY "Users can view own wallet." ON wallets
      FOR SELECT USING (auth.uid() = user_id);
  END IF;
END;
$$;

-- Backfill: create a zero-balance wallet for every profile that does not yet
-- have a wallet row. This remains idempotent.
INSERT INTO wallets (user_id, balance)
SELECT id, 0
FROM profiles p
WHERE NOT EXISTS (SELECT 1 FROM wallets w WHERE w.user_id = p.id)
ON CONFLICT (user_id) DO NOTHING;
