-- Make the handle_new_user trigger idempotent.
-- Previously, a duplicate insert (same id) would raise a primary-key violation,
-- causing auth.admin.createUser() to return 500 "Database error creating new user"
-- on any retry. ON CONFLICT (id) DO NOTHING prevents that.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role, balance)
  VALUES (new.id, new.email, new.raw_user_meta_data->>'full_name', 'USER', 0)
  ON CONFLICT (id) DO NOTHING;
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
