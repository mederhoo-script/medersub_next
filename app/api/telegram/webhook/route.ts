import { NextResponse, type NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { normalizeReferralUid } from '@/lib/reward-referral'
import crypto from 'crypto'

function generateTelegramUserEmail(telegramId: string): string {
  return `telegram_${telegramId}@medersub.local`
}

const parsedReferralBonus = Number(process.env.REWARD_REFERRAL_BONUS_NGN ?? 5)
const REFERRAL_BONUS_NGN = Number.isNaN(parsedReferralBonus) ? 5 : parsedReferralBonus


async function upsertTelegramProfile(
  userId: string,
  email: string,
  fullName: string,
  telegramId: string,
  telegramUsername: string | null
): Promise<void> {
  const { error } = await supabaseAdmin
    .from('profiles')
    .upsert(
      {
        id: userId,
        email,
        full_name: fullName,
        telegram_id: telegramId,
        telegram_username: telegramUsername,
        telegram_linked_at: new Date().toISOString(),
        reward_uid: `TG-${telegramId}`,
      },
      { onConflict: 'id' }
    )
  if (error) {
    console.warn('[TG webhook] Failed to upsert profile for userId=%s: %s', userId, error.message)
  }
}

async function ensureWalletRow(userId: string): Promise<void> {
  const { error } = await supabaseAdmin
    .from('wallets')
    .upsert({ user_id: userId, balance: 0 }, { onConflict: 'user_id', ignoreDuplicates: true })
  if (error) {
    console.warn('[TG webhook] Failed to ensure wallet for userId=%s: %s', userId, error.message)
  }
}

async function applyStartReferralIfEligible(userId: string, telegramId: string, startPayload: string): Promise<void> {
  const normalizedReferralUid = normalizeReferralUid(startPayload)
  if (!normalizedReferralUid) return

  const sourceUid = `TG-${telegramId}`
  if (normalizedReferralUid === sourceUid) return

  const { error } = await supabaseAdmin.rpc('apply_reward_referral', {
    p_user_id: userId,
    p_referred_by: normalizedReferralUid,
    p_source_uid: sourceUid,
    p_referral_bonus: REFERRAL_BONUS_NGN,
  })

  if (error) {
    console.warn('[TG webhook] Failed to apply start referral for userId=%s via payload=%s: %s', userId, startPayload, error.message)
  }
}

async function sendTelegramMessage(chatId: number, text: string, webAppUrl?: string) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN
  if (!botToken) return

  const body: Record<string, any> = {
    chat_id: chatId,
    text,
    disable_web_page_preview: true,
  }

  if (webAppUrl) {
    body.reply_markup = {
      inline_keyboard: [[
        { text: '🚀 Open App', web_app: { url: webAppUrl } },
      ]],
    }
  }

  await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

// Verify Telegram bot request signature.
// When registering the webhook you can supply a secret_token via setWebhook; Telegram
// then echoes that value back verbatim in the X-Telegram-Bot-Api-Secret-Token header.
// We simply compare the header to the stored secret – no HMAC of the body is involved.
function verifyTelegramRequest(signature: string | null): boolean {
  const webhookSecret = process.env.TELEGRAM_WEBHOOK_SECRET

  if (!webhookSecret) {
    // No secret configured: allow in development, reject in production.
    console.warn('[TG webhook] TELEGRAM_WEBHOOK_SECRET is not set')
    return process.env.NODE_ENV !== 'production'
  }

  if (!signature) return false

  try {
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(webhookSecret))
  } catch {
    return false
  }
}

