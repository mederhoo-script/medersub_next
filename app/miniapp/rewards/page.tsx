'use client'

import { useEffect, useState } from 'react'
import { Loader2, PlayCircle, Wallet, Gift, Copy, CheckCircle2 } from 'lucide-react'
import { BROWSER_REWARD_UID_REGEX, MONETAG_SCRIPT_LOAD_DELAY_MS } from '@/lib/reward-constants'

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

type MonetagAdOptions = {
  type?: 'preload'
  ymid?: string
  requestVar?: string
}

type MonetagAdFn = (options?: MonetagAdOptions) => void | Promise<void>

type TelegramWebApp = {
  ready?: () => void
  initData?: string
  initDataUnsafe?: {
    user?: {
      first_name?: string
      username?: string
    }
  }
}

const MONETAG_ZONE_ID = '10985896'
const BROWSER_UID_DIGIT_COUNT = 6
const BROWSER_UID_RANGE = 1_000_000
const MONETAG_FUNCTION_NAME = `show_${MONETAG_ZONE_ID}`
const MONETAG_SCRIPT_SRC = 'https://libtl.com/sdk.js'
const MONETAG_SCRIPT_TIMEOUT_MS = 12_000
const MONETAG_FUNCTION_WAIT_TIMEOUT_MS = 8_000
const MONETAG_FUNCTION_WAIT_INTERVAL_MS = 250

function getOrCreateBrowserUid(): string {
  const key = 'miniapp_reward_uid'
  const existing = window.localStorage.getItem(key)
  if (existing && BROWSER_REWARD_UID_REGEX.test(existing)) return existing

  const random = new Uint32Array(1)
  const maxUnbiased = Math.floor(0x1_0000_0000 / BROWSER_UID_RANGE) * BROWSER_UID_RANGE
  let sampled = 0
  do {
    globalThis.crypto.getRandomValues(random)
    sampled = random[0]
  } while (sampled >= maxUnbiased)

  const digits = String(sampled % BROWSER_UID_RANGE).padStart(BROWSER_UID_DIGIT_COUNT, '0')
  const generated = `USR${digits}`
  window.localStorage.setItem(key, generated)
  return generated
}

async function triggerMonetagRewardedInterstitial(options?: MonetagAdOptions): Promise<void> {
  const adFnSelector = `script[data-monetag-zone="${MONETAG_ZONE_ID}"][data-monetag-sdk="${MONETAG_FUNCTION_NAME}"]`
  const monetagWindow = window as unknown as Window & Record<string, unknown>

  let monetagScript = document.querySelector<HTMLScriptElement>(adFnSelector)
  if (!monetagScript) {
    const script = document.createElement('script')
    script.async = true
    script.setAttribute('data-cfasync', 'false')
    script.dataset.monetagZone = MONETAG_ZONE_ID
    script.dataset.monetagSdk = MONETAG_FUNCTION_NAME
    script.dataset.zone = MONETAG_ZONE_ID
    script.dataset.sdk = MONETAG_FUNCTION_NAME
    script.src = MONETAG_SCRIPT_SRC
    monetagScript = script
  }

  const loadScriptIfNeeded = async () => {
    const currentFn = monetagWindow[MONETAG_FUNCTION_NAME]
    if (typeof currentFn === 'function') return
    const scriptRef = monetagScript
    if (!scriptRef) {
      throw new Error('Monetag interstitial script element could not be prepared.')
    }

    await new Promise<void>((resolve, reject) => {
      const script = scriptRef
      let finished = false

      const finish = (callback: () => void) => {
        if (finished) return
        finished = true
        script.removeEventListener('load', onLoad)
        script.removeEventListener('error', onError)
        clearTimeout(timeoutId)
        callback()
      }

      const onLoad = () => finish(resolve)
      const onError = () =>
        finish(() =>
          reject(new Error('Failed to load Monetag interstitial script. It may be blocked by network policy or an ad blocker.')),
        )

      const timeoutId = window.setTimeout(() => {
        finish(() =>
          reject(new Error('Timed out while loading Monetag interstitial script. Check network/ad-blocking restrictions.')),
        )
      }, MONETAG_SCRIPT_TIMEOUT_MS)

      script.addEventListener('load', onLoad, { once: true })
      script.addEventListener('error', onError, { once: true })

      if (!script.isConnected) {
        document.head.appendChild(script)
      } else if (typeof monetagWindow[MONETAG_FUNCTION_NAME] === 'function') {
        finish(resolve)
      }
    })

    await new Promise(resolve => setTimeout(resolve, MONETAG_SCRIPT_LOAD_DELAY_MS))
  }

  await loadScriptIfNeeded()

  let adFn = monetagWindow[MONETAG_FUNCTION_NAME]
  const startedAt = Date.now()
  while (typeof adFn !== 'function' && Date.now() - startedAt < MONETAG_FUNCTION_WAIT_TIMEOUT_MS) {
    await new Promise(resolve => setTimeout(resolve, MONETAG_FUNCTION_WAIT_INTERVAL_MS))
    adFn = monetagWindow[MONETAG_FUNCTION_NAME]
  }

  if (typeof adFn === 'function') {
    try {
      await (adFn as MonetagAdFn)(options)
    } catch (error: unknown) {
      const reason = error instanceof Error ? error.message : 'Unknown Monetag error'
      throw new Error(`Monetag rewarded interstitial failed: ${reason}`)
    }
    return
  }

  throw new Error(
    `Monetag rewarded interstitial function ${MONETAG_FUNCTION_NAME} is unavailable. Ensure zone ID is the main SDK zone and check network/ad-blocking restrictions.`,
  )
}

