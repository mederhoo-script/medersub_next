import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { getActivePaymentProvider } from '@/lib/payment-providers';
import { SquadApiError, squadFetch } from '@/lib/squad';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

async function currentUser() {
  const store = await cookies();
  const client = createServerClient(supabaseUrl, supabaseAnonKey, { cookies: { getAll: () => store.getAll(), setAll: (items) => items.forEach(({ name, value, options }) => store.set(name, value, options)) } });
  return client.auth.getUser();
}

function collectResponseObjects(value: unknown, depth = 0, seen = new Set<object>()): Record<string, any>[] {
  if (!value || typeof value !== 'object' || depth > 5 || seen.has(value)) return [];
  seen.add(value);
  if (Array.isArray(value)) return value.flatMap((item) => collectResponseObjects(item, depth + 1, seen));
  const record = value as Record<string, any>;
  return [record, ...Object.values(record).flatMap((nested) => collectResponseObjects(nested, depth + 1, seen))];
}

function findResponseField(records: Record<string, any>[], fieldNames: string[]) {
  for (const fieldName of fieldNames) {
    for (const record of records) {
      const value = record[fieldName];
      if ((typeof value === 'string' || typeof value === 'number') && String(value).trim()) return String(value).trim();
    }
  }
  return null;
}

function describeResponseShape(value: unknown, depth = 0): unknown {
  if (!value || typeof value !== 'object' || depth > 3) return typeof value;
  if (Array.isArray(value)) return { type: 'array', length: value.length, item: value.length ? describeResponseShape(value[0], depth + 1) : null };
  return Object.fromEntries(Object.entries(value).map(([key, nested]) => [
    key,
    nested && typeof nested === 'object' ? describeResponseShape(nested, depth + 1) : typeof nested,
  ]));
}

function normalizeSquadGender(value: unknown) {
  const gender = String(value || '').trim().toLowerCase();
  if (['1', 'male', 'm'].includes(gender)) return '1';
  if (['2', 'female', 'f'].includes(gender)) return '2';
  return '';
}

function normalizeSquadPhoneNumber(value: unknown) {
  const digits = String(value || '').replace(/\D/g, '');
  if (digits.length === 13 && digits.startsWith('234')) return `0${digits.slice(3)}`;
  if (digits.length === 10) return `0${digits}`;
  if (digits.length === 11 && digits.startsWith('0')) return digits;
  return '';
}

function normalizeSquadDate(value: unknown) {
  const dateValue = String(value || '').trim();
  const match = dateValue.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  const normalized = match ? `${match[3]}-${match[1]}-${match[2]}` : dateValue;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) return '';
  const parsedDate = new Date(`${normalized}T00:00:00.000Z`);
  if (Number.isNaN(parsedDate.getTime()) || parsedDate.toISOString().slice(0, 10) !== normalized || parsedDate > new Date()) return '';
  return normalized;
}

function extractSquadAccount(value: unknown, fallbackAccountName: string) {
  const records = collectResponseObjects(value);
  const accountNumber = findResponseField(records, ['virtual_account_number', 'virtualAccountNumber', 'account_number', 'accountNumber', 'nuban_account_number', 'nuban']);
  const firstName = findResponseField(records, ['first_name', 'firstName']) || '';
  const lastName = findResponseField(records, ['last_name', 'lastName']) || '';
  const accountName = findResponseField(records, ['account_name', 'accountName', 'virtual_account_name', 'virtualAccountName'])
    || [firstName, lastName].filter(Boolean).join(' ')
    || fallbackAccountName;
  const bankRecords = records.flatMap((record) => record.bank && typeof record.bank === 'object' ? [record.bank] : []);
  const bankCode = findResponseField(records, ['bank_code', 'bankCode']) || findResponseField(bankRecords, ['code']);
  const bankName = findResponseField(records, ['bank_name', 'bankName', 'financial_institution_name', 'institution_name'])
    || findResponseField(records, ['bank'])
    || findResponseField(bankRecords, ['name', 'bank_name', 'bankName'])
    || (bankCode === '058' ? 'GTBank' : null);
  const accountReference = findResponseField(records, ['customer_identifier', 'customerIdentifier', 'account_reference', 'accountReference']);
  return { accountNumber, accountName, bankName, bankCode, accountReference };
}

