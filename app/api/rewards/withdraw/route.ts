import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { resolveRewardUser } from '@/lib/rewards'

const WITHDRAWAL_MIN_EARNINGS = 20_000
const WITHDRAWAL_MIN_REFERRALS = 5
const WITHDRAWAL_PAYOUT_DIVISOR = 10

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}))
    const user = await resolveRewardUser({
      initData: body?.initData,
      rewardUid: body?.rewardUid,
      firstName: body?.firstName,
      username: body?.username,
    })

    const earnAmount = Number(body?.earnAmount || 0)
    if (!Number.isFinite(earnAmount) || earnAmount <= 0) {
      return NextResponse.json({ ok: false, error: 'Invalid withdrawal amount' }, { status: 400 })
    }
    if (earnAmount < WITHDRAWAL_MIN_EARNINGS) {
      return NextResponse.json(
        { ok: false, error: `Minimum withdrawal request is ${WITHDRAWAL_MIN_EARNINGS.toLocaleString()} earn.` },
        { status: 400 },
      )
    }

    if (user.rewardBalance < WITHDRAWAL_MIN_EARNINGS || user.rewardReferralsCount < WITHDRAWAL_MIN_REFERRALS) {
      return NextResponse.json(
        {
          ok: false,
          error: `You need at least ${WITHDRAWAL_MIN_EARNINGS.toLocaleString()} earn and ${WITHDRAWAL_MIN_REFERRALS} referrals before requesting withdrawal.`,
        },
        { status: 400 },
      )
    }

    if (user.rewardBalance < earnAmount) {
      return NextResponse.json({ ok: false, error: 'Insufficient reward balance' }, { status: 400 })
    }

    const accountNumber = String(body?.accountNumber || '').trim()
    const accountName = String(body?.accountName || '').trim()
    const bankName = String(body?.bankName || '').trim()
    if (!accountNumber || !accountName || !bankName) {
      return NextResponse.json(
        { ok: false, error: 'Account number, account name, and bank name are required' },
        { status: 400 },
      )
    }

    const payoutAmountNgn = Math.round((earnAmount / WITHDRAWAL_PAYOUT_DIVISOR) * 100) / 100
    const { data: withdrawalData, error: withdrawalError } = await supabaseAdmin.rpc('request_reward_withdrawal', {
      p_user_id: user.profileId,
      p_earn_amount: earnAmount,
      p_payout_amount_ngn: payoutAmountNgn,
      p_reward_uid: user.rewardUid,
      p_account_number: accountNumber,
      p_account_name: accountName,
      p_bank_name: bankName,
    })

    if (withdrawalError || !Array.isArray(withdrawalData) || !withdrawalData[0]) {
      throw new Error(withdrawalError?.message || 'Failed to create withdrawal request')
    }

    const newBalance = Number(withdrawalData[0].new_balance_ngn || 0)
    const payoutAmount = Number(withdrawalData[0].payout_amount_ngn || payoutAmountNgn)

    return NextResponse.json({
      ok: true,
      new_balance_ngn: newBalance,
      payout_amount_ngn: payoutAmount,
      message: 'Withdrawal request submitted',
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to process withdrawal'
    return NextResponse.json({ ok: false, error: message }, { status: 400 })
  }
}
