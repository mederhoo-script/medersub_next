import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { getKoraPayCharge, normalizeAmount, normalizeCurrency } from '@/lib/korapay';

function lookupDuplicateTransaction(reference: string) {
  return supabaseAdmin
    .from('transactions')
    .select('*')
    .eq('reference', reference)
    .limit(50);
}

export async function POST(req: Request) {
  const startedAt = Date.now();
  const requestId = crypto.randomUUID();
  const log = (message: string, details?: Record<string, unknown>) => {
    console.log(`[korapay-webhook][${requestId}] ${message}`, {
      ...(details || {}),
      elapsedMs: Date.now() - startedAt,
    });
  };

  log('Request received', {
    method: req.method,
    url: req.url,
    contentType: req.headers.get('content-type'),
    hasSignature: Boolean(req.headers.get('x-korapay-signature')),
  });

  const rawBody = await req.text();
  log('Request body read', { bodyLength: rawBody.length });
  const signature = req.headers.get('x-korapay-signature') || req.headers.get('X-Korapay-Signature');

  let payload: any;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    log('Rejected: invalid JSON payload');
    return NextResponse.json({ error: 'Invalid webhook payload.' }, { status: 400 });
  }

  log('Payload parsed', { payload: JSON.stringify(payload, null, 2) });

  if (signature) {
    log('Signature found; verifying', {
      signatureLength: signature.trim().length,
      signatureFormat: /^sha256=/i.test(signature.trim()) ? 'sha256-prefixed' : 'raw',
    });
    const { verifyKoraPayWebhookSignature } = await import('@/lib/korapay');
    const isValidSignature = verifyKoraPayWebhookSignature(payload?.data, signature);

    if (!isValidSignature) {
      log('Rejected: invalid webhook signature');
      return NextResponse.json({ error: 'Invalid webhook signature.' }, { status: 401 });
    }

    log('Signature verified');
  } else {
    log('No signature header supplied; continuing without signature verification');
  }

  const eventName = payload?.event;
  const chargeData = payload?.data || {};
  const reference = chargeData?.reference;

  log('Event extracted', {
    event: eventName,
    reference,
    amount: chargeData?.amount,
    currency: chargeData?.currency,
    accountReference: chargeData?.virtual_bank_account_details?.virtual_bank_account?.account_reference,
  });

  if (eventName !== 'charge.success') {
    log('Accepted but ignored: unsupported event', { event: eventName });
    return NextResponse.json({ received: true, ignored: true, event: eventName }, { status: 200 });
  }

  if (!reference) {
    log('Rejected: missing transaction reference');
    return NextResponse.json({ error: 'Missing transaction reference.' }, { status: 400 });
  }

  log('Checking for duplicate transaction', { reference });
  const duplicateQuery = await lookupDuplicateTransaction(reference);
  log('Duplicate transaction check complete', {
    error: duplicateQuery.error?.message || null,
    matchCount: duplicateQuery.data?.length || 0,
  });
  const duplicate = duplicateQuery.data?.find((entry: any) => entry?.meta?.provider === 'korapay');
  if (duplicate) {
    log('Accepted as duplicate; no wallet update', { reference });
    return NextResponse.json({ ok: true, status: 'duplicate' }, { status: 200 });
  }

  const accountReference = chargeData?.virtual_bank_account_details?.virtual_bank_account?.account_reference || null;
  if (!accountReference) {
    log('Rejected: missing virtual account reference');
    return NextResponse.json({ error: 'Missing virtual account reference.' }, { status: 400 });
  }

  log('Looking up virtual account', { accountReference });
  const { data: virtualAccount, error: virtualError } = await supabaseAdmin
    .from('virtual_accounts')
    .select('*')
    .eq('account_reference', accountReference)
    .maybeSingle();

  if (virtualError) {
    log('Failed: virtual account lookup error', { error: virtualError.message });
    return NextResponse.json({ error: virtualError.message }, { status: 500 });
  }

  if (!virtualAccount) {
    log('Accepted but not credited: virtual account not found', { accountReference });
    return NextResponse.json({ ok: true, status: 'unknown_account' }, { status: 200 });
  }

  log('Virtual account found', {
    userId: virtualAccount.user_id,
    accountReference: virtualAccount.account_reference,
  });

  try {
    log('Fetching charge from KoraPay for server-side verification', { reference });
    const verifiedCharge = await getKoraPayCharge(reference);
    const verified = verifiedCharge?.data || {};
    log('KoraPay charge verification response received', {
      status: verified.status,
      amount: verified.amount_paid ?? verified.amount,
      currency: verified.currency,
      accountReference: verified.virtual_bank_account?.account_reference,
    });

    if (!verified || String(verified.status || '').toLowerCase() !== 'success') {
      log('Accepted but not credited: verified charge is not successful', { status: verified.status });
      return NextResponse.json({ ok: true, status: 'failed' }, { status: 200 });
    }

    const expectedAmount = normalizeAmount(chargeData.amount);
    const verifiedAmount = normalizeAmount(verified.amount_paid ?? verified.amount);
    const expectedCurrency = normalizeCurrency(chargeData.currency);
    const verifiedCurrency = normalizeCurrency(verified.currency);

    if (verifiedCurrency !== expectedCurrency) {
      log('Accepted but not credited: currency mismatch', { expectedCurrency, verifiedCurrency });
      return NextResponse.json({ ok: true, status: 'currency_mismatch' }, { status: 200 });
    }

    if (verifiedAmount !== expectedAmount) {
      log('Accepted but not credited: amount mismatch', { expectedAmount, verifiedAmount });
      return NextResponse.json({ ok: true, status: 'amount_mismatch' }, { status: 200 });
    }

    const expectedAccountReference = String(
      verified.virtual_bank_account?.account_reference || virtualAccount.account_reference || ''
    );

    if (expectedAccountReference && expectedAccountReference !== String(accountReference)) {
      log('Accepted but not credited: account reference mismatch', {
        expectedAccountReference,
        receivedAccountReference: accountReference,
      });
      return NextResponse.json({ ok: true, status: 'account_mismatch' }, { status: 200 });
    }

    log('Loading wallet balance', { userId: virtualAccount.user_id });
    const { data: wallet } = await supabaseAdmin
      .from('wallets')
      .select('balance')
      .eq('user_id', virtualAccount.user_id)
      .maybeSingle();

    const currentBalance = Number(wallet?.balance || 0);
    const nextBalance = currentBalance + verifiedAmount;
    log('Wallet balance calculated', { currentBalance, verifiedAmount, nextBalance });

    const walletUpsert = await supabaseAdmin
      .from('wallets')
      .upsert(
        { user_id: virtualAccount.user_id, balance: nextBalance },
        { onConflict: 'user_id' }
      );

    if (walletUpsert.error) {
      log('Failed: wallet update error', { error: walletUpsert.error.message });
      return NextResponse.json({ error: walletUpsert.error.message }, { status: 500 });
    }

    log('Wallet updated', { userId: virtualAccount.user_id, newBalance: nextBalance });

    const transactionInsert = await supabaseAdmin.from('transactions').insert({
      user_id: virtualAccount.user_id,
      type: 'deposit',
      amount: verifiedAmount,
      charged_amount: verifiedAmount,
      status: 'success',
      reference,
      meta: {
        provider: 'korapay',
        provider_ref: reference,
        account_reference: accountReference,
        currency: verifiedCurrency,
        payment_status: verified.status,
        source: 'virtual_bank_account',
        payload: chargeData,
      },
    });

    if (transactionInsert.error) {
      log('Failed: transaction insert error', { error: transactionInsert.error.message });
      return NextResponse.json({ error: transactionInsert.error.message }, { status: 500 });
    }

    log('Webhook completed: wallet credited', {
      reference,
      userId: virtualAccount.user_id,
      amount: verifiedAmount,
      newBalance: nextBalance,
    });
    return NextResponse.json({ ok: true, credited: true, newBalance: nextBalance }, { status: 200 });
  } catch (error: any) {
    log('Failed: charge verification or wallet processing threw an exception', {
      error: error?.message || String(error),
      stack: error?.stack,
    });
    return NextResponse.json({ error: error.message || 'Failed to verify payment.' }, { status: 500 });
  }
}
