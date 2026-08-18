import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { ensureWalletRow, getUserProfileName } from '@/lib/auth-helpers';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { createKoraPayVirtualAccount } from '@/lib/korapay';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

async function getCurrentUser() {
  const cookieStore = await cookies();
  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (cookiesToSet) => cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options)),
    },
  });

  const { data: { user }, error } = await supabase.auth.getUser();
  return { user, error };
}

function buildAccountReference(userId: string) {
  const shortUserId = userId.replace(/-/g, '').slice(0, 12);
  const timestamp = Date.now().toString().slice(-8);
  return `kora-${shortUserId}-${timestamp}`.slice(0, 50);
}

async function createKoraPayVirtualAccountWithRetry(payload: Record<string, any>, maxAttempts = 3) {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await createKoraPayVirtualAccount(payload);
    } catch (error: any) {
      lastError = error instanceof Error ? error : new Error(String(error || 'Unknown KoraPay error'));
      console.error(`[korapay-account] create attempt ${attempt}/${maxAttempts} failed:`, lastError.message);
    }
  }

  throw lastError || new Error('KoraPay account creation failed after retries.');
}

async function upsertVirtualAccount(userId: string, payload: Record<string, any>) {
  const { data: existing, error: lookupError } = await supabaseAdmin
    .from('virtual_accounts')
    .select('*')
    .eq('user_id', userId)
    .eq('provider', 'korapay')
    .maybeSingle();

  if (lookupError) {
    throw new Error(lookupError.message);
  }

  if (existing) {
    return existing;
  }

  const { data, error } = await supabaseAdmin
    .from('virtual_accounts')
    .upsert(
      {
        user_id: userId,
        provider: 'korapay',
        account_reference: payload.account_reference,
        account_number: payload.account_number,
        account_name: payload.account_name,
        bank_name: payload.bank_name,
        bank_code: payload.bank_code,
        currency: payload.currency || 'NGN',
        status: payload.account_status || 'active',
        raw_response: payload.raw_response || null,
      },
      { onConflict: 'user_id,provider' }
    )
    .select('*')
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

export async function GET() {
  try {
    const { user, error: authError } = await getCurrentUser();
    if (authError || !user) {
      console.error('[korapay-account] GET unauthorized:', authError?.message || 'No user session');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: account, error } = await supabaseAdmin
      .from('virtual_accounts')
      .select('*')
      .eq('user_id', user.id)
      .eq('provider', 'korapay')
      .maybeSingle();

    if (error) {
      console.error('[korapay-account] GET lookup failed:', error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ virtualAccount: account ?? null });
  } catch (err: any) {
    console.error('[korapay-account] GET unexpected error:', err?.message || err);
    return NextResponse.json({ error: err.message || 'Failed to fetch virtual account.' }, { status: 500 });
  }
}

export async function POST() {
  try {
    const { user, error: authError } = await getCurrentUser();
    if (authError || !user) {
      console.error('[korapay-account] POST unauthorized:', authError?.message || 'No user session');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await ensureWalletRow(user.id);

    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('full_name, bvn, nin')
      .eq('id', user.id)
      .maybeSingle();

    if (profileError) {
      console.error('[korapay-account] POST profile lookup failed:', profileError.message);
      return NextResponse.json({ error: profileError.message }, { status: 500 });
    }

    const bvn = (profile?.bvn || process.env.KORAPAY_DEFAULT_BVN || '').toString().trim();
    const nin = (profile?.nin || process.env.KORAPAY_DEFAULT_NIN || '').toString().trim();
    const fullName = getUserProfileName(user, profile) || 'Medersub User';

    const existing = await supabaseAdmin
      .from('virtual_accounts')
      .select('*')
      .eq('user_id', user.id)
      .eq('provider', 'korapay')
      .maybeSingle();

    if (existing.error) {
      console.error('[korapay-account] POST existing account lookup failed:', existing.error.message);
      return NextResponse.json({ error: existing.error.message }, { status: 500 });
    }

    if (existing.data) {
      return NextResponse.json({ virtualAccount: existing.data });
    }

    if (!bvn) {
      console.error('[korapay-account] POST missing BVN for user:', user.id);
      return NextResponse.json(
        { error: 'BVN is required before creating a KoraPay virtual account.' },
        { status: 400 }
      );
    }

    const accountReference = buildAccountReference(user.id);
    const secretKey = (process.env.KORAPAY_SECRET_KEY || process.env.KORAPAY_API_KEY || '').trim();
    const isSandbox = /^sk_test_|^pk_test_/.test(secretKey);
    const sandboxDefaultBankCode = isSandbox ? '000' : '035';
    const bankCode = (process.env.KORAPAY_BANK_CODE || sandboxDefaultBankCode).trim();

    const customer: Record<string, string> = {
      name: fullName,
    };

    if (user.email && !isSandbox) {
      customer.email = user.email;
    }

    const kyc: Record<string, string> = { bvn };
    if (!isSandbox && nin) {
      kyc.nin = nin;
    }

    const body = {
      account_name: fullName,
      account_reference: accountReference,
      permanent: true,
      bank_code: bankCode,
      customer,
      kyc,
    };

    console.log('[korapay-account] request payload:', JSON.stringify(body, null, 2));

    const response = await createKoraPayVirtualAccountWithRetry(body, 3);
    const data = response?.data || {};

    if (!data.account_number || !data.bank_name || !data.account_name) {
      console.error('[korapay-account] POST invalid KoraPay response shape:', response);
      return NextResponse.json({ error: 'Invalid KoraPay response while creating account.' }, { status: 502 });
    }

    const virtualAccount = await upsertVirtualAccount(user.id, {
      ...data,
      account_reference: data.account_reference || accountReference,
      account_name: data.account_name || fullName,
      account_number: data.account_number,
      bank_name: data.bank_name,
      bank_code: data.bank_code || bankCode,
      account_status: data.account_status || 'active',
      currency: data.currency || 'NGN',
      raw_response: response,
    });

    return NextResponse.json({ virtualAccount });
  } catch (error: any) {
    console.error('[korapay-account] POST failed:', error?.message || error);
    return NextResponse.json({ error: error.message || 'Failed to create KoraPay virtual account.' }, { status: 500 });
  }
}
