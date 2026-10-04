import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { verifySquadWebhookSignature } from '@/lib/squad';

export async function POST(req: Request) {
  const rawBody = await req.text();
  let payload: any;
  try { payload = JSON.parse(rawBody); } catch { return NextResponse.json({ error: 'Invalid webhook payload.' }, { status: 400 }); }
  const data = payload?.data || payload;
  const signature = req.headers.get('x-squad-signature');
  if (!verifySquadWebhookSignature(rawBody, data, signature)) return NextResponse.json({ error: 'Invalid webhook signature.' }, { status: 401 });

  const reference = data.transaction_reference || data.transactionReference || data.reference;
  const accountReference = data.customer_identifier || data.customerIdentifier || data.account_reference;
  const amount = Number(data.principal_amount ?? data.amount_received ?? data.amount ?? data.transaction_amount ?? data.settled_amount);
  const currency = String(data.currency || 'NGN').toUpperCase();
  const status = String(data.transaction_status || data.status || '').toLowerCase();
  const indicator = String(data.transaction_indicator || '').toUpperCase();
  if (!reference || !accountReference || !Number.isFinite(amount) || amount <= 0) return NextResponse.json({ error: 'Incomplete virtual account payment payload.' }, { status: 400 });
  if ((status && !['success', 'successful', 'completed'].includes(status)) || (indicator && indicator !== 'C')) {
    return NextResponse.json({ received: true, ignored: true });
  }
  if (currency !== 'NGN') return NextResponse.json({ received: true, ignored: true, reason: 'unsupported_currency' });

  const { data: account, error: accountError } = await supabaseAdmin.from('virtual_accounts').select('*').eq('provider', 'squad').eq('account_reference', String(accountReference)).maybeSingle();
  if (accountError) return NextResponse.json({ error: accountError.message }, { status: 500 });
  if (!account) {
    console.error('[squad-webhook] verified notification references an unknown virtual account');
    return NextResponse.json({ error: 'Virtual account is not available yet. Please retry this notification.' }, { status: 500 });
  }

  const { data: result, error } = await supabaseAdmin.rpc('process_squad_deposit', { p_user_id: account.user_id, p_amount: amount, p_reference: String(reference), p_account_reference: String(accountReference), p_currency: currency, p_payment_status: status || indicator || 'success', p_payload: payload });
  if (error) {
    console.error('[squad-webhook] credit failed:', error.message);
    return NextResponse.json({ error: 'Unable to process payment.' }, { status: 500 });
  }
  return NextResponse.json({ ok: true, ...(result as Record<string, unknown>) });
}
