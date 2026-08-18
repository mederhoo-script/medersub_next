-- Make KoraPay webhook processing idempotent and atomic.
CREATE OR REPLACE FUNCTION public.process_korapay_deposit(
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
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'KoraPay deposit amount must be positive';
  END IF;

  IF NOT EXISTS (
    SELECT 1
      FROM virtual_accounts
     WHERE user_id = p_user_id
       AND provider = 'korapay'
       AND account_reference = p_account_reference
  ) THEN
    RAISE EXCEPTION 'KoraPay account reference does not belong to user';
  END IF;

  -- Serialize retries and concurrent deliveries for the same provider reference.
  PERFORM pg_advisory_xact_lock(hashtext('korapay:' || p_reference));

  SELECT id
    INTO existing_transaction_id
    FROM transactions
     WHERE (
         provider = 'korapay'
         OR meta->>'provider' = 'korapay'
       )
       AND (
         provider_ref = p_reference
         OR reference = p_reference
         OR meta->>'provider_ref' = p_reference
       )
   LIMIT 1;

  IF existing_transaction_id IS NOT NULL THEN
    SELECT balance
      INTO current_balance
      FROM wallets
     WHERE user_id = p_user_id;

    RETURN jsonb_build_object(
      'status', 'duplicate',
      'credited', false,
      'balance', COALESCE(current_balance, 0)
    );
  END IF;

  INSERT INTO transactions (
    user_id,
    type,
    amount,
    charged_amount,
    status,
    reference,
    provider,
    provider_ref,
    meta
  ) VALUES (
    p_user_id,
    'deposit',
    p_amount,
    p_amount,
    'success',
    p_reference,
    'korapay',
    p_reference,
    jsonb_build_object(
      'provider', 'korapay',
      'provider_ref', p_reference,
      'account_reference', p_account_reference,
      'currency', p_currency,
      'payment_status', p_payment_status,
      'source', 'virtual_bank_account',
      'payload', p_payload
    )
  );

  INSERT INTO wallets (user_id, balance)
  VALUES (p_user_id, p_amount)
  ON CONFLICT (user_id) DO UPDATE
    SET balance = wallets.balance + EXCLUDED.balance
  RETURNING balance INTO next_balance;

  RETURN jsonb_build_object(
    'status', 'credited',
    'credited', true,
    'balance', next_balance
  );
END;
$$;

REVOKE ALL ON FUNCTION public.process_korapay_deposit(
  uuid, numeric, text, text, text, text, jsonb
) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.process_korapay_deposit(
  uuid, numeric, text, text, text, text, jsonb
) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.process_korapay_deposit(
  uuid, numeric, text, text, text, text, jsonb
) TO service_role;