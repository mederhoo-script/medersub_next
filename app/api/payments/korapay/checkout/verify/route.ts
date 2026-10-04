import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { getActivePaymentProvider } from '@/lib/payment-providers';
import { getKoraPayCharge, normalizeAmount, normalizeCurrency } from '@/lib/korapay';
import { supabaseAdmin } from '@/lib/supabase-admin';

async function getCurrentUser() {
  const cookieStore = await cookies();
  const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (cookiesToSet) => cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options)),
    },
  });
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const createdAfter = new Date(Date.now() - 20 * 60 * 1000).toISOString();
    const { data, error } = await supabaseAdmin
      .from('transactions')
      .select('reference, amount, created_at')
      .eq('user_id', user.id)
      .eq('provider', 'korapay')
      .eq('status', 'pending')
      .contains('meta', { source: 'checkout', purpose: 'wallet-funding' })
      .gte('created_at', createdAfter)
      .order('created_at', { ascending: true })
      .limit(10);

    if (error) throw error;
    return NextResponse.json({
      pending: (data || []).map((transaction) => ({
        reference: transaction.reference,
        amount: transaction.amount,
        createdAt: transaction.created_at,
        expiresAt: new Date(new Date(transaction.created_at).getTime() + 20 * 60 * 1000).toISOString(),
      })),
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to load pending payments.' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    if (await getActivePaymentProvider() !== 'korapay') return NextResponse.json({ error: 'KoraPay is not active.' }, { status: 403 });
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { reference } = await req.json();
    if (!reference || typeof reference !== 'string') return NextResponse.json({ error: 'Reference is required.' }, { status: 400 });

    const { data: pendingTransaction, error: pendingError } = await supabaseAdmin
      .from('transactions')
      .select('status, amount, charged_amount, created_at, meta')
      .eq('user_id', user.id)
      .eq('provider', 'korapay')
      .eq('provider_ref', reference)
      .maybeSingle();
    if (pendingError) throw pendingError;
    if (!pendingTransaction) return NextResponse.json({ error: 'Payment reference was not found for this account.' }, { status: 404 });
    if (pendingTransaction.status === 'success') {
      return NextResponse.json({
        status: 'duplicate',
        grossAmount: Number(pendingTransaction.charged_amount || pendingTransaction.amount),
        fee: Number((pendingTransaction.meta as Record<string, unknown> | null)?.fee || 0),
        creditedAmount: Number(pendingTransaction.amount),
      });
    }
    if (pendingTransaction.status !== 'pending') return NextResponse.json({ status: pendingTransaction.status || 'failed' });
    if (Date.now() >= new Date(pendingTransaction.created_at).getTime() + 20 * 60 * 1000) {
      return NextResponse.json({ status: 'expired' });
    }

    const charge = await getKoraPayCharge(reference);
    const data = charge.data || {};
    const providerStatus = String(data.status || '').toLowerCase();
    if (providerStatus !== 'success') {
      if (['failed', 'cancelled', 'expired'].includes(providerStatus)) {
        const { error: updateError } = await supabaseAdmin
          .from('transactions')
          .update({ status: 'failed', meta: { ...(pendingTransaction.meta as Record<string, unknown> || {}), provider_status: providerStatus } })
          .eq('user_id', user.id)
          .eq('provider', 'korapay')
          .eq('provider_ref', reference)
          .eq('status', 'pending');
        if (updateError) throw updateError;
      }
      return NextResponse.json({ status: providerStatus || 'pending' });
    }
    if (data.currency && normalizeCurrency(data.currency) !== 'NGN') return NextResponse.json({ error: 'Invalid payment currency.' }, { status: 400 });

    const metadata = data.metadata || {};
    const metadataUserId = metadata.userid || metadata.user_id;
    if (metadataUserId !== user.id || metadata.purpose !== 'wallet-funding' || data.reference !== reference) {
      return NextResponse.json({ error: 'Payment does not belong to this account.' }, { status: 403 });
    }

    const amountAccepted = normalizeAmount(data.amount_accepted);
    const chargedAmount = normalizeAmount(data.amount);
    const fee = normalizeAmount(data.fee);
    if (amountAccepted <= 0 || chargedAmount <= 0 || amountAccepted !== chargedAmount || fee < 0 || fee >= amountAccepted) {
      return NextResponse.json({ error: 'Invalid or incomplete payment amount.' }, { status: 400 });
    }
    const creditedAmount = amountAccepted - fee;

    const { data: result, error } = await supabaseAdmin.rpc('process_korapay_checkout_deposit', {
      p_user_id: user.id,
      p_amount: creditedAmount,
      p_reference: reference,
      p_currency: normalizeCurrency(data.currency),
      p_payment_status: data.status,
      p_payload: data,
    });
    if (error) throw error;
    return NextResponse.json({ success: true, grossAmount: amountAccepted, fee, creditedAmount, ...(result as Record<string, unknown>) });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to verify KoraPay payment.' }, { status: 500 });
  }
}