async function saveSquadAccount(userId: string, customerIdentifier: string, rawResponse: unknown, details: ReturnType<typeof extractSquadAccount>, accountMode: 'personal' | 'default') {
  const { data, error } = await supabaseAdmin.from('virtual_accounts').upsert({
    user_id: userId,
    provider: 'squad',
    account_reference: details.accountReference || customerIdentifier,
    account_number: details.accountNumber,
    account_name: details.accountName,
    bank_name: details.bankName,
    bank_code: details.bankCode,
    currency: 'NGN',
    status: 'active',
    account_mode: accountMode,
    daily_limit: accountMode === 'default' ? 10000 : null,
    raw_response: rawResponse,
  }, { onConflict: 'user_id,provider,account_mode' }).select('*').single();
  if (error) throw error;
  return data;
}

export async function GET() {
  const { data: { user }, error } = await currentUser();
  if (error || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (await getActivePaymentProvider() !== 'squad') return NextResponse.json({ error: 'Squad is not the active payment provider.' }, { status: 403 });
  const [{ data: accounts, error: lookupError }, { data: profile, error: profileError }, { data: settings, error: settingsError }] = await Promise.all([
    supabaseAdmin.from('virtual_accounts').select('*').eq('user_id', user.id).eq('provider', 'squad').order('created_at', { ascending: true }),
    supabaseAdmin.from('profiles').select('full_name, bvn, phone').eq('id', user.id).maybeSingle(),
    supabaseAdmin.from('system_settings').select('value').eq('key', 'general').maybeSingle(),
  ]);
  if (lookupError) return NextResponse.json({ error: lookupError.message }, { status: 500 });
  if (profileError) return NextResponse.json({ error: profileError.message }, { status: 500 });
  if (settingsError) return NextResponse.json({ error: settingsError.message }, { status: 500 });
  const configuredDepositFee = Number((settings?.value as Record<string, unknown> | null)?.squad_deposit_fee || 0);
  const squadDepositFee = Number.isFinite(configuredDepositFee) ? Math.min(100000, Math.max(0, configuredDepositFee)) : 0;
  const defaultFullName = String(process.env.SQUAD_DEFAULT_FULL_NAME || '').trim();
  const defaultBvn = String(process.env.SQUAD_DEFAULT_BVN || '').trim();
  const defaultPhone = normalizeSquadPhoneNumber(process.env.SQUAD_DEFAULT_PHONE_NUMBER);
  const defaultDateOfBirth = normalizeSquadDate(process.env.SQUAD_DEFAULT_DATE_OF_BIRTH);
  const defaultGender = normalizeSquadGender(process.env.SQUAD_DEFAULT_GENDER);
  const defaultAddress = String(process.env.SQUAD_DEFAULT_ADDRESS || '').trim();
  const defaultAccountReady = defaultFullName.split(/\s+/).filter(Boolean).length >= 2
    && /^\d{11}$/.test(defaultBvn)
    && /^0\d{10}$/.test(defaultPhone)
    && Boolean(defaultDateOfBirth)
    && Boolean(defaultGender)
    && defaultAddress.length >= 5 && defaultAddress.length <= 200;
  const metadataGender = String(user.user_metadata?.gender || '').trim().toLowerCase();
  return NextResponse.json({
    virtualAccounts: accounts || [],
    virtualAccount: accounts?.find((account) => account.account_mode === 'default') || accounts?.[0] || null,
    hasBvn: /^\d{11}$/.test(String(profile?.bvn || '').trim()),
    customerDetails: {
      fullName: profile?.full_name || user.user_metadata?.full_name || user.user_metadata?.fullName || '',
      bvn: profile?.bvn || '',
      mobileNumber: normalizeSquadPhoneNumber(profile?.phone || user.user_metadata?.phone),
      dateOfBirth: user.user_metadata?.date_of_birth || user.user_metadata?.dob || '',
      gender: ['1', 'male', 'm'].includes(metadataGender) ? '1' : ['2', 'female', 'f'].includes(metadataGender) ? '2' : '',
      address: user.user_metadata?.address || '',
    },
    configuredDefaults: {
      defaultAccountReady,
      fullName: defaultFullName.split(/\s+/).filter(Boolean).length >= 2,
      bvn: /^\d{11}$/.test(defaultBvn),
      phone: /^0\d{10}$/.test(defaultPhone),
      dateOfBirth: Boolean(defaultDateOfBirth),
      gender: Boolean(defaultGender),
      address: defaultAddress.length >= 5 && defaultAddress.length <= 200,
    },
    squadDepositFee,
  });
}

export async function POST(req: Request) {
  try {
    const { data: { user }, error } = await currentUser();
    if (error || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (await getActivePaymentProvider() !== 'squad') return NextResponse.json({ error: 'Squad is not the active payment provider.' }, { status: 403 });

    const requestBody = await req.json().catch(() => ({}));
    const accountMode: 'personal' | 'default' = requestBody?.accountMode === 'default' ? 'default' : 'personal';
    const requestedDateOfBirth = String(requestBody?.dateOfBirth || '').trim();
    const requestedGender = String(requestBody?.gender || '').trim();
    const requestedAddress = String(requestBody?.address || '').trim();

    const { data: existing, error: lookupError } = await supabaseAdmin.from('virtual_accounts').select('*').eq('user_id', user.id).eq('provider', 'squad').eq('account_mode', accountMode).maybeSingle();
    if (lookupError) throw lookupError;
    if (existing) return NextResponse.json({ virtualAccount: existing });

    const { data: profile, error: profileError } = await supabaseAdmin.from('profiles').select('full_name, bvn, phone').eq('id', user.id).maybeSingle();
    if (profileError) throw profileError;
    const defaultFullName = String(process.env.SQUAD_DEFAULT_FULL_NAME || '').trim();
    const defaultBvn = String(process.env.SQUAD_DEFAULT_BVN || '').trim();
    const defaultPhone = normalizeSquadPhoneNumber(process.env.SQUAD_DEFAULT_PHONE_NUMBER);
    const defaultDateOfBirth = normalizeSquadDate(process.env.SQUAD_DEFAULT_DATE_OF_BIRTH);
    const defaultGender = normalizeSquadGender(process.env.SQUAD_DEFAULT_GENDER);
    const defaultAddress = String(process.env.SQUAD_DEFAULT_ADDRESS || '').trim();
    const defaultAccountReady = defaultFullName.split(/\s+/).filter(Boolean).length >= 2
      && /^\d{11}$/.test(defaultBvn)
      && /^0\d{10}$/.test(defaultPhone)
      && Boolean(defaultDateOfBirth)
      && Boolean(defaultGender)
      && defaultAddress.length >= 5 && defaultAddress.length <= 200;
    const name = String(accountMode === 'default'
      ? defaultFullName
      : requestBody?.fullName || profile?.full_name || user.user_metadata?.full_name || user.user_metadata?.fullName || '').trim();
    const customerIdentifier = `med-${user.id.replace(/-/g, '').slice(0, 20)}-${accountMode === 'default' ? 'd' : 'p'}`;

    let recoveredAccount: Record<string, any> | null = null;
    try {
      recoveredAccount = await squadFetch<Record<string, any>>(`/virtual-account/${encodeURIComponent(customerIdentifier)}`);
    } catch (error) {
      if (!(error instanceof SquadApiError) || error.status !== 404) throw error;
    }
    if (recoveredAccount) {
      const accountDetails = extractSquadAccount(recoveredAccount, name);
      if (!accountDetails.accountNumber || !accountDetails.bankName) {
        const missing = [!accountDetails.accountNumber && 'account number', !accountDetails.bankName && 'bank name'].filter(Boolean).join(' and ');
        console.error('[squad-account] recovered account missing required details', { missing, bankCode: accountDetails.bankCode, shape: describeResponseShape(recoveredAccount) });
        return NextResponse.json({ error: `Squad already has this customer account, but its ${missing} could not be resolved. Contact support before retrying.` }, { status: 502 });
      }
      const virtualAccount = await saveSquadAccount(user.id, customerIdentifier, recoveredAccount, accountDetails, accountMode);
      return NextResponse.json({ virtualAccount, recovered: true });
    }

    const bvn = String(accountMode === 'default' ? defaultBvn : requestBody?.bvn || profile?.bvn || '').trim();
    const mobileNumber = normalizeSquadPhoneNumber(accountMode === 'default' ? defaultPhone : requestBody?.mobileNumber || profile?.phone);
    const dateOfBirth = normalizeSquadDate(accountMode === 'default'
      ? defaultDateOfBirth
      : requestedDateOfBirth || user.user_metadata?.date_of_birth || user.user_metadata?.dob || '');
    const gender = normalizeSquadGender(accountMode === 'default'
      ? defaultGender
      : requestedGender || user.user_metadata?.gender || '');
    const address = String(accountMode === 'default' ? defaultAddress : requestedAddress || user.user_metadata?.address || '').trim();
    if (accountMode === 'default' && !defaultAccountReady) {
      return NextResponse.json({ error: 'The default Squad account profile is incomplete. Configure all six SQUAD_DEFAULT_* values on the server.' }, { status: 503 });
    }
    if (!/^\d{11}$/.test(bvn)) return NextResponse.json({ error: 'Enter a valid 11-digit BVN.' }, { status: 400 });
    if (!/^0\d{10}$/.test(mobileNumber)) return NextResponse.json({ error: 'Enter an 11-digit Nigerian phone number beginning with 0.' }, { status: 400 });

    const beneficiaryAccount = (process.env.SQUAD_BENEFICIARY_ACCOUNT || '').trim();
    if (!/^\d{10}$/.test(beneficiaryAccount)) {
      return NextResponse.json({ error: 'Squad settlement account is not configured. Set SQUAD_BENEFICIARY_ACCOUNT on the server.' }, { status: 503 });
    }

    if (!dateOfBirth || !gender || address.length < 5 || address.length > 200) {
      return NextResponse.json({ error: 'Complete your date of birth, gender, and residential address to create a Squad account.' }, { status: 400 });
    }

    const nameParts = name.split(/\s+/).filter(Boolean);
    if (nameParts.length < 2 || !user.email) return NextResponse.json({ error: 'Add your full legal name and email address to your profile before creating a Squad account.' }, { status: 400 });
    const [firstName, ...lastNameParts] = nameParts;
    const squadDateOfBirth = `${dateOfBirth.slice(5, 7)}/${dateOfBirth.slice(8, 10)}/${dateOfBirth.slice(0, 4)}`;
    const squadAccount = await squadFetch<Record<string, any>>('/virtual-account', {
      method: 'POST',
      body: JSON.stringify({
        customer_identifier: customerIdentifier,
        first_name: firstName,
        last_name: lastNameParts.join(' '),
        mobile_num: mobileNumber,
        email: user.email,
        bvn,
        dob: squadDateOfBirth,
        address,
        gender,
        beneficiary_account: beneficiaryAccount,
      }),
    });
    const accountDetails = extractSquadAccount(squadAccount, name);
    if (!accountDetails.accountNumber || !accountDetails.bankName) {
      const missing = [!accountDetails.accountNumber && 'account number', !accountDetails.bankName && 'bank name'].filter(Boolean).join(' and ');
      console.error('[squad-account] response missing required account details', { missing, bankCode: accountDetails.bankCode, shape: describeResponseShape(squadAccount) });
      return NextResponse.json({ error: `Squad created a response without the required ${missing}. Please retry or contact support.` }, { status: 502 });
    }
    const virtualAccount = await saveSquadAccount(user.id, customerIdentifier, squadAccount, accountDetails, accountMode);
    return NextResponse.json({ virtualAccount });
  } catch (error: any) {
    console.error('[squad-account] failed:', error?.message || error);
    return NextResponse.json({ error: error?.message || 'Failed to create Squad virtual account.' }, { status: 502 });
  }
}
