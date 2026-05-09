import crypto from 'crypto'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { BROWSER_REWARD_UID_REGEX, TELEGRAM_AUTH_VALIDITY_SECONDS, TELEGRAM_REWARD_UID_REGEX } from '@/lib/reward-constants'

const DEFAULT_TELEGRAM_EMAIL_DOMAIN = 'medersub.local'
const TELEGRAM_EMAIL_DOMAIN = process.env.TELEGRAM_EMAIL_DOMAIN ?? DEFAULT_TELEGRAM_EMAIL_DOMAIN
const parsedReferralBonus = Number(process.env.REWARD_REFERRAL_BONUS_NGN ?? 5)
const REFERRAL_BONUS_NGN = Number.isNaN(parsedReferralBonus) ? 5 : parsedReferralBonus

function verifyTelegramInitData(initData: string, botToken: string): boolean {
  const params = new URLSearchParams(initData)
  const hash = params.get('hash')
  if (!hash) return false

  params.delete('hash')

  const entries = Array.from(params.entries()).sort(([a], [b]) => a.localeCompare(b))
  const dataCheckString = entries.map(([k, v]) => `${k}=${v}`).join('\n')

  const secretKey = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest()
  const expected = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex')

  try {
    return crypto.timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(hash, 'hex'))
  } catch (error) {
    console.warn('[rewards] Telegram init data signature comparison failed:', error)
    return false
  }
}

async function resolveAuthUserIdByEmail(email: string): Promise<string | null> {
  const { data: profileByEmail } = await supabaseAdmin
    .from('profiles')
    .select('id')
    .eq('email', email)
    .maybeSingle()

  if (profileByEmail?.id) return profileByEmail.id as string

  const { data: userIdByRpc } = await supabaseAdmin.rpc('get_auth_user_id_by_email', { p_email: email })
  return (userIdByRpc as string | null) ?? null
}

async function createOrFindAuthUser(email: string, metadata: Record<string, unknown>): Promise<string> {
  const { data: authData, error: createError } = await supabaseAdmin.auth.admin.createUser({
    email,
    email_confirm: true,
    user_metadata: metadata,
  })

  if (!createError && authData?.user?.id) {
    return authData.user.id
  }

  const existingId = await resolveAuthUserIdByEmail(email)
  if (existingId) return existingId

  throw new Error('Unable to create or recover rewards user')
}

async function ensureWalletRow(userId: string): Promise<void> {
  await supabaseAdmin.from('wallets').upsert({ user_id: userId, balance: 0 }, { onConflict: 'user_id', ignoreDuplicates: true })
}

export type RewardIdentityInput = {
  initData?: string
  rewardUid?: string
  firstName?: string
  username?: string
  referredBy?: string
}

export type RewardResolvedUser = {
  profileId: string
  rewardUid: string
  fullName: string
  email: string
  rewardBalance: number
  rewardAdsWatched: number
  rewardReferredBy: string | null
  rewardReferralsCount: number
  rewardReferralEarningsNgn: number
  telegramId: string | null
}

