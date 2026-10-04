INSERT INTO public.system_settings (key, value)
VALUES ('general', '{"squad_deposit_fee": 0}'::jsonb)
ON CONFLICT (key) DO UPDATE
SET value = COALESCE(public.system_settings.value, '{}'::jsonb)
          || jsonb_build_object('squad_deposit_fee', COALESCE(public.system_settings.value->'squad_deposit_fee', '0'::jsonb)),
    updated_at = now();

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
  configured_fee numeric := 0;
  credited_amount numeric;
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

  SELECT CASE
           WHEN (value->>'squad_deposit_fee') ~ '^\d+(\.\d{1,2})?$'
             THEN LEAST((value->>'squad_deposit_fee')::numeric, 100000)
           ELSE 0
         END
    INTO configured_fee
    FROM system_settings
   WHERE key = 'general';
  configured_fee := COALESCE(configured_fee, 0);

  IF p_amount <= configured_fee THEN
    INSERT INTO transactions (user_id, type, amount, charged_amount, status, reference, provider, provider_ref, meta)
    VALUES (
      p_user_id, 'deposit', 0, p_amount, 'pending', p_reference, 'squad', p_reference,
      jsonb_build_object(
        'provider', 'squad',
        'provider_ref', p_reference,
        'account_reference', p_account_reference,
        'account_mode', account_mode_value,
        'currency', p_currency,
        'payment_status', p_payment_status,
        'source', 'virtual_bank_account',
        'review_reason', 'deposit_not_greater_than_fee',
        'principal_amount', p_amount,
        'configured_fee', configured_fee,
        'payload', p_payload
      )
    );
    SELECT balance INTO current_balance FROM wallets WHERE user_id = p_user_id;
    RETURN jsonb_build_object(
      'status', 'fee_exceeds_deposit',
      'credited', false,
      'principal_amount', p_amount,
      'configured_fee', configured_fee,
      'balance', COALESCE(current_balance, 0)
    );
  END IF;

  credited_amount := p_amount - configured_fee;

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

    IF daily_total + credited_amount > daily_limit_value THEN
      INSERT INTO transactions (user_id, type, amount, charged_amount, status, reference, provider, provider_ref, meta)
      VALUES (
        p_user_id, 'deposit', credited_amount, p_amount, 'pending', p_reference, 'squad', p_reference,
        jsonb_build_object(
          'provider', 'squad',
          'provider_ref', p_reference,
          'account_reference', p_account_reference,
          'account_mode', account_mode_value,
          'currency', p_currency,
          'payment_status', p_payment_status,
          'source', 'virtual_bank_account',
          'review_reason', 'daily_limit_exceeded',
          'daily_limit', daily_limit_value,
          'credited_today', daily_total,
          'principal_amount', p_amount,
          'platform_fee', configured_fee,
          'credited_amount', credited_amount,
          'payload', p_payload
        )
      );
      SELECT balance INTO current_balance FROM wallets WHERE user_id = p_user_id;
      RETURN jsonb_build_object(
        'status', 'limit_exceeded',
        'credited', false,
        'daily_limit', daily_limit_value,
        'credited_today', daily_total,
        'principal_amount', p_amount,
        'platform_fee', configured_fee,
        'credited_amount', credited_amount,
        'balance', COALESCE(current_balance, 0)
      );
    END IF;
  END IF;

  INSERT INTO transactions (user_id, type, amount, charged_amount, status, reference, provider, provider_ref, meta)
  VALUES (
    p_user_id, 'deposit', credited_amount, p_amount, 'success', p_reference, 'squad', p_reference,
    jsonb_build_object(
      'provider', 'squad',
      'provider_ref', p_reference,
      'account_reference', p_account_reference,
      'account_mode', account_mode_value,
      'currency', p_currency,
      'payment_status', p_payment_status,
      'source', 'virtual_bank_account',
      'principal_amount', p_amount,
      'platform_fee', configured_fee,
      'credited_amount', credited_amount,
      'payload', p_payload
    )
  );

  INSERT INTO wallets (user_id, balance)
  VALUES (p_user_id, credited_amount)
  ON CONFLICT (user_id) DO UPDATE SET balance = wallets.balance + EXCLUDED.balance
  RETURNING balance INTO next_balance;

  RETURN jsonb_build_object(
    'status', 'credited',
    'credited', true,
    'principal_amount', p_amount,
    'platform_fee', configured_fee,
    'credited_amount', credited_amount,
    'balance', next_balance
  );
END;
$$;

REVOKE ALL ON FUNCTION public.process_squad_deposit(uuid, numeric, text, text, text, text, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.process_squad_deposit(uuid, numeric, text, text, text, text, jsonb) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.process_squad_deposit(uuid, numeric, text, text, text, text, jsonb) TO service_role;
