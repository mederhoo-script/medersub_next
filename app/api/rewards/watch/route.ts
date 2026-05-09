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

    const baseReward = 10
    const nextWatchCount = user.rewardAdsWatched + 1
    const bonusReward = nextWatchCount % 5 === 0 ? 5 : 0
    const totalReward = baseReward + bonusReward
    const newBalance = user.rewardBalance + totalReward

    const { error: updateError } = await supabaseAdmin
      .from('profiles')
      .update({
        reward_ads_watched: nextWatchCount,
        reward_balance_ngn: newBalance,
      })
      .eq('id', user.profileId)

    if (updateError) {
      throw new Error(updateError.message)
    }

    await supabaseAdmin.from('reward_transactions').insert({
      user_id: user.profileId,
      type: 'ad_reward',
      amount_ngn: baseReward,
      meta: {
        reward_uid: user.rewardUid,
      },
    })

    if (bonusReward > 0) {
      await supabaseAdmin.from('reward_transactions').insert({
        user_id: user.profileId,
        type: 'ad_bonus',
        amount_ngn: bonusReward,
        meta: {
          reward_uid: user.rewardUid,
          rule: 'every_5_ads',
        },
      })
    }

    return NextResponse.json({
      ok: true,
      earned_ngn: totalReward,
      new_balance_ngn: newBalance,
      ads_watched: nextWatchCount,
      bonus_ngn: bonusReward,
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to process reward'
    return NextResponse.json({ ok: false, error: message }, { status: 400 })
  }
}
