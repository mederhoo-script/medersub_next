CREATE OR REPLACE FUNCTION public.process_korapay_checkout_deposit(
  p_user_id uuid,
  p_amount numeric,
  p_reference text,
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
  existing_status text;
  existing_meta jsonb;
  next_balance numeric;
  gross_amount numeric;
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'KoraPay checkout deposit amount must be positive';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('korapay-checkout:' || p_reference));

  SELECT id, status, meta
    INTO existing_transaction_id, existing_status, existing_meta
    FROM transactions
   WHERE provider = 'korapay'
     AND provider_ref = p_reference
   LIMIT 1
   FOR UPDATE;

  IF existing_transaction_id IS NOT NULL AND lower(COALESCE(existing_status, '')) = 'success' THEN
    SELECT balance INTO next_balance FROM wallets WHERE user_id = p_user_id;
    RETURN jsonb_build_object('status', 'duplicate', 'credited', false, 'balance', COALESCE(next_balance, 0));
  END IF;

  gross_amount := COALESCE(NULLIF(existing_meta->>'principal_amount', '')::numeric, p_amount);

  IF existing_transaction_id IS NOT NULL THEN
    UPDATE transactions
       SET amount = p_amount,
           charged_amount = gross_amount,
           status = 'success',
           meta = COALESCE(existing_meta, '{}'::jsonb) || jsonb_build_object(
             'provider', 'korapay',
             'provider_ref', p_reference,
             'currency', p_currency,
             'payment_status', p_payment_status,
             'source', 'checkout',
             'principal_amount', gross_amount,
             'fee', COALESCE(NULLIF(p_payload->>'fee', '')::numeric, 0),
             'credited_amount', p_amount,
             'payload', p_payload
           )
     WHERE id = existing_transaction_id;
  ELSE
    INSERT INTO transactions (user_id, type, amount, charged_amount, status, reference, provider, provider_ref, meta)
    VALUES (
      p_user_id, 'deposit', p_amount, gross_amount, 'success', p_reference, 'korapay', p_reference,
      jsonb_build_object(
        'provider', 'korapay',
        'provider_ref', p_reference,
        'currency', p_currency,
        'payment_status', p_payment_status,
        'source', 'checkout',
        'principal_amount', gross_amount,
        'fee', COALESCE(NULLIF(p_payload->>'fee', '')::numeric, 0),
        'credited_amount', p_amount,
        'payload', p_payload
      )
    );
  END IF;

  INSERT INTO wallets (user_id, balance)
  VALUES (p_user_id, p_amount)
  ON CONFLICT (user_id) DO UPDATE SET balance = wallets.balance + EXCLUDED.balance
  RETURNING balance INTO next_balance;

  RETURN jsonb_build_object('status', 'credited', 'credited', true, 'balance', next_balance, 'credited_amount', p_amount);
END;
$$;

REVOKE ALL ON FUNCTION public.process_korapay_checkout_deposit(uuid, numeric, text, text, text, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.process_korapay_checkout_deposit(uuid, numeric, text, text, text, jsonb) TO service_role;
