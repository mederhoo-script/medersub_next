'use client'

import { useEffect, useMemo, useState } from 'react'
import { Loader2, PlayCircle, Wallet, Gift, Copy, CheckCircle2 } from 'lucide-react'
import { useSearchParams } from 'next/navigation'

type RewardProfile = {
  uid: string
  name: string
  email: string
  reward_balance_ngn: number
  reward_ads_watched: number
  reward_referred_by: string | null
  reward_referrals_count: number
  reward_referral_earnings_ngn: number
}

const MONETAG_ZONE_ID = process.env.NEXT_PUBLIC_MONETAG_ZONE_ID || 'MONETAG_ZONE_ID_HERE'

function getOrCreateBrowserUid(): string {
  const key = 'miniapp_reward_uid'
  const existing = window.localStorage.getItem(key)
  if (existing && /^USR\d{5,}$/.test(existing)) return existing

  const generated = `USR${Math.floor(10000 + Math.random() * 90000)}`
  window.localStorage.setItem(key, generated)
  return generated
}

async function triggerMonetagRewardedInterstitial(): Promise<void> {
  if (!document.querySelector(`script[data-monetag-zone="${MONETAG_ZONE_ID}"]`)) {
    const script = document.createElement('script')
    script.async = true
    script.dataset.monetagZone = MONETAG_ZONE_ID
    script.src = `https://5gvci.com/act/files/tag.min.js?z=${MONETAG_ZONE_ID}`
    document.head.appendChild(script)
    await new Promise(resolve => setTimeout(resolve, 1200))
  }

  const adFn = (window as any)[`show_${MONETAG_ZONE_ID}`]
  if (typeof adFn === 'function') {
    await adFn()
  }
}

