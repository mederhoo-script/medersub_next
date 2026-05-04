import { NextResponse, type NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

export async function POST(req: NextRequest) {
  console.log('[TG session] POST /api/auth/telegram/session called')
  try {
    const { login_code } = await req.json()

    if (!login_code) {
      console.error('[TG session] Missing login_code in request body')
      return NextResponse.json({ error: 'login_code required' }, { status: 400 })
    }

    console.log('[TG session] Looking up login code (length=%d)', login_code.length)

    // Look up the login code
    const { data: codeData, error: codeError } = await supabaseAdmin
      .from('telegram_login_codes')
      .select('user_id, expires_at, temporary_password')
      .eq('code', login_code)
      .single()

    if (codeError || !codeData) {
      console.error('[TG session] Login code not found in DB:', codeError?.message ?? 'no data')
      return NextResponse.json({ error: 'invalid_code' }, { status: 401 })
    }

    console.log('[TG session] Code found — user_id=%s, expires_at=%s', codeData.user_id, codeData.expires_at)

    // Check if code expired
    if (new Date(codeData.expires_at) < new Date()) {
      console.error('[TG session] Login code expired at %s', codeData.expires_at)
      // Delete expired code
      await supabaseAdmin.from('telegram_login_codes').delete().eq('code', login_code)
      return NextResponse.json({ error: 'code_expired' }, { status: 401 })
    }

    // Get user data
    const { data: user, error: userError } = await supabaseAdmin.auth.admin.getUserById(codeData.user_id)

    if (userError || !user) {
      console.error('[TG session] User not found for user_id=%s:', codeData.user_id, userError?.message)
      return NextResponse.json({ error: 'user_not_found' }, { status: 404 })
    }

    console.log('[TG session] User retrieved — email=%s', (user as any)?.email)

    // Delete the used code
    await supabaseAdmin.from('telegram_login_codes').delete().eq('code', login_code)

    // Use the temporary password stored with the login code to sign in and obtain a session
    const tempPassword = (codeData as any).temporary_password

    if (!tempPassword) {
      console.error('[TG session] No temporary_password stored with the login code')
      return NextResponse.json({ error: 'no_temporary_password_available' }, { status: 400 })
    }

    // Sign in with email + temporary password to obtain a regular session
    const email = (user as any)?.email
    if (!email) {
      console.error('[TG session] User has no email address')
      return NextResponse.json({ error: 'user_has_no_email' }, { status: 500 })
    }

    console.log('[TG session] Attempting signInWithPassword for email=%s', email)

    // Use signInWithPassword on the server client (service role client)
    const signInResult = await (supabaseAdmin.auth as any).signInWithPassword({
      email,
      password: tempPassword,
    })

    const session = signInResult?.data?.session
    const signInError = signInResult?.error

    console.log('[TG session] signInWithPassword result — hasSession=%s, error=%s', !!session, signInError?.message ?? 'none')

    if (signInError || !session) {
      console.error('[TG session] Session creation failed:', signInError)
      return NextResponse.json({ error: 'session_creation_failed' }, { status: 500 })
    }

    // Delete the used code so it cannot be reused
    await supabaseAdmin.from('telegram_login_codes').delete().eq('code', login_code)

    console.log('[TG session] Session created successfully — expires_in=%d', session.expires_in)

    // Return session data so frontend can set cookies
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
    console.error('[TG session] Unhandled exception:', err)
    return NextResponse.json({ error: err.message || String(err) }, { status: 500 })
  }
}
