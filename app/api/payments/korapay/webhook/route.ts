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
  const rawBody = await req.text();
  const signature = req.headers.get('x-korapay-signature') || req.headers.get('X-Korapay-Signature');

  let payload: any;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: 'Invalid webhook payload.' }, { status: 400 });
  }

  if (signature) {
    const { verifyKoraPayWebhookSignature } = await import('@/lib/korapay');
    const isValidSignature = verifyKoraPayWebhookSignature(rawBody, signature);

    if (!isValidSignature) {
      return NextResponse.json({ error: 'Invalid webhook signature.' }, { status: 401 });
    }
  }

  const eventName = payload?.event;
  const chargeData = payload?.data || {};
  const reference = chargeData?.reference;

  if (eventName !== 'charge.success') {
    return NextResponse.json({ received: true, ignored: true, event: eventName }, { status: 200 });
  }

  if (!reference) {
    return NextResponse.json({ error: 'Missing transaction reference.' }, { status: 400 });
  }

  const duplicateQuery = await lookupDuplicateTransaction(reference);
  const duplicate = duplicateQuery.data?.find((entry: any) => entry?.meta?.provider === 'korapay');
  if (duplicate) {
    return NextResponse.json({ ok: true, status: 'duplicate' }, { status: 200 });
  }

  const accountReference = chargeData?.virtual_bank_account_details?.virtual_bank_account?.account_reference || null;
  if (!accountReference) {
    return NextResponse.json({ error: 'Missing virtual account reference.' }, { status: 400 });
  }

  const { data: virtualAccount, error: virtualError } = await supabaseAdmin
    .from('virtual_accounts')
    .select('*')
    .eq('account_reference', accountReference)
    .maybeSingle();

  if (virtualError) {
    return NextResponse.json({ error: virtualError.message }, { status: 500 });
  }

  if (!virtualAccount) {
    return NextResponse.json({ ok: true, status: 'unknown_account' }, { status: 200 });
  }

  try {
    const verifiedCharge = await getKoraPayCharge(reference);
    const verified = verifiedCharge?.data || {};

    if (!verified || String(verified.status || '').toLowerCase() !== 'success') {
      return NextResponse.json({ ok: true, status: 'failed' }, { status: 200 });
    }

    const expectedAmount = normalizeAmount(chargeData.amount);
    const verifiedAmount = normalizeAmount(verified.amount_paid ?? verified.amount);
    const expectedCurrency = normalizeCurrency(chargeData.currency);
    const verifiedCurrency = normalizeCurrency(verified.currency);

    if (verifiedCurrency !== expectedCurrency) {
      return NextResponse.json({ ok: true, status: 'currency_mismatch' }, { status: 200 });
    }

    if (verifiedAmount !== expectedAmount) {
      return NextResponse.json({ ok: true, status: 'amount_mismatch' }, { status: 200 });
    }

    const expectedAccountReference = String(
      verified.virtual_bank_account?.account_reference || virtualAccount.account_reference || ''
    );

    if (expectedAccountReference && expectedAccountReference !== String(accountReference)) {
      return NextResponse.json({ ok: true, status: 'account_mismatch' }, { status: 200 });
    }

    const { data: wallet } = await supabaseAdmin
      .from('wallets')
      .select('balance')
      .eq('user_id', virtualAccount.user_id)
      .maybeSingle();

    const currentBalance = Number(wallet?.balance || 0);
    const nextBalance = currentBalance + verifiedAmount;

    const walletUpsert = await supabaseAdmin
      .from('wallets')
      .upsert(
        { user_id: virtualAccount.user_id, balance: nextBalance },
        { onConflict: 'user_id' }
      );

    if (walletUpsert.error) {
      return NextResponse.json({ error: walletUpsert.error.message }, { status: 500 });
    }

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
      return NextResponse.json({ error: transactionInsert.error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, credited: true, newBalance: nextBalance }, { status: 200 });
  } catch (error: any) {
    console.error('[korapay-webhook] Verification failed:', error.message);
    return NextResponse.json({ error: error.message || 'Failed to verify payment.' }, { status: 500 });
  }
}
