ALTER TABLE public.virtual_accounts
  ADD COLUMN IF NOT EXISTS account_mode text NOT NULL DEFAULT 'personal',
  ADD COLUMN IF NOT EXISTS daily_limit numeric;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'virtual_accounts_account_mode_check'
       AND conrelid = 'public.virtual_accounts'::regclass
  ) THEN
    ALTER TABLE public.virtual_accounts
      ADD CONSTRAINT virtual_accounts_account_mode_check
      CHECK (account_mode IN ('personal', 'default'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'virtual_accounts_daily_limit_check'
       AND conrelid = 'public.virtual_accounts'::regclass
  ) THEN
    ALTER TABLE public.virtual_accounts
      ADD CONSTRAINT virtual_accounts_daily_limit_check
      CHECK (daily_limit IS NULL OR daily_limit > 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'virtual_accounts_account_mode_limit_check'
       AND conrelid = 'public.virtual_accounts'::regclass
  ) THEN
    ALTER TABLE public.virtual_accounts
      ADD CONSTRAINT virtual_accounts_account_mode_limit_check
      CHECK (
        (account_mode = 'personal' AND daily_limit IS NULL)
        OR (account_mode = 'default' AND daily_limit IS NOT NULL AND daily_limit > 0)
      );
  END IF;
END;
$$;

ALTER TABLE public.virtual_accounts
  DROP CONSTRAINT IF EXISTS virtual_accounts_user_id_provider_key;

DROP INDEX IF EXISTS public.virtual_accounts_user_provider_unique;

CREATE UNIQUE INDEX IF NOT EXISTS virtual_accounts_user_provider_mode_unique
  ON public.virtual_accounts(user_id, provider, account_mode);

CREATE OR REPLACE FUNCTION public.process_squad_deposit(
  p_user_id uuid,
  p_amount numeric,
  p_reference text,
  p_account_reference text,
  p_currency text,
  p_payment_status text,
  p_payload jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  existing_transaction_id uuid;
  current_balance numeric;
  next_balance numeric;
  account_mode_value text;
  daily_limit_value numeric;
  daily_total numeric;
  local_today date := (now() AT TIME ZONE 'Africa/Lagos')::date;
  local_day_start timestamptz := ((now() AT TIME ZONE 'Africa/Lagos')::date)::timestamp AT TIME ZONE 'Africa/Lagos';
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'Squad deposit amount must be positive';
  END IF;

  SELECT account_mode, daily_limit
    INTO account_mode_value, daily_limit_value
    FROM virtual_accounts
   WHERE user_id = p_user_id
     AND provider = 'squad'
     AND account_reference = p_account_reference;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Squad account reference does not belong to user';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('squad:' || p_reference));

  SELECT id
    INTO existing_transaction_id
    FROM transactions
   WHERE (provider = 'squad' OR meta->>'provider' = 'squad')
     AND (provider_ref = p_reference OR reference = p_reference OR meta->>'provider_ref' = p_reference)
   LIMIT 1;

  IF existing_transaction_id IS NOT NULL THEN
    SELECT balance INTO current_balance FROM wallets WHERE user_id = p_user_id;
    RETURN jsonb_build_object('status', 'duplicate', 'credited', false, 'balance', COALESCE(current_balance, 0));
  END IF;

  IF account_mode_value = 'default' AND daily_limit_value IS NOT NULL THEN
    PERFORM pg_advisory_xact_lock(hashtext('squad-daily:' || p_account_reference || ':' || local_today::text));

    SELECT COALESCE(SUM(amount), 0)
      INTO daily_total
      FROM transactions
     WHERE user_id = p_user_id
       AND provider = 'squad'
       AND type = 'deposit'
       AND status = 'success'
       AND meta->>'account_reference' = p_account_reference
       AND created_at >= local_day_start
       AND created_at < local_day_start + interval '1 day';

    IF daily_total + p_amount > daily_limit_value THEN
      INSERT INTO transactions (user_id, type, amount, charged_amount, status, reference, provider, provider_ref, meta)
      VALUES (
        p_user_id, 'deposit', p_amount, p_amount, 'pending', p_reference, 'squad', p_reference,
        jsonb_build_object(
          'provider', 'squad',
          'provider_ref', p_reference,
          'account_reference', p_account_reference,
          'currency', p_currency,
          'payment_status', p_payment_status,
          'source', 'virtual_bank_account',
          'review_reason', 'daily_limit_exceeded',
          'daily_limit', daily_limit_value,
          'credited_today', daily_total,
          'payload', p_payload
        )
      );
      SELECT balance INTO current_balance FROM wallets WHERE user_id = p_user_id;
      RETURN jsonb_build_object(
        'status', 'limit_exceeded',
        'credited', false,
        'daily_limit', daily_limit_value,
        'credited_today', daily_total,
        'balance', COALESCE(current_balance, 0)
      );
    END IF;
  END IF;

  INSERT INTO transactions (user_id, type, amount, charged_amount, status, reference, provider, provider_ref, meta)
  VALUES (
    p_user_id, 'deposit', p_amount, p_amount, 'success', p_reference, 'squad', p_reference,
    jsonb_build_object(
      'provider', 'squad',
      'provider_ref', p_reference,
      'account_reference', p_account_reference,
      'account_mode', account_mode_value,
      'currency', p_currency,
      'payment_status', p_payment_status,
      'source', 'virtual_bank_account',
      'payload', p_payload
    )
  );

  INSERT INTO wallets (user_id, balance)
  VALUES (p_user_id, p_amount)
  ON CONFLICT (user_id) DO UPDATE SET balance = wallets.balance + EXCLUDED.balance
  RETURNING balance INTO next_balance;

  RETURN jsonb_build_object('status', 'credited', 'credited', true, 'balance', next_balance);
END;
$$;

REVOKE ALL ON FUNCTION public.process_squad_deposit(uuid, numeric, text, text, text, text, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.process_squad_deposit(uuid, numeric, text, text, text, text, jsonb) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.process_squad_deposit(uuid, numeric, text, text, text, text, jsonb) TO service_role;