export default function MiniappRewardsPage() {
  const searchParams = useSearchParams()
  const referredBy = useMemo(() => searchParams.get('ref') || undefined, [searchParams])

  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [withdrawAmount, setWithdrawAmount] = useState('')
  const [origin, setOrigin] = useState('')
  const [profile, setProfile] = useState<RewardProfile | null>(null)
  const [identity, setIdentity] = useState<{ initData?: string; rewardUid?: string; firstName?: string; username?: string }>({})
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const loadProfile = async (overrides?: { initData?: string; rewardUid?: string; firstName?: string; username?: string }) => {
    const payload = {
      ...identity,
      ...overrides,
      referredBy,
    }
    const res = await fetch('/api/rewards/profile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const data = await res.json()
    if (!res.ok || !data.ok) throw new Error(data.error || 'Failed to load rewards')
    setProfile(data.user as RewardProfile)
  }

  useEffect(() => {
    let active = true
    ;(async () => {
      try {
        setOrigin(window.location.origin)
        const tg = (window as any).Telegram?.WebApp
        if (tg?.ready) tg.ready()

        if (tg?.initData) {
          const user = tg.initDataUnsafe?.user || {}
          const nextIdentity = {
            initData: tg.initData as string,
            firstName: user.first_name as string | undefined,
            username: user.username as string | undefined,
          }
          if (!active) return
          setIdentity(nextIdentity)
          await loadProfile(nextIdentity)
        } else {
          const uid = getOrCreateBrowserUid()
          const nextIdentity = { rewardUid: uid }
          if (!active) return
          setIdentity(nextIdentity)
          await loadProfile(nextIdentity)
        }
      } catch (err: unknown) {
        const text = err instanceof Error ? err.message : 'Failed to initialize rewards app'
        if (active) setMessage({ type: 'error', text })
      } finally {
        if (active) setLoading(false)
      }
    })()
    return () => {
      active = false
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleWatchAndEarn = async () => {
    if (!profile) return
    setBusy(true)
    setMessage(null)
    try {
      await triggerMonetagRewardedInterstitial()

      const res = await fetch('/api/rewards/watch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...identity, referredBy }),
      })
      const data = await res.json()
      if (!res.ok || !data.ok) throw new Error(data.error || 'Failed to claim reward')

      await loadProfile()
      setMessage({ type: 'success', text: `You earned ₦${Number(data.earned_ngn || 0).toLocaleString()}!` })
    } catch (err: unknown) {
      const text = err instanceof Error ? err.message : 'Failed to claim ad reward'
      setMessage({ type: 'error', text })
    } finally {
      setBusy(false)
    }
  }

  const handleWithdraw = async () => {
    if (!profile) return
    const amount = Number(withdrawAmount)
    if (!Number.isFinite(amount) || amount <= 0) {
      setMessage({ type: 'error', text: 'Enter a valid withdrawal amount' })
      return
    }

    setBusy(true)
    setMessage(null)
    try {
      const res = await fetch('/api/rewards/withdraw', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...identity, amount }),
      })
      const data = await res.json()
      if (!res.ok || !data.ok) throw new Error(data.error || 'Withdrawal failed')
      setWithdrawAmount('')
      await loadProfile()
      setMessage({ type: 'success', text: 'Withdrawal request submitted successfully.' })
    } catch (err: unknown) {
      const text = err instanceof Error ? err.message : 'Failed to submit withdrawal'
      setMessage({ type: 'error', text })
    } finally {
      setBusy(false)
    }
  }

  const referralLink = profile ? `${origin}/miniapp/rewards?ref=${encodeURIComponent(profile.uid)}` : ''

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-6">
      <div className="max-w-lg mx-auto space-y-4">
        <h1 className="text-2xl font-bold text-gray-900">Click/Watch to Earn</h1>
        <p className="text-sm text-gray-500">Watch ads and earn Naira tokens you can spend in VTU purchases.</p>

        {loading ? (
          <div className="bg-white rounded-xl p-6 border border-gray-200 flex items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
          </div>
        ) : profile ? (
          <>
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <p className="text-sm text-gray-500">User UID</p>
              <p className="font-mono text-sm">{profile.uid}</p>
              <p className="mt-2 text-sm text-gray-500">Name</p>
              <p className="font-medium">{profile.name}</p>
            </div>

            <div className="bg-blue-600 text-white rounded-xl p-5">
              <div className="flex items-center gap-2 text-blue-100 text-sm"><Wallet className="h-4 w-4" /> Reward Balance</div>
              <p className="text-3xl font-bold mt-1">₦{Number(profile.reward_balance_ngn || 0).toLocaleString()}</p>
              <div className="mt-3 text-sm text-blue-100">Ads watched: {profile.reward_ads_watched}</div>
            </div>

            <button
              onClick={handleWatchAndEarn}
              disabled={busy}
              className="w-full py-3 rounded-xl bg-green-600 hover:bg-green-700 text-white font-semibold disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <PlayCircle className="h-4 w-4" />}
              Watch Ad & Earn ₦10
            </button>

            <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-gray-900"><Gift className="h-4 w-4" /> Referrals</div>
              <p className="text-sm text-gray-600">Referrals: {profile.reward_referrals_count} • Earnings: ₦{Number(profile.reward_referral_earnings_ngn || 0).toLocaleString()}</p>
              <button
                className="inline-flex items-center gap-2 text-sm text-blue-600 hover:underline"
                onClick={async () => {
                  await navigator.clipboard.writeText(referralLink)
                  setMessage({ type: 'success', text: 'Referral link copied.' })
                }}
              >
                <Copy className="h-4 w-4" /> Copy Referral Link
              </button>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
              <label className="block text-sm font-medium text-gray-700">Request Withdrawal</label>
              <input
                type="number"
                min="1"
                value={withdrawAmount}
                onChange={(e) => setWithdrawAmount(e.target.value)}
                placeholder="Enter amount in NGN"
                className="w-full rounded-lg border border-gray-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                onClick={handleWithdraw}
                disabled={busy}
                className="w-full py-2.5 rounded-lg bg-gray-900 text-white font-medium hover:bg-gray-800 disabled:opacity-60"
              >
                Submit Withdrawal
              </button>
            </div>
          </>
        ) : null}

        {message && (
          <div className={`rounded-xl p-3 text-sm ${message.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
            <div className="flex items-start gap-2">
              <CheckCircle2 className="h-4 w-4 mt-0.5" />
              <span>{message.text}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
