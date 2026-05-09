import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

export async function PATCH(req: Request) {
  try {
    const body = await req.json().catch(() => ({}))
    const withdrawalId = Number(body?.withdrawalId)
    const status = String(body?.status || '').toLowerCase()
    const note = body?.note ? String(body.note) : null

    if (!Number.isFinite(withdrawalId)) {
      return NextResponse.json({ ok: false, error: 'Invalid withdrawalId' }, { status: 400 })
    }

    if (status !== 'approved' && status !== 'rejected') {
      return NextResponse.json({ ok: false, error: 'status must be approved or rejected' }, { status: 400 })
    }

    const { data: withdrawal, error: fetchError } = await supabaseAdmin
      .from('reward_withdrawals')
      .select('*')
      .eq('id', withdrawalId)
      .single()

    if (fetchError || !withdrawal) {
      return NextResponse.json({ ok: false, error: 'Withdrawal not found' }, { status: 404 })
    }

    if (withdrawal.status !== 'pending') {
      return NextResponse.json({ ok: false, error: 'Withdrawal already reviewed' }, { status: 400 })
    }

    await supabaseAdmin
      .from('reward_withdrawals')
      .update({
        status,
        reviewed_at: new Date().toISOString(),
        review_note: note,
      })
      .eq('id', withdrawalId)

    if (status === 'rejected') {
      const { data: userProfile, error: userError } = await supabaseAdmin
        .from('profiles')
        .select('reward_balance_ngn')
        .eq('id', withdrawal.user_id)
        .single()

      if (!userError && userProfile) {
        const refundedBalance = Number(userProfile.reward_balance_ngn || 0) + Number(withdrawal.amount_ngn || 0)
        await supabaseAdmin
          .from('profiles')
          .update({ reward_balance_ngn: refundedBalance })
          .eq('id', withdrawal.user_id)

        await supabaseAdmin.from('reward_transactions').insert({
          user_id: withdrawal.user_id,
          type: 'withdraw_refund',
          amount_ngn: Number(withdrawal.amount_ngn || 0),
          meta: {
            withdrawal_id: withdrawal.id,
            reason: note || 'Admin rejected withdrawal',
          },
        })
      }
    }

    return NextResponse.json({ ok: true })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to update withdrawal'
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
