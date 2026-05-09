import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { applyReferralIfEligible, resolveRewardUser } from '@/lib/rewards'

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}))
    const user = await resolveRewardUser({
      initData: body?.initData,
      rewardUid: body?.rewardUid,
      firstName: body?.firstName,
      username: body?.username,
      referredBy: body?.referredBy,
    })

    await applyReferralIfEligible(user, body?.referredBy)

    const { data: watchClaimData, error: watchClaimError } = await supabaseAdmin.rpc('claim_reward_watch', {
      p_user_id: user.profileId,
      p_reward_uid: user.rewardUid,
    })

    if (watchClaimError || !Array.isArray(watchClaimData) || !watchClaimData[0]) {
      throw new Error(watchClaimError?.message || 'Failed to claim ad reward')
    }

    const claim = watchClaimData[0]

    return NextResponse.json({
      ok: true,
      earned_ngn: Number(claim.earned_ngn || 0),
      new_balance_ngn: Number(claim.new_balance_ngn || 0),
      ads_watched: Number(claim.ads_watched || 0),
      bonus_ngn: Number(claim.bonus_ngn || 0),
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to process reward'
    return NextResponse.json({ ok: false, error: message }, { status: 400 })
  }
}
