import { NextResponse, type NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

export async function POST(req: NextRequest) {
  try {
    const { login_code } = await req.json()

    console.log('[Telegram/session] Received POST request, login_code present:', !!login_code)

    if (!login_code) {
      console.error('[Telegram/session] No login_code provided')
      return NextResponse.json({ error: 'login_code required' }, { status: 400 })
    }

    // Look up the login code
    const { data: codeData, error: codeError } = await supabaseAdmin
      .from('telegram_login_codes')
      .select('user_id, expires_at, temporary_password')
      .eq('code', login_code)
      .single()

    console.log('[Telegram/session] Login code lookup result — found:', !!codeData, 'error:', codeError?.message ?? null)

    if (codeError || !codeData) {
      console.error('[Telegram/session] Invalid or not found login code')
      return NextResponse.json({ error: 'invalid_code' }, { status: 401 })
    }

    // Check if code expired
    const isExpired = new Date(codeData.expires_at) < new Date()
    console.log('[Telegram/session] Code expires_at:', codeData.expires_at, 'is expired:', isExpired)
    if (isExpired) {
      // Delete expired code
      await supabaseAdmin.from('telegram_login_codes').delete().eq('code', login_code)
      console.error('[Telegram/session] Login code has expired')
      return NextResponse.json({ error: 'code_expired' }, { status: 401 })
    }

    // Get user data
    const { data: user, error: userError } = await supabaseAdmin.auth.admin.getUserById(codeData.user_id)

    console.log('[Telegram/session] User lookup for id:', codeData.user_id, '— found:', !!user, 'error:', userError?.message ?? null)

    if (userError || !user) {
      console.error('[Telegram/session] User not found for id:', codeData.user_id)
      return NextResponse.json({ error: 'user_not_found' }, { status: 404 })
    }

    // Delete the used code
    await supabaseAdmin.from('telegram_login_codes').delete().eq('code', login_code)

    // Use the temporary password stored with the login code to sign in and obtain a session
    const tempPassword = (codeData as any).temporary_password

    if (!tempPassword) {
      console.error('[Telegram/session] No temporary_password stored with login code')
      return NextResponse.json({ error: 'no_temporary_password_available' }, { status: 400 })
    }

    // Sign in with email + temporary password to obtain a regular session
    const email = (user as any)?.email
    console.log('[Telegram/session] Attempting signInWithPassword for email:', email)
    if (!email) {
      console.error('[Telegram/session] User has no email address')
      return NextResponse.json({ error: 'user_has_no_email' }, { status: 500 })
    }

    // Use signInWithPassword on the server client (service role client)
    const signInResult = await (supabaseAdmin.auth as any).signInWithPassword({
      email,
      password: tempPassword,
    })

    const session = signInResult?.data?.session
    const signInError = signInResult?.error

    console.log('[Telegram/session] signInWithPassword result — session present:', !!session, 'error:', signInError?.message ?? null)

    if (signInError || !session) {
      console.error('[Telegram/session] Session creation failed:', signInError?.message)
      return NextResponse.json({ error: 'session_creation_failed' }, { status: 500 })
    }

    // Delete the used code so it cannot be reused
    await supabaseAdmin.from('telegram_login_codes').delete().eq('code', login_code)

    console.log('[Telegram/session] Session created successfully, returning tokens')
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
    console.error('[Telegram/session] Unhandled exception:', err)
    return NextResponse.json({ error: err.message || String(err) }, { status: 500 })
  }
}
