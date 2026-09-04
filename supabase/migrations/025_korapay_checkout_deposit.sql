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
  next_balance numeric;
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'KoraPay checkout amount must be positive';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('korapay-checkout:' || p_reference));

  SELECT id INTO existing_transaction_id
  FROM transactions
  WHERE provider = 'korapay' AND provider_ref = p_reference
  LIMIT 1;

  IF existing_transaction_id IS NOT NULL THEN
    SELECT balance INTO next_balance FROM wallets WHERE user_id = p_user_id;
    RETURN jsonb_build_object('status', 'duplicate', 'credited', false, 'balance', COALESCE(next_balance, 0));
  END IF;

  INSERT INTO transactions (user_id, type, amount, charged_amount, status, reference, provider, provider_ref, meta)
  VALUES (
    p_user_id, 'deposit', p_amount, p_amount, 'success', p_reference, 'korapay', p_reference,
    jsonb_build_object('provider', 'korapay', 'provider_ref', p_reference, 'currency', p_currency,
      'payment_status', p_payment_status, 'source', 'checkout', 'payload', p_payload)
  );

  INSERT INTO wallets (user_id, balance) VALUES (p_user_id, p_amount)
  ON CONFLICT (user_id) DO UPDATE SET balance = wallets.balance + EXCLUDED.balance
  RETURNING balance INTO next_balance;

  RETURN jsonb_build_object('status', 'credited', 'credited', true, 'balance', next_balance);
END;
$$;

REVOKE ALL ON FUNCTION public.process_korapay_checkout_deposit(uuid, numeric, text, text, text, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.process_korapay_checkout_deposit(uuid, numeric, text, text, text, jsonb) TO service_role;
