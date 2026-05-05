-- Add UNIQUE constraint to telegram_id so the same Telegram account cannot be
-- linked to more than one Supabase profile.
-- The column was added (without uniqueness) in migration 004.
-- We must handle any existing duplicate values before adding the constraint.
-- In practice the column should be empty on fresh deployments, but we guard
-- against accidental duplicates by keeping only the oldest row per telegram_id.

DO $$
BEGIN
  -- Remove duplicate telegram_id values, keeping the earliest-created row
  DELETE FROM profiles
  WHERE id IN (
    SELECT id FROM (
      SELECT id,
             ROW_NUMBER() OVER (
               PARTITION BY telegram_id
               ORDER BY created_at ASC
             ) AS rn
      FROM profiles
      WHERE telegram_id IS NOT NULL
    ) sub
    WHERE rn > 1
  );

  -- Drop the non-unique index added in migration 004 (replaced by the UNIQUE one below)
  DROP INDEX IF EXISTS idx_profiles_telegram_id;

  -- Add a proper UNIQUE constraint (also creates a unique index)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'profiles'
      AND constraint_name = 'profiles_telegram_id_unique'
  ) THEN
    ALTER TABLE profiles
      ADD CONSTRAINT profiles_telegram_id_unique UNIQUE (telegram_id);
  END IF;
END $$;
