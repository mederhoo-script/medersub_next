import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { verifySquadWebhookSignature } from '@/lib/squad';

export async function POST(req: Request) {
  const rawBody = await req.text();
  const signature = req.headers.get('x-squad-encrypted');
  if (!verifySquadWebhookSignature(rawBody, signature)) return NextResponse.json({ error: 'Invalid webhook signature.' }, { status: 401 });

  let payload: any;
  try { payload = JSON.parse(rawBody); } catch { return NextResponse.json({ error: 'Invalid webhook payload.' }, { status: 400 }); }
  const data = payload?.data || payload;
  const reference = data.transaction_reference || data.transactionReference || data.reference;
  const accountReference = data.customer_identifier || data.customerIdentifier || data.account_reference;
  const amount = Number(data.amount_received ?? data.amount ?? data.transaction_amount);
  const status = String(data.transaction_status || data.status || '').toLowerCase();
  if (!reference || !accountReference || !Number.isFinite(amount) || amount <= 0) return NextResponse.json({ error: 'Incomplete virtual account payment payload.' }, { status: 400 });
  if (status && !['success', 'successful', 'completed'].includes(status)) return NextResponse.json({ received: true, ignored: true });

  const { data: account, error: accountError } = await supabaseAdmin.from('virtual_accounts').select('*').eq('provider', 'squad').eq('account_reference', String(accountReference)).maybeSingle();
  if (accountError) return NextResponse.json({ error: accountError.message }, { status: 500 });
  if (!account) return NextResponse.json({ received: true, status: 'unknown_account' });

  const { data: result, error } = await supabaseAdmin.rpc('process_squad_deposit', { p_user_id: account.user_id, p_amount: amount, p_reference: String(reference), p_account_reference: String(accountReference), p_currency: String(data.currency || 'NGN').toUpperCase(), p_payment_status: status || 'success', p_payload: payload });
  if (error) {
    console.error('[squad-webhook] credit failed:', error.message);
    return NextResponse.json({ error: 'Unable to process payment.' }, { status: 500 });
  }
  return NextResponse.json({ ok: true, ...(result as Record<string, unknown>) });
}
