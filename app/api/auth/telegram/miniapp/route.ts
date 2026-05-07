import { NextResponse, type NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import crypto from 'crypto'

/**
 * Verify the Telegram Mini App initData string.
 *
 * Algorithm (different from the Login Widget):
 *   secret_key = HMAC-SHA256("WebAppData", bot_token)
 *   data_check_string = sorted key=value pairs joined by \n (hash excluded)
 *   expected_hash = HMAC-SHA256(data_check_string, secret_key)
 */
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
  } catch {
    return false
  }
}

function generateTelegramUserEmail(telegramId: string): string {
  return `telegram_${telegramId}@medersub.local`
}

async function upsertTelegramProfile(
  userId: string,
  email: string,
  fullName: string
): Promise<void> {
  const { error } = await supabaseAdmin
    .from('profiles')
    .upsert({ id: userId, email, full_name: fullName, role: 'USER', balance: 0 }, { onConflict: 'id', ignoreDuplicates: true })
  if (error) {
    console.warn('[Telegram/miniapp] Failed to upsert profile for userId=%s: %s', userId, error.message)
  }
}

async function ensureWalletRow(userId: string): Promise<void> {
  const { error } = await supabaseAdmin
    .from('wallets')
    .upsert({ user_id: userId, balance: 0 }, { onConflict: 'user_id', ignoreDuplicates: true })
  if (error) {
    console.warn('[Telegram/miniapp] Failed to ensure wallet for userId=%s: %s', userId, error.message)
  }
}

export async function POST(req: NextRequest) {
  console.log('[Telegram/miniapp] POST /api/auth/telegram/miniapp called')

  const MAX_AUTH_DATE_AGE_SECONDS = 86_400 // 24 hours (Telegram Mini App sessions are long-lived)

  try {
    const body = await req.json().catch(() => ({}))
    const initData: string = body?.init_data || ''

    if (!initData) {
      console.error('[Telegram/miniapp] Missing init_data')
      return NextResponse.json({ error: 'init_data required' }, { status: 400 })
    }

    const botToken = process.env.TELEGRAM_BOT_TOKEN
    if (!botToken) {
      console.error('[Telegram/miniapp] TELEGRAM_BOT_TOKEN is not set')
      return NextResponse.json({ error: 'server_misconfigured' }, { status: 500 })
    }

    const valid = verifyTelegramInitData(initData, botToken)
    console.log('[Telegram/miniapp] initData verification:', valid)
    if (!valid) {
      console.error('[Telegram/miniapp] initData HMAC verification failed')
      return NextResponse.json({ error: 'verification_failed' }, { status: 401 })
    }

    const params = new URLSearchParams(initData)

    // Check auth_date freshness (allow up to 1 hour for Mini App sessions)
    const authDate = parseInt(params.get('auth_date') || '0', 10)
    const now = Math.floor(Date.now() / 1000)
    console.log('[Telegram/miniapp] auth_date=%d, now=%d, diff=%d', authDate, now, now - authDate)
    if (!authDate || now - authDate > MAX_AUTH_DATE_AGE_SECONDS) {
      console.error('[Telegram/miniapp] auth_date is stale or missing')
      return NextResponse.json({ error: 'stale_auth_date' }, { status: 400 })
    }

    // Parse the user object from initData
    const userJson = params.get('user')
    if (!userJson) {
      console.error('[Telegram/miniapp] No user field in initData')
      return NextResponse.json({ error: 'no_user_in_init_data' }, { status: 400 })
    }

    let tgUser: Record<string, any>
    try {
      tgUser = JSON.parse(userJson)
    } catch {
      console.error('[Telegram/miniapp] Failed to parse user JSON')
      return NextResponse.json({ error: 'invalid_user_data' }, { status: 400 })
    }

    const telegramId = String(tgUser.id)
    const telegramUsername = tgUser.username || null
    const firstName = tgUser.first_name || ''
    const lastName = tgUser.last_name || ''
    const fullName = `${firstName} ${lastName}`.trim() || telegramUsername || `User ${telegramId}`
    const email = generateTelegramUserEmail(telegramId)

    console.log('[Telegram/miniapp] telegramId=%s, username=%s', telegramId, telegramUsername)

    // Find existing user by telegram_id
    const { data: existingProfile } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('telegram_id', telegramId)
      .single()

    let userId = existingProfile?.id || null

    if (!userId) {
      console.log('[Telegram/miniapp] No existing profile — creating new user email=%s', email)

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
        console.warn('[Telegram/miniapp] createUser failed (%s) — trying fallback', createError?.message)

        // Fallback: look up by email in profiles then in auth.users via RPC
        const { data: profileByEmail } = await supabaseAdmin
          .from('profiles')
          .select('id')
          .eq('email', email)
          .single()

        if (profileByEmail?.id) {
          userId = profileByEmail.id
          console.log('[Telegram/miniapp] Recovered existing userId=%s via email lookup', userId)
        } else {
          const { data: orphanedAuthId } = await supabaseAdmin
            .rpc('get_auth_user_id_by_email', { p_email: email })

          if (orphanedAuthId) {
            userId = orphanedAuthId as string
            await upsertTelegramProfile(userId, email, fullName)
            console.log('[Telegram/miniapp] Recovered orphaned auth userId=%s', userId)
          } else {
            console.error('[Telegram/miniapp] Failed to create or find user:', createError?.message)
            return NextResponse.json({ error: 'account_creation_failed' }, { status: 500 })
          }
        }
      } else {
        userId = authData.user.id
        console.log('[Telegram/miniapp] New user created userId=%s', userId)
      }

      // Link Telegram fields to profile
      await supabaseAdmin
        .from('profiles')
        .update({
          telegram_id: telegramId,
          telegram_username: telegramUsername,
          telegram_linked_at: new Date().toISOString(),
        })
        .eq('id', userId)
    }

    await ensureWalletRow(userId)

    // Create admin session — no password needed
    console.log('[Telegram/miniapp] Creating session for userId=%s', userId)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: sessionData, error: sessionError } = await (supabaseAdmin.auth.admin as any).createSession({
      user_id: userId,
    })

    if (sessionError || !sessionData?.session) {
      console.error('[Telegram/miniapp] Session creation failed:', sessionError?.message)
      return NextResponse.json({ error: 'session_creation_failed' }, { status: 500 })
    }

    const session = sessionData.session
    console.log('[Telegram/miniapp] Session created for userId=%s', userId)

    return NextResponse.json({
      ok: true,
      session: {
        access_token: session.access_token,
        refresh_token: session.refresh_token,
        expires_in: session.expires_in,
        expires_at: session.expires_at,
      },
    })
  } catch (err: any) {
    console.error('[Telegram/miniapp] Unhandled exception:', err)
    return NextResponse.json({ error: err.message || String(err) }, { status: 500 })
  }
}
