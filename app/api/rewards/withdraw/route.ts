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

    const { data: withdrawalData, error: withdrawalError } = await supabaseAdmin.rpc('request_reward_withdrawal', {
      p_user_id: user.profileId,
      p_amount: amount,
      p_reward_uid: user.rewardUid,
    })

    if (withdrawalError || !Array.isArray(withdrawalData) || !withdrawalData[0]) {
      throw new Error(withdrawalError?.message || 'Failed to create withdrawal request')
    }

    const newBalance = Number(withdrawalData[0].new_balance_ngn || 0)

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