export async function resolveRewardUser(identity: RewardIdentityInput): Promise<RewardResolvedUser> {
  const { initData, rewardUid, firstName, username } = identity

  let telegramId: string | null = null
  let telegramUsername: string | null = null
  let canonicalRewardUid: string | null = null
  let fullName = ''

  if (initData) {
    const botToken = process.env.TELEGRAM_BOT_TOKEN
    if (!botToken) throw new Error('TELEGRAM_BOT_TOKEN is not set')
    if (!verifyTelegramInitData(initData, botToken)) throw new Error('Invalid Telegram init data')

    const params = new URLSearchParams(initData)
    const authDate = parseInt(params.get('auth_date') || '0', 10)
    const now = Math.floor(Date.now() / 1000)
    if (!authDate || now - authDate > TELEGRAM_AUTH_VALIDITY_SECONDS) throw new Error('Stale Telegram auth data')

    const userJson = params.get('user')
    if (!userJson) throw new Error('Missing Telegram user data')
    const tgUser = JSON.parse(userJson) as Record<string, unknown>

    telegramId = String(tgUser.id)
    telegramUsername = (tgUser.username as string) || null
    const firstNameValue = (tgUser.first_name as string) || ''
    const lastNameValue = (tgUser.last_name as string) || ''
    fullName = `${firstNameValue} ${lastNameValue}`.trim() || telegramUsername || `User ${telegramId}`
    canonicalRewardUid = `TG-${telegramId}`
    if (!TELEGRAM_REWARD_UID_REGEX.test(canonicalRewardUid)) throw new Error('Invalid Telegram reward uid')
  } else {
    if (!rewardUid) throw new Error('rewardUid is required outside Telegram')
    if (!BROWSER_REWARD_UID_REGEX.test(rewardUid)) throw new Error('Invalid rewardUid format')
    canonicalRewardUid = rewardUid
    fullName = firstName || username || `User ${rewardUid.slice(3)}`
  }

  const email = telegramId
    ? `telegram_${telegramId}@${TELEGRAM_EMAIL_DOMAIN}`
    : `reward_${canonicalRewardUid.toLowerCase()}@${TELEGRAM_EMAIL_DOMAIN}`

  let existingProfileQuery = supabaseAdmin
    .from('profiles')
    .select('*')
    .eq('reward_uid', canonicalRewardUid)
    .maybeSingle()

  if (telegramId) {
    existingProfileQuery = supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('telegram_id', telegramId)
      .maybeSingle()
  }

  let { data: profile } = await existingProfileQuery

  let userId = profile?.id as string | undefined
  if (!userId) {
    userId = await createOrFindAuthUser(email, {
      full_name: fullName,
      telegram_id: telegramId,
      telegram_username: telegramUsername,
      reward_uid: canonicalRewardUid,
    })
  }

  const nowIso = new Date().toISOString()
  const { error: upsertError } = await supabaseAdmin
    .from('profiles')
    .upsert(
      {
        id: userId,
        email,
        full_name: fullName,
        role: 'USER',
        telegram_id: telegramId,
        telegram_username: telegramUsername,
        telegram_linked_at: telegramId ? nowIso : null,
        reward_uid: canonicalRewardUid,
      },
      { onConflict: 'id' }
    )

  if (upsertError) throw new Error(upsertError.message)

  await ensureWalletRow(userId)

  const { data: freshProfile, error: fetchError } = await supabaseAdmin
    .from('profiles')
    .select('id,email,full_name,telegram_id,reward_uid,reward_balance_ngn,reward_ads_watched,reward_referred_by,reward_referrals_count,reward_referral_earnings_ngn')
    .eq('id', userId)
    .single()

  if (fetchError || !freshProfile) throw new Error(fetchError?.message || 'Failed to fetch reward profile')

  return {
    profileId: freshProfile.id,
    rewardUid: freshProfile.reward_uid as string,
    fullName: (freshProfile.full_name as string) || fullName,
    email: freshProfile.email as string,
    rewardBalance: Number(freshProfile.reward_balance_ngn || 0),
    rewardAdsWatched: Number(freshProfile.reward_ads_watched || 0),
    rewardReferredBy: (freshProfile.reward_referred_by as string) || null,
    rewardReferralsCount: Number(freshProfile.reward_referrals_count || 0),
    rewardReferralEarningsNgn: Number(freshProfile.reward_referral_earnings_ngn || 0),
    telegramId: (freshProfile.telegram_id as string) || null,
  }
}

export async function applyReferralIfEligible(user: RewardResolvedUser, referredBy: string | undefined): Promise<void> {
  if (!referredBy) return
  if (user.rewardReferredBy) return
  if (referredBy === user.rewardUid) return

  const { error } = await supabaseAdmin.rpc('apply_reward_referral', {
    p_user_id: user.profileId,
    p_referred_by: referredBy,
    p_source_uid: user.rewardUid,
    p_referral_bonus: REFERRAL_BONUS_NGN,
  })

  if (error) {
    throw new Error(error.message)
  }
}
