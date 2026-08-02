CREATE TABLE IF NOT EXISTS public.user_notification_settings (
  user_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  push_enabled boolean NOT NULL DEFAULT true,
  transactions_enabled boolean NOT NULL DEFAULT true,
  account_enabled boolean NOT NULL DEFAULT true,
  promos_enabled boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS public.user_push_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  token text NOT NULL UNIQUE,
  platform text NOT NULL DEFAULT 'android',
  device_id text,
  enabled boolean NOT NULL DEFAULT true,
  last_seen_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_user_push_tokens_user_id ON public.user_push_tokens (user_id);
CREATE INDEX IF NOT EXISTS idx_user_push_tokens_enabled ON public.user_push_tokens (enabled);

ALTER TABLE public.user_notification_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_push_tokens ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'user_notification_settings' AND policyname = 'Users can manage own notification settings.'
  ) THEN
    CREATE POLICY "Users can manage own notification settings." ON public.user_notification_settings
      FOR ALL USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'user_push_tokens' AND policyname = 'Users can manage own push tokens.'
  ) THEN
    CREATE POLICY "Users can manage own push tokens." ON public.user_push_tokens
      FOR ALL USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;
