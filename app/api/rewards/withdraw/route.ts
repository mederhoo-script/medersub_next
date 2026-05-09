import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { resolveRewardUser } from '@/lib/rewards'

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}))
    const user = await resolveRewardUser({
      initData: body?.initData,
      rewardUid: body?.rewardUid,
      firstName: body?.firstName,
      username: body?.username,
    })

    const amount = Number(body?.amount || 0)
    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json({ ok: false, error: 'Invalid withdrawal amount' }, { status: 400 })
    }

    if (user.rewardBalance < amount) {
      return NextResponse.json({ ok: false, error: 'Insufficient reward balance' }, { status: 400 })
    }

    const newBalance = user.rewardBalance - amount
    let withdrawalId: number | null = null

    const { error: updateError } = await supabaseAdmin
      .from('profiles')
      .update({ reward_balance_ngn: newBalance })
      .eq('id', user.profileId)

    if (updateError) {
      throw new Error(updateError.message)
    }

    const { data: createdWithdrawal, error: withdrawalError } = await supabaseAdmin
      .from('reward_withdrawals')
      .insert({
      user_id: user.profileId,
      amount_ngn: amount,
      status: 'pending',
      })
      .select('id')
      .single()

    if (withdrawalError || !createdWithdrawal) {
      await supabaseAdmin
        .from('profiles')
        .update({ reward_balance_ngn: user.rewardBalance })
        .eq('id', user.profileId)
      throw new Error(withdrawalError?.message || 'Failed to create withdrawal')
    }

    withdrawalId = createdWithdrawal.id as number

    const { error: rewardTxError } = await supabaseAdmin.from('reward_transactions').insert({
      user_id: user.profileId,
      type: 'withdraw_request',
      amount_ngn: -amount,
      meta: {
        reward_uid: user.rewardUid,
        withdrawal_id: withdrawalId,
      },
    })

    if (rewardTxError) {
      await supabaseAdmin
        .from('reward_withdrawals')
        .delete()
        .eq('id', withdrawalId)
      await supabaseAdmin
        .from('profiles')
        .update({ reward_balance_ngn: user.rewardBalance })
        .eq('id', user.profileId)
      throw new Error(rewardTxError.message)
    }

    return NextResponse.json({
      ok: true,
      new_balance_ngn: newBalance,
      message: 'Withdrawal request submitted',
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to process withdrawal'
    return NextResponse.json({ ok: false, error: message }, { status: 400 })
  }
}
