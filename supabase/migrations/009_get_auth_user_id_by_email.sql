-- Helper function to look up an auth user ID by email.
-- Used as a fallback in the Telegram webhook when createUser fails (e.g. due to
-- an orphaned auth.users record) and no matching profiles row exists.
-- SECURITY DEFINER runs with the privileges of the function owner, allowing
-- access to auth.users from application code via supabaseAdmin.rpc().
CREATE OR REPLACE FUNCTION public.get_auth_user_id_by_email(p_email text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = auth, pg_temp
AS $$
BEGIN
  IF p_email IS NULL OR p_email = '' THEN
    RETURN NULL;
  END IF;
  RETURN (SELECT id FROM auth.users WHERE email = p_email LIMIT 1);
END;
$$;
