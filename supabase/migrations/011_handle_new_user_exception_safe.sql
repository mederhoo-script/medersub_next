-- Make the handle_new_user trigger completely exception-safe.
--
-- Migration 008 added ON CONFLICT (id) DO NOTHING to handle idempotent
-- retries, but any *other* error in the INSERT (unexpected constraint
-- violations, RLS edge-cases, etc.) would still propagate out of the
-- trigger function and cause Supabase Auth to roll back the entire
-- auth.admin.createUser() transaction, returning the opaque
-- "Database error creating new user" (unexpected_failure / 500) error.
--
-- This migration wraps the entire function body in a BEGIN…EXCEPTION
-- block so that *any* database error during profile creation is caught,
-- logged as a WARNING (visible in Supabase dashboard logs), and then
-- suppressed. The auth user record is always written successfully.
-- The application-level code that follows createUser already handles
-- the case where no profile row exists (ensureProfileRow / upsertProfile).

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role, balance)
  VALUES (
    new.id,
    new.email,
    new.raw_user_meta_data->>'full_name',
    'USER',
    0
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN new;
EXCEPTION
  WHEN OTHERS THEN
    -- Log the problem but never let a profile-insert error abort the
    -- auth user creation.  The calling code (tg-auth / webhook) will
    -- upsert the profile row itself after createUser returns.
    RAISE WARNING 'handle_new_user: could not insert profile for id=%, email=% — %: %',
      new.id, new.email, SQLSTATE, SQLERRM;
    RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
