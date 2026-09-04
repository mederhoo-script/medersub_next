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

export async function POST(req: Request) {
  try {
    if (await getActivePaymentProvider() !== 'korapay') return NextResponse.json({ error: 'KoraPay is not active.' }, { status: 403 });
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { reference } = await req.json();
    if (!reference || typeof reference !== 'string') return NextResponse.json({ error: 'Reference is required.' }, { status: 400 });

    const charge = await getKoraPayCharge(reference);
    const data = charge.data || {};
    if (String(data.status || '').toLowerCase() !== 'success') return NextResponse.json({ status: data.status || 'pending' });
    if (data.currency && normalizeCurrency(data.currency) !== 'NGN') return NextResponse.json({ error: 'Invalid payment currency.' }, { status: 400 });

    const metadata = data.metadata || {};
    const metadataUserId = metadata.userid || metadata.user_id;
    if (metadataUserId !== user.id || metadata.purpose !== 'wallet-funding') {
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
