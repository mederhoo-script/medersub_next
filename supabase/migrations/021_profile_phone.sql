ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS phone text;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  BEGIN
    INSERT INTO public.profiles (
      id,
      email,
      full_name,
      role,
      phone,
      telegram_id,
      telegram_username,
      telegram_linked_at
    )
    VALUES (
      new.id,
      new.email,
      new.raw_user_meta_data->>'full_name',
      'USER',
      nullif(new.raw_user_meta_data->>'phone', ''),
      nullif(new.raw_user_meta_data->>'telegram_id', ''),
      nullif(new.raw_user_meta_data->>'telegram_username', ''),
      CASE
        WHEN nullif(new.raw_user_meta_data->>'telegram_id', '') IS NOT NULL
          THEN coalesce(new.created_at, timezone('utc'::text, now()))
        ELSE NULL
      END
    )
    ON CONFLICT (id) DO NOTHING;
  EXCEPTION
    WHEN others THEN
      RAISE WARNING 'handle_new_user: could not insert profile for id=% - %: %', new.id, SQLSTATE, SQLERRM;
  END;
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;