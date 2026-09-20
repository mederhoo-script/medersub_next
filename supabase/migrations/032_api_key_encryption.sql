-- Store an encrypted copy so authenticated users can view their current key.
-- The encryption secret stays in the application environment, never in Supabase.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS api_key_encrypted text;