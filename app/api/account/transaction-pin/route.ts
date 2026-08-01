import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { DEFAULT_TRANSACTION_PIN, hashTransactionPin, TRANSACTION_PIN_PATTERN, verifyTransactionPin } from '@/lib/transaction-pin';

async function getAuthenticatedUser() {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (cookiesToSet) => cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options)),
      },
    }
  );
  const { data: { user }, error } = await supabase.auth.getUser();
  return error || !user ? null : user;
}

export async function GET() {
  try {
    const user = await getAuthenticatedUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: profile, error } = await supabaseAdmin
      .from('profiles')
      .select('transaction_pin_hash, transaction_pin_changed')
      .eq('id', user.id)
      .single();
    if (error || !profile) return NextResponse.json({ error: 'Profile not found.' }, { status: 404 });

    return NextResponse.json({
      hasTransactionPin: Boolean(profile.transaction_pin_hash),
      mustChangeTransactionPin: !profile.transaction_pin_changed,
    });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed to load transaction PIN status.' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { pin, confirmPin, currentPin } = await req.json();
    if (!TRANSACTION_PIN_PATTERN.test(pin || '') || pin !== confirmPin) {
      return NextResponse.json({ error: 'Enter matching 4-digit PINs.' }, { status: 400 });
    }
    if (pin === DEFAULT_TRANSACTION_PIN) {
      return NextResponse.json({ error: 'Choose a PIN other than the default PIN.' }, { status: 400 });
    }

    const { data: profile, error } = await supabaseAdmin
      .from('profiles')
      .select('transaction_pin_hash')
      .eq('id', user.id)
      .single();
    if (error || !profile) return NextResponse.json({ error: 'Profile not found.' }, { status: 404 });

    if (!TRANSACTION_PIN_PATTERN.test(currentPin || '') || !verifyTransactionPin(currentPin, profile.transaction_pin_hash)) {
      return NextResponse.json({ error: 'Current transaction PIN is incorrect.' }, { status: 400 });
    }

    const { error: updateError } = await supabaseAdmin
      .from('profiles')
      .update({
        transaction_pin_hash: hashTransactionPin(pin),
        transaction_pin_changed: true,
        transaction_pin_updated_at: new Date().toISOString(),
      })
      .eq('id', user.id);
    if (updateError) throw updateError;

    return NextResponse.json({ success: true, hasTransactionPin: true, mustChangeTransactionPin: false });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed to save transaction PIN.' }, { status: 500 });
  }
}
