import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { getUserProfileName } from '@/lib/auth-helpers';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { getActivePaymentProvider } from '@/lib/payment-providers';
import { squadFetch } from '@/lib/squad';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

async function currentUser() {
  const store = await cookies();
  const client = createServerClient(supabaseUrl, supabaseAnonKey, { cookies: { getAll: () => store.getAll(), setAll: (items) => items.forEach(({ name, value, options }) => store.set(name, value, options)) } });
  return client.auth.getUser();
}

export async function GET() {
  const { data: { user }, error } = await currentUser();
  if (error || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (await getActivePaymentProvider() !== 'squad') return NextResponse.json({ error: 'Squad is not the active payment provider.' }, { status: 403 });
  const { data, error: lookupError } = await supabaseAdmin.from('virtual_accounts').select('*').eq('user_id', user.id).eq('provider', 'squad').maybeSingle();
  if (lookupError) return NextResponse.json({ error: lookupError.message }, { status: 500 });
  return NextResponse.json({ virtualAccount: data });
}

export async function POST() {
  try {
    const { data: { user }, error } = await currentUser();
    if (error || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (await getActivePaymentProvider() !== 'squad') return NextResponse.json({ error: 'Squad is not the active payment provider.' }, { status: 403 });

    const { data: existing, error: lookupError } = await supabaseAdmin.from('virtual_accounts').select('*').eq('user_id', user.id).eq('provider', 'squad').maybeSingle();
    if (lookupError) throw lookupError;
    if (existing) return NextResponse.json({ virtualAccount: existing });

    const { data: profile, error: profileError } = await supabaseAdmin.from('profiles').select('full_name, bvn, phone').eq('id', user.id).maybeSingle();
    if (profileError) throw profileError;
    const name = getUserProfileName(user, profile) || 'Medersub User';
    const [firstName = 'Medersub', ...lastNameParts] = name.trim().split(/\s+/);
    const customerIdentifier = `medersub-${user.id.replace(/-/g, '').slice(0, 24)}`;
    const squadAccount = await squadFetch<Record<string, any>>('/virtual-account', {
      method: 'POST', body: JSON.stringify({ first_name: firstName, last_name: lastNameParts.join(' ') || 'User', email: user.email, phone_number: profile?.phone || process.env.SQUAD_DEFAULT_PHONE_NUMBER, bvn: profile?.bvn || process.env.SQUAD_DEFAULT_BVN, customer_identifier: customerIdentifier, currency: 'NGN' }),
    });
    const accountNumber = squadAccount.virtual_account_number || squadAccount.account_number;
    const accountName = squadAccount.account_name || squadAccount.customer?.account_name || name;
    const bankName = squadAccount.bank_name || squadAccount.bank?.name;
    if (!accountNumber || !bankName) return NextResponse.json({ error: 'Squad returned incomplete virtual account details.' }, { status: 502 });
    const accountReference = squadAccount.customer_identifier || squadAccount.account_reference || customerIdentifier;
    const { data, error: upsertError } = await supabaseAdmin.from('virtual_accounts').upsert({ user_id: user.id, provider: 'squad', account_reference: accountReference, account_number: String(accountNumber), account_name: accountName, bank_name: bankName, bank_code: squadAccount.bank_code || squadAccount.bank?.code || null, currency: 'NGN', status: 'active', raw_response: squadAccount }, { onConflict: 'user_id,provider' }).select('*').single();
    if (upsertError) throw upsertError;
    return NextResponse.json({ virtualAccount: data });
  } catch (error: any) {
    console.error('[squad-account] failed:', error?.message || error);
    return NextResponse.json({ error: error?.message || 'Failed to create Squad virtual account.' }, { status: 500 });
  }
}
