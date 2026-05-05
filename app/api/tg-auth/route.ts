import { NextResponse, type NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import crypto from 'crypto'

/**
 * POST /api/tg-auth
 *
 * Telegram Mini App authentication endpoint.
 *
 * Verifies the Telegram WebApp initData string, then either logs in an
 * existing user (matched by telegram_id) or creates a new Supabase account
 * for first-time Telegram users.  Returns a short-lived Supabase session
 * (access_token + refresh_token) which the client sets via
 * `supabase.auth.setSession()`.
 *
 * Body: { init_data: string }   — the raw initData string from
 *                                  window.Telegram.WebApp.initData
 *
 * Response (success):
 *   { ok: true, access_token: string, refresh_token: string, expires_in: number }
 *
 * Response (error):
 *   { ok: false, error: string }  (with appropriate HTTP status)
 */

// Telegram Mini App initData is valid for up to 24 hours
const MAX_AUTH_DATE_AGE_SECONDS = 86_400

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

// Configurable via env — keeps all Telegram synthetic emails under the same domain.
// Override TELEGRAM_EMAIL_DOMAIN if deploying under a different domain.
const TELEGRAM_EMAIL_DOMAIN = process.env.TELEGRAM_EMAIL_DOMAIN ?? 'medersub.local'

function generateTelegramUserEmail(telegramId: string): string {
  return `telegram_${telegramId}@${TELEGRAM_EMAIL_DOMAIN}`
}

async function ensureProfileRow(
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
        role: 'USER',
        balance: 0,
        telegram_id: telegramId,
        telegram_username: telegramUsername,
        telegram_linked_at: new Date().toISOString(),
      },
      { onConflict: 'id' }
    )

  if (error) {
    console.warn('[tg-auth] Failed to upsert profile for userId=%s: %s', userId, error.message)
  }
}

export async function POST(req: NextRequest) {
  console.log('[tg-auth] POST /api/tg-auth called')

  try {
    const body = await req.json().catch(() => ({}))
    const initData: string = body?.init_data ?? ''

    if (!initData) {
      return NextResponse.json({ ok: false, error: 'init_data required' }, { status: 400 })
    }

    const botToken = process.env.TELEGRAM_BOT_TOKEN
    if (!botToken) {
      console.error('[tg-auth] TELEGRAM_BOT_TOKEN is not set')
      return NextResponse.json({ ok: false, error: 'server_misconfigured' }, { status: 500 })
    }

    // 1. Verify HMAC signature
    if (!verifyTelegramInitData(initData, botToken)) {
      console.error('[tg-auth] initData HMAC verification failed')
      return NextResponse.json({ ok: false, error: 'verification_failed' }, { status: 401 })
    }

    const params = new URLSearchParams(initData)

    // 2. Check auth_date freshness
    const authDate = parseInt(params.get('auth_date') ?? '0', 10)
    const now = Math.floor(Date.now() / 1000)
    if (!authDate || now - authDate > MAX_AUTH_DATE_AGE_SECONDS) {
      console.error('[tg-auth] auth_date is stale: age=%ds', now - authDate)
      return NextResponse.json({ ok: false, error: 'stale_auth_date' }, { status: 400 })
    }

    // 3. Parse Telegram user
    const userJson = params.get('user')
    if (!userJson) {
      return NextResponse.json({ ok: false, error: 'no_user_in_init_data' }, { status: 400 })
    }

    let tgUser: Record<string, unknown>
    try {
      tgUser = JSON.parse(userJson)
    } catch {
      return NextResponse.json({ ok: false, error: 'invalid_user_data' }, { status: 400 })
    }

    const telegramId = String(tgUser.id)
    const telegramUsername = (tgUser.username as string) || null
    const firstName = (tgUser.first_name as string) || ''
    const lastName = (tgUser.last_name as string) || ''
    const fullName = `${firstName} ${lastName}`.trim() || telegramUsername || `User ${telegramId}`
    const email = generateTelegramUserEmail(telegramId)

    console.log('[tg-auth] telegramId=%s username=%s', telegramId, telegramUsername)

    // 4. Find existing user by telegram_id
    const { data: existingProfile } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('telegram_id', telegramId)
      .maybeSingle()

    let userId = existingProfile?.id ?? null

    if (userId) {
      console.log('[tg-auth] Found existing user userId=%s', userId)
    } else {
      // 5a. New Telegram user — create Supabase account
      console.log('[tg-auth] No existing profile — creating new user email=%s', email)

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
        // Auth record may already exist (orphaned from a previous attempt)
        console.warn('[tg-auth] createUser failed (%s) — trying fallback', createError?.message)

        // Fallback 1: profile row with matching email
        const { data: profileByEmail } = await supabaseAdmin
          .from('profiles')
          .select('id')
          .eq('email', email)
          .maybeSingle()

        if (profileByEmail?.id) {
          userId = profileByEmail.id
          console.log('[tg-auth] Recovered userId=%s via email lookup', userId)
        } else {
          // Fallback 2: auth.users row (orphaned — no profile row yet).
          // get_auth_user_id_by_email is defined in
          // supabase/migrations/009_get_auth_user_id_by_email.sql
          const { data: orphanedAuthId } = await supabaseAdmin
            .rpc('get_auth_user_id_by_email', { p_email: email })

          if (orphanedAuthId) {
            userId = orphanedAuthId as string
            console.log('[tg-auth] Recovered orphaned userId=%s via RPC', userId)
          } else {
            console.error('[tg-auth] Failed to create or find user:', createError?.message)
            return NextResponse.json(
              { ok: false, error: 'account_creation_failed' },
              { status: 500 }
            )
          }
        }
      } else {
        userId = authData.user.id
        console.log('[tg-auth] New user created userId=%s', userId)
      }

      // Ensure profile row has telegram fields populated
      await ensureProfileRow(userId, email, fullName, telegramId, telegramUsername)
    }

    // 6. Create a Supabase session for the user (admin, no password needed).
    // `createSession` was added to the Supabase JS admin API but is not yet
    // reflected in the @supabase/supabase-js type definitions as of v2.x.
    // Once the library ships official types for this method, remove the cast.
    // Tracked upstream: https://github.com/supabase/supabase-js/issues
    console.log('[tg-auth] Creating session for userId=%s', userId)
    type AdminWithCreateSession = typeof supabaseAdmin.auth.admin & {
      createSession: (opts: { user_id: string }) => Promise<{
        data: { session: { access_token: string; refresh_token: string; expires_in: number } | null }
        error: { message: string } | null
      }>
    }
    const { data: sessionData, error: sessionError } = await (
      supabaseAdmin.auth.admin as AdminWithCreateSession
    ).createSession({ user_id: userId })

    if (sessionError || !sessionData?.session) {
      console.error('[tg-auth] Session creation failed:', sessionError?.message)
      return NextResponse.json({ ok: false, error: 'session_creation_failed' }, { status: 500 })
    }

    const { access_token, refresh_token, expires_in } = sessionData.session
    console.log('[tg-auth] Session created for userId=%s', userId)

    return NextResponse.json({
      ok: true,
      access_token,
      refresh_token,
      expires_in: expires_in ?? 3600,
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[tg-auth] Unhandled exception:', message)
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
