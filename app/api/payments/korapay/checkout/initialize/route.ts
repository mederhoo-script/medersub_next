import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { getActivePaymentProvider } from '@/lib/payment-providers';
import { korapayFetch } from '@/lib/korapay';

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
    if (await getActivePaymentProvider() !== 'korapay') {
      return NextResponse.json({ error: 'KoraPay is not the active payment provider.' }, { status: 403 });
    }

    const user = await getCurrentUser();
    if (!user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const amount = Math.round(Number(body.amount));
    if (!Number.isFinite(amount) || amount < 100) {
      return NextResponse.json({ error: 'Minimum funding amount is ₦100.' }, { status: 400 });
    }

    const reference = `fund-${user.id.replace(/-/g, '').slice(0, 12)}-${Date.now()}`;
    const origin = new URL(req.url).origin;
    const response = await korapayFetch<{ status: boolean; message?: string; data?: { checkout_url?: string; reference?: string } }>('/charges/initialize', {
      method: 'POST',
      body: JSON.stringify({
        amount,
        currency: 'NGN',
        reference,
        redirect_url: `${origin}/dashboard/fund?payment=korapay&reference=${encodeURIComponent(reference)}`,
        notification_url: `${origin}/api/payments/korapay/webhook`,
        narration: 'Wallet funding',
        channels: ['bank_transfer',],
        metadata: { userid: user.id, purpose: 'wallet-funding' },
        customer: { email: user.email, name: user.user_metadata?.full_name || user.email },
        merchant_bears_cost: true,
      }),
    });

    const checkoutUrl = response.data?.checkout_url;
    if (!checkoutUrl) return NextResponse.json({ error: 'KoraPay did not return a checkout URL.' }, { status: 502 });
    return NextResponse.json({ checkoutUrl, reference: response.data?.reference || reference });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to initialize KoraPay checkout.' }, { status: 500 });
  }
}