export default function MiniappRewardsPage() {
  const [referredBy, setReferredBy] = useState<string | undefined>(undefined)

  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [adReady, setAdReady] = useState(false)
  const [withdrawAmount, setWithdrawAmount] = useState('')
  const [origin, setOrigin] = useState('')
  const [profile, setProfile] = useState<RewardProfile | null>(null)
  const [identity, setIdentity] = useState<{ initData?: string; rewardUid?: string; firstName?: string; username?: string }>({})
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const fetchProfile = async (payload: { initData?: string; rewardUid?: string; firstName?: string; username?: string; referredBy?: string }) => {
    const res = await fetch('/api/rewards/profile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const data = await res.json()
    if (!res.ok || !data.ok) throw new Error(data.error || 'Failed to load rewards')
    setProfile(data.user as RewardProfile)
  }

  const loadProfile = async (overrides?: { initData?: string; rewardUid?: string; firstName?: string; username?: string }) => {
    await fetchProfile({
      ...identity,
      ...overrides,
      referredBy,
    })
  }

  useEffect(() => {
    let active = true
    ;(async () => {
      try {
        setOrigin(window.location.origin)
        const refParam = new URLSearchParams(window.location.search).get('ref') || undefined
        setReferredBy(refParam)
        const tg = (window as Window & { Telegram?: { WebApp?: TelegramWebApp } }).Telegram?.WebApp
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
          await fetchProfile({ ...nextIdentity, referredBy: refParam })
        } else {
          const uid = getOrCreateBrowserUid()
          const nextIdentity = { rewardUid: uid }
          if (!active) return
          setIdentity(nextIdentity)
          await fetchProfile({ ...nextIdentity, referredBy: refParam })
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
  }, [])

  useEffect(() => {
    if (loading || !profile || adReady) return
    let cancelled = false
    const preloadYmid = `${profile.uid}-preload`
    triggerMonetagRewardedInterstitial({ type: 'preload', ymid: preloadYmid, requestVar: 'miniapp_rewards_watch' })
      .then(() => {
        if (!cancelled) setAdReady(true)
      })
      .catch(() => {
        if (!cancelled) setAdReady(false)
      })

    return () => {
      cancelled = true
    }
  }, [loading, profile, adReady])

  const handleWatchAndEarn = async () => {
    if (!profile) return
    setBusy(true)
    setMessage(null)
    try {
      if (!adReady) {
        await triggerMonetagRewardedInterstitial({
          type: 'preload',
          ymid: `${profile.uid}-retry-preload-${Date.now()}`,
          requestVar: 'miniapp_rewards_watch',
        })
        setAdReady(true)
      }
      const rewardYmid = `${profile.uid}-${Date.now()}`
      await triggerMonetagRewardedInterstitial({ ymid: rewardYmid, requestVar: 'miniapp_rewards_watch' })
      setAdReady(false)

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
              {adReady ? 'Watch Ad & Earn ₦10' : 'Watch Ad (Preparing...)'}
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
