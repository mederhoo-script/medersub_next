CREATE TABLE public.transaction_biometric_credentials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  credential_id text NOT NULL UNIQUE,
  public_key bytea NOT NULL,
  counter bigint NOT NULL DEFAULT 0,
  transports jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE TABLE public.transaction_biometric_challenges (
  user_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  challenge text NOT NULL,
  purpose text NOT NULL CHECK (purpose IN ('enroll', 'purchase')),
  expires_at timestamptz NOT NULL
);

CREATE TABLE public.transaction_biometric_approvals (
  token uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz
);

ALTER TABLE public.transaction_biometric_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transaction_biometric_challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transaction_biometric_approvals ENABLE ROW LEVEL SECURITY;