export async function POST(req: NextRequest) {
  console.log('[TG webhook] POST /api/telegram/webhook called')
  try {
    const body = await req.text()
    const signature = req.headers.get('x-telegram-bot-api-secret-token')

    // Verify request is from Telegram
    if (!verifyTelegramRequest(signature)) {
      console.error('[TG webhook] Request signature verification failed — signature=%s', signature ? '[present]' : 'missing')
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
    }

    const update = JSON.parse(body)
    console.log('[TG webhook] Update received — update_id=%s, message_text=%s', update.update_id, update.message?.text ?? '(no text)')

    const text = update.message?.text || ''
    const startPayload = text.startsWith('/start ') ? text.slice('/start '.length).trim() : ''
    const telegramId = String(update.message?.from?.id || '')
    const telegramUsername = update.message?.from?.username || null
    const firstName = update.message?.from?.first_name || ''
    const lastName = update.message?.from?.last_name || ''
    const chatId = update.message?.chat?.id

    console.log('[TG webhook] From — telegramId=%s, username=%s, chatId=%s', telegramId, telegramUsername, chatId)

    // Handle /start command with link_<code>
    if (text.startsWith('/start link_')) {
      const code = text.replace('/start link_', '')
      console.log('[TG webhook] Handling /start link_ code=%s', code)

      // Look up the linking code
      const { data: linkData, error: linkError } = await supabaseAdmin
        .from('telegram_links')
        .select('user_id, expires_at')
        .eq('code', code)
        .single()

      if (linkError || !linkData) {
        console.error('[TG webhook] link_ code not found:', linkError?.message ?? 'no data')
        return NextResponse.json({ ok: true }) // Silent fail
      }

      // Check if code expired
      if (new Date(linkData.expires_at) < new Date()) {
        console.error('[TG webhook] link_ code expired at %s', linkData.expires_at)
        // Delete expired code
        await supabaseAdmin.from('telegram_links').delete().eq('code', code)
        return NextResponse.json({ ok: true })
      }

      // Link telegram to user
      const { error: updateError } = await supabaseAdmin
        .from('profiles')
        .update({
          telegram_id: telegramId,
          telegram_username: telegramUsername,
          telegram_linked_at: new Date().toISOString(),
        })
        .eq('id', linkData.user_id)

      if (updateError) {
        console.error('[TG webhook] Failed to link telegram to profile (user_id=%s):', linkData.user_id, updateError)
      } else {
        console.log('[TG webhook] Telegram linked to user_id=%s', linkData.user_id)
        // Delete the used code
        await supabaseAdmin.from('telegram_links').delete().eq('code', code)
      }
    }

    // Handle plain /start command - auto-create account and send login link
    if ((text === '/start' || (startPayload && !startPayload.startsWith('link_') && !startPayload.startsWith('login_'))) && chatId && telegramId) {
      console.log('[TG webhook] Handling plain /start for telegramId=%s', telegramId)
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || req.nextUrl.origin

      // Check if a Telegram-linked profile already exists
      const { data: existingProfile } = await supabaseAdmin
        .from('profiles')
        .select('id')
        .eq('telegram_id', telegramId)
        .single()

      console.log('[TG webhook] Existing profile for telegramId=%s: %s', telegramId, existingProfile?.id ?? 'none')

      let userId = existingProfile?.id || null

      if (!userId) {
        // New user: create a Supabase account
        const email = generateTelegramUserEmail(telegramId)
        const fullName = `${firstName} ${lastName}`.trim() || telegramUsername || `User ${telegramId}`
        console.log('[TG webhook] Creating new user — email=%s, fullName=%s', email, fullName)

        const { data: authData, error: createError } = await supabaseAdmin.auth.admin.createUser({
          email,
          email_confirm: true,
          user_metadata: {
            full_name: fullName,
            telegram_id: telegramId,
            telegram_username: telegramUsername,
          },
        })

        if (createError || !authData?.user) {
          // createUser can fail when an orphaned auth record already exists for this email
          // (e.g. the trigger ran on a previous attempt but telegram_id was never saved to the profile).
          // Fall back to finding the existing profile row by email.
          console.warn('[TG webhook] createUser failed (%s) — falling back to profile lookup by email', createError?.message)
          const { data: profileByEmail } = await supabaseAdmin
            .from('profiles')
            .select('id')
            .eq('email', email)
            .single()

          if (profileByEmail?.id) {
            userId = profileByEmail.id
            console.log('[TG webhook] Recovered existing userId=%s via email lookup', userId)
          } else {
            // Last resort: the auth.users record may exist but the profiles row was never
            // created (orphaned user). Look up the auth user ID directly and upsert the profile.
            console.warn('[TG webhook] No profile by email — trying auth user lookup via RPC')
            const { data: orphanedAuthId } = await supabaseAdmin
              .rpc('get_auth_user_id_by_email', { p_email: email })

            if (orphanedAuthId) {
              userId = orphanedAuthId as string
              await upsertTelegramProfile(userId, email, fullName, telegramId, telegramUsername)
              console.log('[TG webhook] Recovered orphaned auth userId=%s, upserted profile', userId)
            } else {
              console.error('[TG webhook] Failed to create user and no existing profile found:', createError)
              await sendTelegramMessage(chatId, '❌ Failed to create your account. Please try again later.')
              return NextResponse.json({ ok: true })
            }
          }
        } else {
          userId = authData.user.id
          console.log('[TG webhook] New user created — userId=%s', userId)
        }

        await upsertTelegramProfile(userId, email, fullName, telegramId, telegramUsername)
      }

      await ensureWalletRow(userId)
      if (startPayload) {
        await applyStartReferralIfEligible(userId, telegramId, startPayload)
      }

      const loginCode = crypto.randomBytes(12).toString('hex')

      const { error: codeError } = await supabaseAdmin
        .from('telegram_login_codes')
        .insert({ code: loginCode, user_id: userId })

      if (!codeError) {
        const loginUrl = `${appUrl}/api/auth/telegram/callback?code=${encodeURIComponent(loginCode)}`
        const miniAppUrl = `${appUrl}/dashboard`
        console.log('[TG webhook] Login URL generated for userId=%s: %s', userId, loginUrl)
        await sendTelegramMessage(
          chatId,
          `👋 Welcome to Medersub!\n\n🔗 Tap the link below to log in:\n${loginUrl}\n\n⏳ This link expires in 15 minutes.\n\nOr tap the button below to open the app directly inside Telegram.`,
          miniAppUrl
        )
      } else {
        console.error('[TG webhook] Failed to insert telegram_login_codes for /start:', codeError)
        await sendTelegramMessage(chatId, '❌ Failed to generate login link. Please try again.')
      }

      return NextResponse.json({ ok: true })
    }

    // Handle /start command with login_<code>
    if (text.startsWith('/start login_') && chatId && telegramId) {
      const code = text.replace('/start login_', '')
      console.log('[TG webhook] Handling /start login_ code=%s for telegramId=%s', code, telegramId)
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || req.nextUrl.origin

      // Find existing Telegram-linked profile, if any
      const { data: existingProfile } = await supabaseAdmin
        .from('profiles')
        .select('id')
        .eq('telegram_id', telegramId)
        .single()

      console.log('[TG webhook] login_ — existing profile: %s', existingProfile?.id ?? 'none')

      let userId = existingProfile?.id || null

      if (!userId) {
        const email = generateTelegramUserEmail(telegramId)
        const fullName = `${firstName} ${lastName}`.trim() || telegramUsername || `User ${telegramId}`
        console.log('[TG webhook] login_ — creating new user email=%s', email)

        const { data: authData, error: createError } = await supabaseAdmin.auth.admin.createUser({
          email,
          email_confirm: true,
          user_metadata: {
            full_name: fullName,
            telegram_id: telegramId,
            telegram_username: telegramUsername,
          },
        })

        if (createError || !authData?.user) {
          // createUser can fail when an orphaned auth record already exists for this email.
          // Fall back to finding the existing profile row by email.
          console.warn('[TG webhook] login_ — createUser failed (%s) — falling back to profile lookup by email', createError?.message)
          const { data: profileByEmail } = await supabaseAdmin
            .from('profiles')
            .select('id')
            .eq('email', email)
            .single()

          if (profileByEmail?.id) {
            userId = profileByEmail.id
            console.log('[TG webhook] login_ — recovered existing userId=%s via email lookup', userId)
          } else {
            // Last resort: the auth.users record may exist but the profiles row was never
            // created (orphaned user). Look up the auth user ID directly and upsert the profile.
            console.warn('[TG webhook] login_ — no profile by email — trying auth user lookup via RPC')
            const { data: orphanedAuthId } = await supabaseAdmin
              .rpc('get_auth_user_id_by_email', { p_email: email })

            if (orphanedAuthId) {
              userId = orphanedAuthId as string
              await upsertTelegramProfile(userId, email, fullName, telegramId, telegramUsername)
              console.log('[TG webhook] login_ — recovered orphaned auth userId=%s, upserted profile', userId)
            } else {
              console.error('[TG webhook] login_ — failed to create user and no existing profile found:', createError)
              await sendTelegramMessage(chatId, '❌ Failed to set up your account. Please try again later.')
              return NextResponse.json({ ok: true })
            }
          }
        } else {
          userId = authData.user.id
          console.log('[TG webhook] login_ — new user created userId=%s', userId)
        }

        await upsertTelegramProfile(userId, email, fullName, telegramId, telegramUsername)
      }

      await ensureWalletRow(userId)

      const loginCode = crypto.randomBytes(12).toString('hex')

      const { error: codeError } = await supabaseAdmin
        .from('telegram_login_codes')
        .insert({ code: loginCode, user_id: userId })

      if (!codeError) {
        const loginUrl = `${appUrl}/api/auth/telegram/callback?code=${encodeURIComponent(loginCode)}`
        const miniAppUrl = `${appUrl}/dashboard`
        console.log('[TG webhook] login_ — login URL for userId=%s: %s', userId, loginUrl)
        await sendTelegramMessage(
          chatId,
          `🔗 Tap here to complete login: ${loginUrl}\n\nOr tap the button below to open the app directly inside Telegram.`,
          miniAppUrl
        )
      } else {
        console.error('[TG webhook] login_ — failed to insert login code:', codeError)
        await sendTelegramMessage(chatId, '❌ Failed to generate login link. Please try again.')
      }
    }

    return NextResponse.json({ ok: true })
  } catch (err: any) {
    console.error('[TG webhook] Unhandled exception:', err)
    return NextResponse.json({ ok: true }) // Always return 200 to avoid retries
  }
}
