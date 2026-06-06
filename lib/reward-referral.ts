import { BROWSER_REWARD_UID_REGEX, TELEGRAM_REWARD_UID_REGEX } from '@/lib/reward-constants'

export function normalizeReferralUid(referredBy: string | null | undefined): string | null {
  const value = referredBy?.trim()
  if (!value) return null
  if (TELEGRAM_REWARD_UID_REGEX.test(value) || BROWSER_REWARD_UID_REGEX.test(value)) return value
  // Telegram deep links often pass `start=<telegram_id>`; normalize that to our canonical TG format.
  if (/^\d+$/.test(value)) return `TG-${value}`
  return null
}
