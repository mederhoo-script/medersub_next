import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

export async function GET() {
  try {
    const [profilesResult, pendingWithdrawalsResult, recentTxResult] = await Promise.all([
      supabaseAdmin
        .from('profiles')
        .select('id,email,full_name,reward_uid,reward_balance_ngn,reward_ads_watched,reward_referrals_count,reward_referral_earnings_ngn')
        .not('reward_uid', 'is', null)
        .order('reward_balance_ngn', { ascending: false }),
      supabaseAdmin
        .from('reward_withdrawals')
        .select('*, profiles(email, full_name, reward_uid)')
        .eq('status', 'pending')
        .order('created_at', { ascending: false }),
      supabaseAdmin
        .from('reward_transactions')
        .select('*, profiles(email, full_name, reward_uid)')
        .order('created_at', { ascending: false })
        .limit(50),
    ])

    if (profilesResult.error) throw new Error(profilesResult.error.message)
    if (pendingWithdrawalsResult.error) throw new Error(pendingWithdrawalsResult.error.message)
    if (recentTxResult.error) throw new Error(recentTxResult.error.message)

    const profiles = profilesResult.data || []
    const totalRewardOutstanding = profiles.reduce((sum, p) => sum + Number(p.reward_balance_ngn || 0), 0)
    const totalAdsWatched = profiles.reduce((sum, p) => sum + Number(p.reward_ads_watched || 0), 0)
    const totalReferralEarnings = profiles.reduce((sum, p) => sum + Number(p.reward_referral_earnings_ngn || 0), 0)

    return NextResponse.json({
      ok: true,
      stats: {
        users_with_reward_uid: profiles.length,
        total_reward_outstanding_ngn: totalRewardOutstanding,
        total_ads_watched: totalAdsWatched,
        total_referral_earnings_ngn: totalReferralEarnings,
        pending_withdrawals_count: (pendingWithdrawalsResult.data || []).length,
      },
      users: profiles.slice(0, 50),
      pending_withdrawals: pendingWithdrawalsResult.data || [],
      recent_transactions: recentTxResult.data || [],
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to load rewards admin data'
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
