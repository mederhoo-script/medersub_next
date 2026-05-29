import { NextResponse } from 'next/server'
import { applyReferralIfEligible, getRewardSpendEligibility, resolveRewardUser } from '@/lib/rewards'

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
    const refreshed = await resolveRewardUser({
      initData: body?.initData,
      rewardUid: body?.rewardUid || user.rewardUid,
      firstName: body?.firstName,
      username: body?.username,
    })
    const rewardSpendEligibility = getRewardSpendEligibility({
      telegramId: refreshed.telegramId,
      rewardAdsWatched: refreshed.rewardAdsWatched,
      rewardReferralsCount: refreshed.rewardReferralsCount,
    })

    return NextResponse.json({
      ok: true,
      user: {
        uid: refreshed.rewardUid,
        name: refreshed.fullName,
        email: refreshed.email,
        reward_balance_ngn: refreshed.rewardBalance,
        reward_ads_watched: refreshed.rewardAdsWatched,
        reward_referred_by: refreshed.rewardReferredBy,
        reward_referrals_count: refreshed.rewardReferralsCount,
        reward_referral_earnings_ngn: refreshed.rewardReferralEarningsNgn,
        reward_spend_stage: rewardSpendEligibility,
      },
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to load rewards profile'
    return NextResponse.json({ ok: false, error: message }, { status: 400 })
  }
}
