-- Ensure profiles created before and after API v1 have an API key hash. The
-- plaintext key is intentionally never stored; users can rotate it in Account
-- Settings to obtain a new key they can save.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS api_key_prefix text;

UPDATE public.profiles
SET api_key_hash = encode(digest('ms_live_' || encode(gen_random_bytes(24), 'hex'), 'sha256'), 'hex'),
    api_key_prefix = COALESCE(api_key_prefix, 'Active API key')
WHERE api_key_hash IS NULL;

CREATE OR REPLACE FUNCTION public.assign_profile_api_key()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.api_key_hash IS NULL THEN
    NEW.api_key_hash := encode(digest('ms_live_' || encode(gen_random_bytes(24), 'hex'), 'sha256'), 'hex');
    NEW.api_key_prefix := 'Active API key';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS assign_profile_api_key_before_insert ON public.profiles;
CREATE TRIGGER assign_profile_api_key_before_insert
  BEFORE INSERT ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.assign_profile_api_key();
