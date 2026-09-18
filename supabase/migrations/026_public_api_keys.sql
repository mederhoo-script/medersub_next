-- A single hashed public API key per Medersub profile. The plaintext key is only
-- returned at rotation time and is never persisted in the database.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS api_key_hash text;

CREATE UNIQUE INDEX IF NOT EXISTS profiles_api_key_hash_unique
  ON public.profiles (api_key_hash)
  WHERE api_key_hash IS NOT NULL;
