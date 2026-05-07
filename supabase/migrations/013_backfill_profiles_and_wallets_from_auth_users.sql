-- Backfill missing profiles and wallets for auth.users rows, including
-- Telegram-created accounts that were left without related public records.

CREATE OR REPLACE FUNCTION public.handle_new_profile()
RETURNS trigger AS $$
BEGIN
  BEGIN
    INSERT INTO public.wallets (user_id, balance)
    VALUES (new.id, 0)
    ON CONFLICT (user_id) DO NOTHING;
  EXCEPTION
    WHEN OTHERS THEN
      RAISE WARNING 'handle_new_profile: could not insert wallet for id=% - %: %',
        new.id, SQLSTATE, SQLERRM;
  END;

  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_profile_created ON public.profiles;

CREATE TRIGGER on_profile_created
  AFTER INSERT ON public.profiles
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_profile();

INSERT INTO public.profiles (
  id,
  email,
  full_name,
  role,
  balance,
  telegram_id,
  telegram_username,
  telegram_linked_at
)
SELECT
  au.id,
  au.email,
  COALESCE(
    NULLIF(BTRIM(au.raw_user_meta_data->>'full_name'), ''),
    NULLIF(
      BTRIM(
        CONCAT_WS(
          ' ',
          au.raw_user_meta_data->>'first_name',
          au.raw_user_meta_data->>'last_name'
        )
      ),
      ''
    ),
    NULLIF(BTRIM(au.raw_user_meta_data->>'name'), ''),
    au.email
  ),
  COALESCE(NULLIF(au.raw_user_meta_data->>'role', ''), 'USER'),
  0,
  NULLIF(au.raw_user_meta_data->>'telegram_id', ''),
  NULLIF(au.raw_user_meta_data->>'telegram_username', ''),
  CASE
    WHEN COALESCE(NULLIF(au.raw_user_meta_data->>'telegram_id', ''), '') <> ''
      THEN COALESCE(au.updated_at, au.created_at, timezone('utc'::text, now()))
    ELSE NULL
  END
FROM auth.users au
LEFT JOIN public.profiles p
  ON p.id = au.id
WHERE p.id IS NULL
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.wallets (user_id, balance)
SELECT p.id, 0
FROM public.profiles p
LEFT JOIN public.wallets w
  ON w.user_id = p.id
WHERE w.user_id IS NULL
ON CONFLICT (user_id) DO NOTHING;
