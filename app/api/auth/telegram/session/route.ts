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
      .select('user_id, expires_at')
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

    // Create a session directly from the user_id — no password required
    console.log('[Telegram/session] Creating session for user_id:', codeData.user_id)
    const { data: sessionData, error: sessionError } = await supabaseAdmin.auth.admin.createSession({
      user_id: codeData.user_id,
    })

    console.log('[Telegram/session] createSession result — session present:', !!sessionData?.session, 'error:', sessionError?.message ?? null)

    if (sessionError || !sessionData?.session) {
      console.error('[Telegram/session] Session creation failed:', sessionError?.message)
      return NextResponse.json({ error: 'session_creation_failed' }, { status: 500 })
    }

    // Delete the used code only after session is successfully created
    await supabaseAdmin.from('telegram_login_codes').delete().eq('code', login_code)

    const session = sessionData.session
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
