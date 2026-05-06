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

async function ensureWalletRow(userId: string): Promise<void> {
  const { error } = await supabaseAdmin
    .from('wallets')
    .upsert({ user_id: userId, balance: 0 }, { onConflict: 'user_id', ignoreDuplicates: true })
  if (error) {
    console.warn('[Telegram/verify] Failed to ensure wallet for userId=%s: %s', userId, error.message)
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const payload = body.payload || body

    console.log('[Telegram/verify] Received POST request')

    if (!payload || !payload.hash) {
      console.error('[Telegram/verify] Invalid payload: missing hash')
      return NextResponse.json({ error: 'invalid_payload' }, { status: 400 })
    }

    const botToken = process.env.TELEGRAM_BOT_TOKEN
    if (!botToken) {
      console.error('[Telegram/verify] TELEGRAM_BOT_TOKEN is not set')
      return NextResponse.json({ error: 'server_misconfigured' }, { status: 500 })
    }

    const verified = verifyTelegramPayload(payload, botToken)
    console.log('[Telegram/verify] Payload verification result:', verified)
    if (!verified) {
      console.error('[Telegram/verify] HMAC verification failed')
      return NextResponse.json({ error: 'verification_failed' }, { status: 401 })
    }

    // Check auth_date to avoid replay attacks (allow 5 minutes)
    const now = Math.floor(Date.now() / 1000)
    const authDate = parseInt(String(payload.auth_date || '0'), 10)
    console.log('[Telegram/verify] auth_date check — now:', now, 'auth_date:', authDate, 'diff:', Math.abs(now - authDate))
    if (isNaN(authDate) || Math.abs(now - authDate) > 60 * 5) {
      console.error('[Telegram/verify] auth_date is stale or invalid')
      return NextResponse.json({ error: 'stale_auth_date' }, { status: 400 })
    }

    // Create a server supabase client that reads cookies from the request
    const { NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY } = process.env
    if (!NEXT_PUBLIC_SUPABASE_URL || !NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      console.error('[Telegram/verify] Supabase env vars not configured')
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
    console.log('[Telegram/verify] telegram_id:', telegramId, 'current user:', user?.id ?? 'none')

    // If user is logged in -> link telegram id to their profile
    if (user) {
      console.log('[Telegram/verify] User is logged in — linking telegram account')
      const { data, error } = await supabaseAdmin
        .from('profiles')
        .update({ telegram_id: telegramId, telegram_username: telegramUsername, telegram_linked_at: new Date().toISOString() })
        .eq('id', user.id)
        .select()
        .single()

      if (error) {
        console.error('[Telegram/verify] Failed to link telegram account:', error.message)
        return NextResponse.json({ error: error.message }, { status: 500 })
      }

      console.log('[Telegram/verify] Telegram account linked successfully')
      return NextResponse.json({ ok: true, action: 'linked', profile: data })
    }

    // Not logged in - check if telegram_id already exists (returning user)
    console.log('[Telegram/verify] Checking for existing profile with telegram_id:', telegramId)
    const { data: existingProfile, error: lookupError } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('telegram_id', telegramId)
      .single()

    if (!lookupError && existingProfile) {
      console.log('[Telegram/verify] Existing profile found — creating session for user:', existingProfile.id)
      const loginCode = crypto.randomBytes(12).toString('hex')

      const { error: codeError } = await supabaseAdmin
        .from('telegram_login_codes')
        .insert({ code: loginCode, user_id: existingProfile.id })

      if (codeError) {
        console.error('[Telegram/verify] Failed to create login code:', codeError.message)
        return NextResponse.json({ error: `Failed to create login code: ${codeError.message}` }, { status: 500 })
      }

      // Ensure wallet exists (backfills any existing users who never had one)
      await ensureWalletRow(existingProfile.id)

      console.log('[Telegram/verify] Login code created — action: login_existing')
      return NextResponse.json({ ok: true, action: 'login_existing', login_code: loginCode })
    }

    // New Telegram user - create account and profile
    console.log('[Telegram/verify] No existing profile found — creating new user for telegram_id:', telegramId)
    const email = generateTelegramUserEmail(telegramId)
    const fullName = `${payload.first_name || ''} ${payload.last_name || ''}`.trim() || telegramUsername || `User ${telegramId}`

    // Create Supabase auth user
    const { data: authData, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      email_confirm: true,
      user_metadata: {
        full_name: fullName,
        telegram_id: telegramId,
        telegram_username: telegramUsername,
      },
    })

    if (createError || !authData.user) {
      // Fallback: auth user may already exist (e.g. from a previous failed attempt)
      console.warn('[Telegram/verify] createUser failed (%s) — falling back to profile/RPC lookup', createError?.message)

      const { data: profileByEmail } = await supabaseAdmin
        .from('profiles')
        .select('id')
        .eq('email', email)
        .single()

      let resolvedUserId: string | null = profileByEmail?.id || null

      if (!resolvedUserId) {
        const { data: rpcId, error: rpcError } = await supabaseAdmin
          .rpc('get_auth_user_id_by_email', { p_email: email })
        if (rpcError) {
          console.warn('[Telegram/verify] RPC get_auth_user_id_by_email error:', rpcError.message)
        }
        resolvedUserId = (rpcId as string | null) || null
      }

      if (!resolvedUserId) {
        console.error('[Telegram/verify] Failed to create user and no fallback found:', createError?.message)
        return NextResponse.json({ error: `Failed to create user: ${createError?.message}` }, { status: 500 })
      }

      console.log('[Telegram/verify] Recovered existing userId=%s', resolvedUserId)
      // Upsert profile with telegram fields (handles both existing rows and missing rows)
      await supabaseAdmin.from('profiles').upsert({
        id: resolvedUserId,
        email,
        full_name: fullName,
        role: 'USER',
        telegram_id: telegramId,
        telegram_username: telegramUsername,
        telegram_linked_at: new Date().toISOString(),
      }, { onConflict: 'id' })

      // Ensure wallet row exists
      await ensureWalletRow(resolvedUserId)

      const loginCode = crypto.randomBytes(12).toString('hex')
      const { error: codeError } = await supabaseAdmin
        .from('telegram_login_codes')
        .insert({ code: loginCode, user_id: resolvedUserId })

      if (codeError) {
        console.error('[Telegram/verify] Failed to create login code (fallback):', codeError.message)
        return NextResponse.json({ error: `Failed to create login code: ${codeError.message}` }, { status: 500 })
      }

      return NextResponse.json({ ok: true, action: 'signup_new', user_id: resolvedUserId, login_code: loginCode })
    }

    console.log('[Telegram/verify] New user created:', authData.user.id)

    // Upsert profile with telegram fields — works whether or not the DB trigger already
    // created the row (the trigger is exception-safe and may silently no-op).
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .upsert({
        id: authData.user.id,
        email,
        full_name: fullName,
        role: 'USER',
        telegram_id: telegramId,
        telegram_username: telegramUsername,
        telegram_linked_at: new Date().toISOString(),
      }, { onConflict: 'id' })
      .select()
      .single()

    if (profileError) {
      console.error('[Telegram/verify] Failed to upsert profile with telegram fields:', profileError.message)
      return NextResponse.json({ error: profileError.message }, { status: 500 })
    }

    // Ensure wallet row exists for the new user
    await ensureWalletRow(authData.user.id)

    // Generate a one-time login code
    const loginCode = crypto.randomBytes(12).toString('hex')
    const { error: codeError } = await supabaseAdmin
      .from('telegram_login_codes')
      .insert({ code: loginCode, user_id: authData.user.id })

    if (codeError) {
      console.error('[Telegram/verify] Failed to create login code for new user:', codeError.message)
      return NextResponse.json({ error: `Failed to create login code: ${codeError.message}` }, { status: 500 })
    }

    console.log('[Telegram/verify] Login code created — action: signup_new')
    return NextResponse.json({
      ok: true,
      action: 'signup_new',
      user_id: authData.user.id,
      profile,
      login_code: loginCode,
    })
  } catch (err: any) {
    console.error('[Telegram/verify] Unhandled exception:', err)
    return NextResponse.json({ error: err.message || String(err) }, { status: 500 })
  }
}
