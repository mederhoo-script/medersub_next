import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { supabaseAdmin } from '@/lib/supabase-admin'
import crypto from 'crypto'

function verifyTelegramPayload(payload: Record<string, any>, botToken: string) {
  const hash = payload.hash
  const data: Record<string, any> = { ...payload }
  delete data.hash

  const keys = Object.keys(data).sort()
  const data_check_arr: string[] = []
  for (const key of keys) {
    data_check_arr.push(`${key}=${data[key]}`)
  }
  const data_check_string = data_check_arr.join('\n')

  const secret = crypto.createHash('sha256').update(botToken).digest()
  const hmac = crypto.createHmac('sha256', secret).update(data_check_string).digest('hex')

  return hmac === hash
}

function generateTelegramUserEmail(telegramId: string): string {
  return `telegram_${telegramId}@medersub.local`
}

function generateSecurePassword(): string {
  return crypto.randomBytes(16).toString('hex')
}

export async function POST(req: Request) {
  console.log('[TG verify] POST /api/auth/telegram/verify called')
  try {
    const body = await req.json()
    const payload = body.payload || body
    console.log('[TG verify] Received payload keys:', payload ? Object.keys(payload) : null)

    if (!payload || !payload.hash) {
      console.error('[TG verify] Missing payload or hash')
      return NextResponse.json({ error: 'invalid_payload' }, { status: 400 })
    }

    const botToken = process.env.TELEGRAM_BOT_TOKEN
    if (!botToken) {
      console.error('[TG verify] TELEGRAM_BOT_TOKEN env var is not set')
      return NextResponse.json({ error: 'server_misconfigured' }, { status: 500 })
    }

    const verified = verifyTelegramPayload(payload, botToken)
    console.log('[TG verify] Signature verification result:', verified)
    if (!verified) {
      console.error('[TG verify] Payload HMAC verification failed')
      return NextResponse.json({ error: 'verification_failed' }, { status: 401 })
    }

    // Check auth_date to avoid replay attacks (allow 5 minutes)
    const now = Math.floor(Date.now() / 1000)
    const authDate = parseInt(String(payload.auth_date || '0'), 10)
    console.log('[TG verify] auth_date check: now=%d, auth_date=%d, diff=%ds', now, authDate, Math.abs(now - authDate))
    if (isNaN(authDate) || Math.abs(now - authDate) > 60 * 5) {
      console.error('[TG verify] auth_date is stale or invalid')
      return NextResponse.json({ error: 'stale_auth_date' }, { status: 400 })
    }

    // Create a server supabase client that reads cookies from the request
    const { createServerClient: _ } = await import('@supabase/ssr')
    const { NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY } = process.env
    if (!NEXT_PUBLIC_SUPABASE_URL || !NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      console.error('[TG verify] Supabase env vars are not set')
      return NextResponse.json({ error: 'supabase_not_configured' }, { status: 500 })
    }

    const supabase = createServerClient(
      NEXT_PUBLIC_SUPABASE_URL,
      NEXT_PUBLIC_SUPABASE_ANON_KEY,
      {
        cookies: {
          getAll() {
            return (req as any).cookies?.getAll?.() || []
          },
          setAll() {
            return
          },
        },
      }
    )

    const { data: { user } } = await supabase.auth.getUser()
    const telegramId = String(payload.id)
    const telegramUsername = payload.username || null
    console.log('[TG verify] telegramId=%s, telegramUsername=%s, currentUser=%s', telegramId, telegramUsername, user?.id ?? 'none')

    // If user is logged in -> link telegram id to their profile
    if (user) {
      console.log('[TG verify] User already logged in (%s) — linking Telegram account', user.id)
      const { data, error } = await supabaseAdmin
        .from('profiles')
        .update({ telegram_id: telegramId, telegram_username: telegramUsername, telegram_linked_at: new Date().toISOString() })
        .eq('id', user.id)
        .select()
        .single()

      if (error) {
        console.error('[TG verify] Failed to link Telegram to profile:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
      }

      console.log('[TG verify] Telegram linked successfully to user', user.id)
      return NextResponse.json({ ok: true, action: 'linked', profile: data })
    }

    // Not logged in - check if telegram_id already exists (returning user)
    console.log('[TG verify] No current session — looking up existing profile by telegram_id=%s', telegramId)
    const { data: existingProfile, error: lookupError } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('telegram_id', telegramId)
      .single()

    console.log('[TG verify] Existing profile lookup — found=%s, error=%s', !!existingProfile, lookupError?.message ?? 'none')

    if (!lookupError && existingProfile) {
      // Telegram user exists - generate a temporary password + login code
      console.log('[TG verify] Existing user found (id=%s) — generating login code', existingProfile.id)
      const loginCode = crypto.randomBytes(12).toString('hex')
      const tempPassword = generateSecurePassword()

      // Try to set a temporary password for the existing user via admin API
      try {
        // Use any-cast to access the admin update method (library typing differences)
        if ((supabaseAdmin.auth.admin as any)?.updateUserById) {
          await (supabaseAdmin.auth.admin as any).updateUserById(existingProfile.id, { password: tempPassword })
          console.log('[TG verify] Temporary password set for existing user', existingProfile.id)
        } else {
          console.warn('[TG verify] updateUserById not available on admin API')
        }
      } catch (err) {
        // Non-fatal: continue — we'll still store the temporary password with the code
        console.warn('[TG verify] Failed to update existing user password via admin API', err)
      }

      const { error: codeError } = await supabaseAdmin
        .from('telegram_login_codes')
        .insert({
          code: loginCode,
          user_id: existingProfile.id,
          temporary_password: tempPassword,
        })

      if (codeError) {
        console.error('[TG verify] Failed to insert login code for existing user:', codeError)
        return NextResponse.json({ error: `Failed to create login code: ${codeError.message}` }, { status: 500 })
      }

      console.log('[TG verify] Login code created — returning action=login_existing')
      // Return login code so frontend can exchange for session
      return NextResponse.json({ ok: true, action: 'login_existing', login_code: loginCode })
    }

    // New Telegram user - create account and profile
    console.log('[TG verify] No existing user — creating new account for telegramId=%s', telegramId)
    const email = generateTelegramUserEmail(telegramId)
    const password = generateSecurePassword()
    const fullName = `${payload.first_name || ''} ${payload.last_name || ''}`.trim() || telegramUsername || `User ${telegramId}`

    // Create Supabase auth user
    const { data: authData, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // Auto-confirm since Telegram verified them
      user_metadata: {
        full_name: fullName,
        telegram_id: telegramId,
        telegram_username: telegramUsername,
      },
    })

    if (createError || !authData.user) {
      console.error('[TG verify] Failed to create Supabase auth user:', createError)
      return NextResponse.json({ error: `Failed to create user: ${createError?.message}` }, { status: 500 })
    }

    console.log('[TG verify] New auth user created (id=%s, email=%s)', authData.user.id, email)

    // Profile is auto-created by the DB trigger, but update with telegram fields
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .update({
        telegram_id: telegramId,
        telegram_username: telegramUsername,
        telegram_linked_at: new Date().toISOString(),
      })
      .eq('id', authData.user.id)
      .select()
      .single()

    if (profileError) {
      console.error('[TG verify] Failed to update profile with telegram fields:', profileError)
      return NextResponse.json({ error: profileError.message }, { status: 500 })
    }

    console.log('[TG verify] Profile updated with telegram fields for user', authData.user.id)

    // Generate a one-time login code
    const loginCode = crypto.randomBytes(12).toString('hex')
    const { error: codeError } = await supabaseAdmin
      .from('telegram_login_codes')
      .insert({
        code: loginCode,
        user_id: authData.user.id,
        temporary_password: password,
      })

    if (codeError) {
      console.error('[TG verify] Failed to insert login code for new user:', codeError)
      return NextResponse.json({ error: `Failed to create login code: ${codeError.message}` }, { status: 500 })
    }

    console.log('[TG verify] Login code created for new user — returning action=signup_new')
    // Return new user info with login code
    return NextResponse.json({
      ok: true,
      action: 'signup_new',
      user_id: authData.user.id,
      profile,
      login_code: loginCode,
    })
  } catch (err: any) {
    console.error('[TG verify] Unhandled exception:', err)
    return NextResponse.json({ error: err.message || String(err) }, { status: 500 })
  }
}
