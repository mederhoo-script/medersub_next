'use client'

import { useEffect, useState } from 'react'
import { Loader2, PlayCircle, Wallet, Gift, Copy, CheckCircle2, AlertCircle } from 'lucide-react'
import { BROWSER_REWARD_UID_REGEX, MONETAG_SCRIPT_LOAD_DELAY_MS } from '@/lib/reward-constants'
import { normalizeReferralUid } from '@/lib/reward-referral'
import Link from 'next/link'

type RewardProfile = {
  uid: string
  name: string
  email: string
  reward_balance_ngn: number
  reward_ads_watched: number
  reward_referred_by: string | null
  reward_referrals_count: number
  reward_referral_earnings_ngn: number
  reward_spend_stage?: {
    isTelegramUser: boolean
    canSpendRewards: boolean
    requiredAdsWatched: number
    requiredReferrals: number
    remainingAdsToWatch: number
    remainingReferrals: number
  }
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
    start_param?: string
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
const DEFAULT_TELEGRAM_REFERRAL_BOT_USERNAME = 'medersub_Bot'
const TELEGRAM_REFERRAL_BOT_USERNAME = /^[A-Za-z0-9_]{5,32}$/.test(process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME || '')
  ? (process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME as string)
  : DEFAULT_TELEGRAM_REFERRAL_BOT_USERNAME
const WITHDRAWAL_MIN_EARNINGS = 20_000
const WITHDRAWAL_MIN_REFERRALS = 5
const WITHDRAWAL_PAYOUT_DIVISOR = 10

function getReferralStartParam(uid: string): string {
  return uid.startsWith('TG-') ? uid.slice(3) : uid
}

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
      const adResult = (adFn as MonetagAdFn)(options)
      if (options?.type !== 'preload') {
        await adResult
      }
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
  const [adStatus, setAdStatus] = useState<'idle' | 'loading' | 'ready' | 'failed'>('idle')
  const [withdrawEarnAmount, setWithdrawEarnAmount] = useState('')
  const [accountNumber, setAccountNumber] = useState('')
  const [accountName, setAccountName] = useState('')
  const [bankName, setBankName] = useState('')
  const [profile, setProfile] = useState<RewardProfile | null>(null)
  const [nextAdAt, setNextAdAt] = useState<string | null>(null)
  const [cooldownSeconds, setCooldownSeconds] = useState(0)
  const [identity, setIdentity] = useState<{ initData?: string; rewardUid?: string; firstName?: string; username?: string }>({})
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const preloadAd = async (ymid: string) => {
    setAdStatus('loading')
    await triggerMonetagRewardedInterstitial({ type: 'preload', ymid, requestVar: 'miniapp_rewards_watch' })
    setAdStatus('ready')
  }

  const getWatchButtonText = () => {
    if (cooldownSeconds > 0) return `Watch Ad in ${cooldownSeconds}s`
    if (adStatus === 'ready') return 'Watch Ad & Earn ₦10'
    if (adStatus === 'loading') return 'Watch Ad (Loading...)'
    if (adStatus === 'failed') return 'Watch Ad (Tap to Retry)'
    return 'Watch Ad & Earn ₦10'
  }

  const getSpendLockText = (stage: NonNullable<RewardProfile['reward_spend_stage']>) => {
    const requirements = [
      stage.remainingAdsToWatch > 0
        ? `watch at least ${stage.remainingAdsToWatch} more ${stage.remainingAdsToWatch === 1 ? 'ad' : 'ads'}`
        : '',
      stage.remainingReferrals > 0
        ? `refer ${stage.remainingReferrals} more ${stage.remainingReferrals === 1 ? 'user' : 'users'}`
        : '',
    ].filter(Boolean)

    if (requirements.length === 0) return ''

    const sentence = requirements.join(' and ')
    return `${sentence.charAt(0).toUpperCase()}${sentence.slice(1)} to spend rewards.`
  }

  const fetchProfile = async (payload: { initData?: string; rewardUid?: string; firstName?: string; username?: string; referredBy?: string }) => {
    const res = await fetch('/api/rewards/profile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const data = await res.json()
    if (!res.ok || !data.ok) throw new Error(data.error || 'Failed to load rewards')
    setProfile(data.user as RewardProfile)
    setNextAdAt(typeof data.next_ad_at === 'string' ? data.next_ad_at : null)
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
        const normalizedUrlRef = normalizeReferralUid(new URLSearchParams(window.location.search).get('ref')) || undefined
        const tg = (window as Window & { Telegram?: { WebApp?: TelegramWebApp } }).Telegram?.WebApp
        const normalizedStartParamRef = normalizeReferralUid(tg?.initDataUnsafe?.start_param) || undefined
        const resolvedReferredBy = normalizedUrlRef || normalizedStartParamRef
        setReferredBy(resolvedReferredBy)
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
          await fetchProfile({ ...nextIdentity, referredBy: resolvedReferredBy })
        } else {
          const uid = getOrCreateBrowserUid()
          const nextIdentity = { rewardUid: uid }
          if (!active) return
          setIdentity(nextIdentity)
          await fetchProfile({ ...nextIdentity, referredBy: resolvedReferredBy })
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
    if (!nextAdAt) {
      setCooldownSeconds(0)
      return
    }

    const parsedNextAdAt = new Date(nextAdAt).getTime()
    if (!Number.isFinite(parsedNextAdAt)) {
      setCooldownSeconds(0)
      return
    }

    const updateCooldown = () => {
      const remaining = Math.ceil((parsedNextAdAt - Date.now()) / 1000)
      setCooldownSeconds(Math.max(0, remaining))
    }

    updateCooldown()
    const timer = window.setInterval(updateCooldown, 1000)
    return () => window.clearInterval(timer)
  }, [nextAdAt])

  useEffect(() => {
    if (loading || !profile || adStatus !== 'idle') return
    let cancelled = false
    const preloadYmid = `${profile.uid}-preload`
    preloadAd(preloadYmid)
      .catch((error: unknown) => {
        const reason = error instanceof Error ? error.message : 'Unknown preload error'
        console.warn(`Monetag preload failed: ${reason}`)
        if (!cancelled) setAdStatus('failed')
      })

    return () => {
      cancelled = true
    }
  }, [loading, profile, adStatus])

  const handleWatchAndEarn = async () => {
    if (!profile) return
    if (cooldownSeconds > 0) {
      setMessage({ type: 'error', text: `Please wait ${cooldownSeconds} seconds before watching the next ad.` })
      return
    }
    setBusy(true)
    setMessage(null)
    try {
      if (adStatus !== 'ready') {
        try {
          await preloadAd(`${profile.uid}-retry-preload-${Date.now()}`)
        } catch (error: unknown) {
          const reason = error instanceof Error ? error.message : 'Unknown preload error'
          setAdStatus('failed')
          throw new Error(`Ad preload failed: ${reason}`)
        }
      }
      const rewardYmid = `${profile.uid}-${Date.now()}`
      await triggerMonetagRewardedInterstitial({ ymid: rewardYmid, requestVar: 'miniapp_rewards_watch' })
      setAdStatus('idle')

      const res = await fetch('/api/rewards/watch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...identity, referredBy }),
      })
      const data = await res.json()
      if (!res.ok || !data.ok) throw new Error(data.error || 'Failed to claim reward')
      if (typeof data.next_ad_at === 'string') setNextAdAt(data.next_ad_at)

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
    const earnAmount = Number(withdrawEarnAmount)
    if (!Number.isFinite(earnAmount) || earnAmount <= 0) {
      setMessage({ type: 'error', text: 'Enter a valid withdrawal amount' })
      return
    }
    if (earnAmount < WITHDRAWAL_MIN_EARNINGS) {
      setMessage({ type: 'error', text: `Minimum withdrawal request is ${WITHDRAWAL_MIN_EARNINGS.toLocaleString()} earn.` })
      return
    }
    if (!accountNumber.trim() || !accountName.trim() || !bankName.trim()) {
      setMessage({ type: 'error', text: 'Enter account number, account name, and bank name.' })
      return
    }
    if (profile.reward_balance_ngn < WITHDRAWAL_MIN_EARNINGS || profile.reward_referrals_count < WITHDRAWAL_MIN_REFERRALS) {
      setMessage({
        type: 'error',
        text: `You need at least ${WITHDRAWAL_MIN_EARNINGS.toLocaleString()} earn and ${WITHDRAWAL_MIN_REFERRALS} referrals before requesting withdrawal.`,
      })
      return
    }

    const payoutAmount = earnAmount / WITHDRAWAL_PAYOUT_DIVISOR
    const confirmed = window.confirm(
      [
        `Conversion rate: ${WITHDRAWAL_PAYOUT_DIVISOR} earn = ₦1.`,
        `${earnAmount.toLocaleString()} earn will pay ₦${payoutAmount.toLocaleString()}.`,
        'Confirm withdrawal?',
      ].join('\n'),
    )
    if (!confirmed) {
      return
    }

    setBusy(true)
    setMessage(null)
    try {
      const res = await fetch('/api/rewards/withdraw', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...identity,
          earnAmount,
          accountNumber: accountNumber.trim(),
          accountName: accountName.trim(),
          bankName: bankName.trim(),
        }),
      })
      const data = await res.json()
      if (!res.ok || !data.ok) throw new Error(data.error || 'Withdrawal failed')
      setWithdrawEarnAmount('')
      setAccountNumber('')
      setAccountName('')
      setBankName('')
      await loadProfile()
      setMessage({
        type: 'success',
        text: `Withdrawal submitted. ${earnAmount.toLocaleString()} earn converts to ₦${Number(data.payout_amount_ngn || 0).toLocaleString()}.`,
      })
    } catch (err: unknown) {
      const text = err instanceof Error ? err.message : 'Failed to submit withdrawal'
      setMessage({ type: 'error', text })
    } finally {
      setBusy(false)
    }
  }

  const referralLink = profile
    ? `https://t.me/${TELEGRAM_REFERRAL_BOT_USERNAME}?start=${encodeURIComponent(getReferralStartParam(profile.uid))}`
    : ''
  const isWithdrawalLocked =
    !profile ||
    profile.reward_balance_ngn < WITHDRAWAL_MIN_EARNINGS ||
    profile.reward_referrals_count < WITHDRAWAL_MIN_REFERRALS

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
              disabled={busy || cooldownSeconds > 0}
              className="w-full py-3 rounded-xl bg-green-600 hover:bg-green-700 text-white font-semibold disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <PlayCircle className="h-4 w-4" />}
              {getWatchButtonText()}
            </button>

            {message && (
              <div className={`rounded-xl p-3 text-sm ${message.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                <div className="flex items-start gap-2">
                  {message.type === 'success' ? (
                    <CheckCircle2 className="h-4 w-4 mt-0.5" />
                  ) : (
                    <AlertCircle className="h-4 w-4 mt-0.5" />
                  )}
                  <span>{message.text}</span>
                </div>
              </div>
            )}

            {profile.reward_spend_stage?.isTelegramUser && (
              <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-1">
                <p className="text-sm font-semibold text-gray-900">Telegram Reward Spend Stage</p>
                <p className="text-sm text-gray-600">
                  Ads progress: {profile.reward_spend_stage.requiredAdsWatched - profile.reward_spend_stage.remainingAdsToWatch}/{profile.reward_spend_stage.requiredAdsWatched}
                </p>
                <p className="text-sm text-gray-600">
                  Referral progress: {profile.reward_spend_stage.requiredReferrals - profile.reward_spend_stage.remainingReferrals}/{profile.reward_spend_stage.requiredReferrals}
                </p>
                {!profile.reward_spend_stage.canSpendRewards && (
                  <p className="text-xs text-amber-700">
                    {getSpendLockText(profile.reward_spend_stage)}
                  </p>
                )}
              </div>
            )}

            {profile.reward_spend_stage?.canSpendRewards ?? true ? (
              <Link
                href="/dashboard"
                className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold flex items-center justify-center"
              >
                Spend Earnings
              </Link>
            ) : (
              <button
                type="button"
                disabled
                className="w-full py-3 rounded-xl bg-gray-300 text-gray-600 font-semibold flex items-center justify-center"
              >
                Spend Earnings (Locked)
              </button>
            )}

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
              <p className="text-xs text-gray-500">
                Minimum: {WITHDRAWAL_MIN_EARNINGS.toLocaleString()} earn and {WITHDRAWAL_MIN_REFERRALS} referrals. Payout conversion rate: {WITHDRAWAL_PAYOUT_DIVISOR} earn = ₦1.
              </p>
              <input
                type="number"
                min="1"
                value={withdrawEarnAmount}
                onChange={(e) => setWithdrawEarnAmount(e.target.value)}
                placeholder="Enter amount in earn"
                className="w-full rounded-lg border border-gray-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <input
                type="text"
                value={accountNumber}
                onChange={(e) => setAccountNumber(e.target.value)}
                placeholder="Account number"
                className="w-full rounded-lg border border-gray-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <input
                type="text"
                value={accountName}
                onChange={(e) => setAccountName(e.target.value)}
                placeholder="Account name"
                className="w-full rounded-lg border border-gray-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <input
                type="text"
                value={bankName}
                onChange={(e) => setBankName(e.target.value)}
                placeholder="Bank name"
                className="w-full rounded-lg border border-gray-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {isWithdrawalLocked && (
                <p className="text-xs text-amber-700">
                  You need at least {WITHDRAWAL_MIN_EARNINGS.toLocaleString()} earn and {WITHDRAWAL_MIN_REFERRALS} referrals to withdraw.
                </p>
              )}
              <button
                onClick={handleWithdraw}
                disabled={busy || isWithdrawalLocked}
                className="w-full py-2.5 rounded-lg bg-gray-900 text-white font-medium hover:bg-gray-800 disabled:opacity-60"
              >
                Submit Withdrawal
              </button>
            </div>
          </>
        ) : null}
      </div>
    </div>
  )
}
