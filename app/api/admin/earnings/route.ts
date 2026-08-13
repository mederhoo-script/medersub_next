import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

/**
 * Admin Earnings API
 * GET: list earnings (transactions with type 'earning')
 * POST: create an earning (credit wallet + insert transaction)
 * PUT: update an earning (adjust transaction and wallet delta)
 * DELETE: delete an earning (reverse wallet and remove transaction)
 */

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const userId = url.searchParams.get('userId');

    let query = supabaseAdmin
      .from('transactions')
      .select('*, profiles(full_name,email)')
      .eq('type', 'earning')
      .order('created_at', { ascending: false });

    if (userId) query = query.eq('user_id', userId as string);

    const { data, error } = await query;

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(Array.isArray(data) ? data : []);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { userId, amount, reference, note } = await req.json();
    if (!userId || !amount) return NextResponse.json({ error: 'userId and amount required' }, { status: 400 });

    // Credit reward balance on profiles
    const { data: profileData, error: profileErr } = await supabaseAdmin.from('profiles').select('reward_balance_ngn').eq('id', userId).single();
    if (profileErr || !profileData) return NextResponse.json({ error: 'User profile not found' }, { status: 404 });

    const newRewardBalance = Number(profileData.reward_balance_ngn || 0) + Number(amount);
    const { error: updateError } = await supabaseAdmin.from('profiles').update({ reward_balance_ngn: newRewardBalance }).eq('id', userId);
    if (updateError) return NextResponse.json({ error: 'Failed to credit reward balance' }, { status: 500 });

    const { error: insertErr } = await supabaseAdmin.from('transactions').insert({
      user_id: userId,
      type: 'earning',
      amount: Number(amount),
      charged_amount: Number(amount),
      status: 'success',
      reference: reference || `EARNING-${Date.now()}`,
      meta: { note: note || null, admin_action: true }
    });

    if (insertErr) return NextResponse.json({ error: insertErr.message }, { status: 500 });

    return NextResponse.json({ success: true, newRewardBalance });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const { transactionId, amount } = await req.json();
    if (!transactionId || amount === undefined) return NextResponse.json({ error: 'transactionId and amount required' }, { status: 400 });

    const { data: tx, error: txErr } = await supabaseAdmin.from('transactions').select('*').eq('id', transactionId).single();
    if (txErr || !tx) return NextResponse.json({ error: 'Transaction not found' }, { status: 404 });
    if (tx.type !== 'earning') return NextResponse.json({ error: 'Not an earning transaction' }, { status: 400 });

    const delta = Number(amount) - Number(tx.amount || 0);

    // update reward balance on profiles
    const { data: profile, error: pErr } = await supabaseAdmin.from('profiles').select('reward_balance_ngn').eq('id', tx.user_id).single();
    if (pErr || !profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 });

    const newRewardBalance = Number(profile.reward_balance_ngn || 0) + delta;
    if (newRewardBalance < 0) return NextResponse.json({ error: 'Insufficient reward balance to apply change' }, { status: 400 });

    const { error: updatePErr } = await supabaseAdmin.from('profiles').update({ reward_balance_ngn: newRewardBalance }).eq('id', tx.user_id);
    if (updatePErr) return NextResponse.json({ error: 'Failed to update reward balance' }, { status: 500 });

    const { error: updateTxErr } = await supabaseAdmin.from('transactions').update({ amount: Number(amount), charged_amount: Number(amount), meta: { ...(tx.meta ?? {}), admin_edited: true } }).eq('id', transactionId);
    if (updateTxErr) return NextResponse.json({ error: 'Failed to update transaction' }, { status: 500 });

    return NextResponse.json({ success: true, newRewardBalance });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const { transactionId } = await req.json();
    if (!transactionId) return NextResponse.json({ error: 'transactionId required' }, { status: 400 });

    const { data: tx, error: txErr } = await supabaseAdmin.from('transactions').select('*').eq('id', transactionId).single();
    if (txErr || !tx) return NextResponse.json({ error: 'Transaction not found' }, { status: 404 });
    if (tx.type !== 'earning') return NextResponse.json({ error: 'Not an earning transaction' }, { status: 400 });

    // debit reward balance on profiles
    const { data: profile, error: pErr } = await supabaseAdmin.from('profiles').select('reward_balance_ngn').eq('id', tx.user_id).single();
    if (pErr || !profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 });

    const amount = Number(tx.charged_amount ?? tx.amount ?? 0);
    if (Number(profile.reward_balance_ngn || 0) < amount) return NextResponse.json({ error: 'Insufficient reward balance to reverse earning' }, { status: 400 });

    const { error: updatePErr } = await supabaseAdmin.from('profiles').update({ reward_balance_ngn: Number(profile.reward_balance_ngn || 0) - amount }).eq('id', tx.user_id);
    if (updatePErr) return NextResponse.json({ error: 'Failed to debit reward balance' }, { status: 500 });

    const { error: delErr } = await supabaseAdmin.from('transactions').delete().eq('id', transactionId);
    if (delErr) return NextResponse.json({ error: 'Failed to delete transaction' }, { status: 500 });

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
