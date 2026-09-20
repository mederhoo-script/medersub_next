-- Keep API-key and public-API authentication columns available on existing databases.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS api_key_hash text,
  ADD COLUMN IF NOT EXISTS api_key_prefix text,
  ADD COLUMN IF NOT EXISTS is_blocked boolean DEFAULT false;

CREATE UNIQUE INDEX IF NOT EXISTS profiles_api_key_hash_unique
  ON public.profiles (api_key_hash)
  WHERE api_key_hash IS NOT NULL;

UPDATE public.profiles
SET api_key_prefix = COALESCE(api_key_prefix, 'Active API key')
WHERE api_key_hash IS NOT NULL
  AND api_key_prefix IS NULL;
