ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS transaction_pin_hash text,
ADD COLUMN IF NOT EXISTS transaction_pin_updated_at timestamptz,
ADD COLUMN IF NOT EXISTS transaction_pin_changed boolean NOT NULL DEFAULT false;

-- The initial PIN is 1234. Existing accounts are reset and must replace it
-- before they can make a purchase.
ALTER TABLE public.profiles
ALTER COLUMN transaction_pin_hash SET DEFAULT 'pbkdf2_sha256$120000$c89219fa6ec65b23af5bc8c8e2ff8571$504302a502da6be5d7469a15f7731646fbbddb2bb73071000da8483190ce4ade';

UPDATE public.profiles
SET transaction_pin_hash = 'pbkdf2_sha256$120000$c89219fa6ec65b23af5bc8c8e2ff8571$504302a502da6be5d7469a15f7731646fbbddb2bb73071000da8483190ce4ade',
    transaction_pin_changed = false,
    transaction_pin_updated_at = timezone('utc'::text, now());

COMMENT ON COLUMN public.profiles.transaction_pin_hash IS 'PBKDF2 hash of the user transaction PIN in the format pbkdf2_sha256$iterations$salt$hash.';
COMMENT ON COLUMN public.profiles.transaction_pin_updated_at IS 'Timestamp of the last transaction PIN update.';
COMMENT ON COLUMN public.profiles.transaction_pin_changed IS 'Whether the user has replaced the initial transaction PIN.';
