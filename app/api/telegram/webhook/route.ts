import { NextResponse, type NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import crypto from 'crypto'

function generateTelegramUserEmail(telegramId: string): string {
  return `telegram_${telegramId}@medersub.local`
}

function generateSecurePassword(): string {
  return crypto.randomBytes(16).toString('hex')
}

async function sendTelegramMessage(chatId: number, text: string) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN
  if (!botToken) return

  await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      disable_web_page_preview: true,
    }),
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
    if (text === '/start' && chatId && telegramId) {
      console.log('[TG webhook] Handling plain /start for telegramId=%s', telegramId)
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || req.nextUrl.origin
      const tempPassword = generateSecurePassword()

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
          password: tempPassword,
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
              await supabaseAdmin
                .from('profiles')
                .upsert({ id: userId, email, full_name: fullName, role: 'USER', balance: 0 }, { onConflict: 'id', ignoreDuplicates: true })
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

        await supabaseAdmin
          .from('profiles')
          .update({
            telegram_id: telegramId,
            telegram_username: telegramUsername,
            telegram_linked_at: new Date().toISOString(),
          })
          .eq('id', userId)
      } else {
        // Existing user: update the temporary password so they can sign in
        console.log('[TG webhook] Existing user — updating temp password for userId=%s', userId)
        try {
          if ((supabaseAdmin.auth.admin as any)?.updateUserById) {
            await (supabaseAdmin.auth.admin as any).updateUserById(userId, { password: tempPassword })
            console.log('[TG webhook] Temp password updated for userId=%s', userId)
          } else {
            console.warn('[TG webhook] updateUserById not available on admin API')
          }
        } catch (err) {
          console.warn('[TG webhook] Failed to set login password', err)
        }
      }

      const loginCode = crypto.randomBytes(12).toString('hex')

      const { error: codeError } = await supabaseAdmin
        .from('telegram_login_codes')
        .insert({ code: loginCode, user_id: userId, temporary_password: tempPassword })

      if (!codeError) {
        const loginUrl = `${appUrl}/api/auth/telegram/callback?code=${encodeURIComponent(loginCode)}`
        console.log('[TG webhook] Login URL generated for userId=%s: %s', userId, loginUrl)
        await sendTelegramMessage(
          chatId,
          `👋 Welcome to Medersub!\n\n🔗 Tap the link below to log in to your account:\n${loginUrl}\n\n⏳ This link expires in 15 minutes.`
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
      const tempPassword = generateSecurePassword()

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
          password: tempPassword,
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
              await supabaseAdmin
                .from('profiles')
                .upsert({ id: userId, email, full_name: fullName, role: 'USER', balance: 0 }, { onConflict: 'id', ignoreDuplicates: true })
              console.log('[TG webhook] login_ — recovered orphaned auth userId=%s, upserted profile', userId)
            } else {
              console.error('[TG webhook] login_ — failed to create user and no existing profile found:', createError)
              return NextResponse.json({ ok: true })
            }
          }
        } else {
          userId = authData.user.id
          console.log('[TG webhook] login_ — new user created userId=%s', userId)
        }

        await supabaseAdmin
          .from('profiles')
          .update({
            telegram_id: telegramId,
            telegram_username: telegramUsername,
            telegram_linked_at: new Date().toISOString(),
          })
          .eq('id', userId)
      }

      const loginCode = crypto.randomBytes(12).toString('hex')

      try {
        if ((supabaseAdmin.auth.admin as any)?.updateUserById) {
          await (supabaseAdmin.auth.admin as any).updateUserById(userId, { password: tempPassword })
          console.log('[TG webhook] login_ — temp password set for userId=%s', userId)
        } else {
          console.warn('[TG webhook] updateUserById not available on admin API')
        }
      } catch (err) {
        console.warn('[TG webhook] login_ — Failed to set login password', err)
      }

      const { error: codeError } = await supabaseAdmin
        .from('telegram_login_codes')
        .insert({ code: loginCode, user_id: userId, temporary_password: tempPassword })

      if (!codeError) {
        const loginUrl = `${appUrl}/api/auth/telegram/callback?code=${encodeURIComponent(loginCode)}`
        console.log('[TG webhook] login_ — login URL for userId=%s: %s', userId, loginUrl)
        await sendTelegramMessage(chatId, `🔗 Tap here to complete login: ${loginUrl}`)
      } else {
        console.error('[TG webhook] login_ — failed to insert login code:', codeError)
      }
    }

    return NextResponse.json({ ok: true })
  } catch (err: any) {
    console.error('[TG webhook] Unhandled exception:', err)
    return NextResponse.json({ ok: true }) // Always return 200 to avoid retries
  }
}
