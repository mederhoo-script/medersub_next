import { NextResponse, type NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

async function setAuthCookiesFromLoginCode(req: NextRequest, loginCode: string) {
  console.log('[Telegram/callback] Looking up login code from URL parameter')
  const { data: codeData, error: codeError } = await supabaseAdmin
    .from('telegram_login_codes')
    .select('user_id, expires_at')
    .eq('code', loginCode)
    .single()

  console.log('[Telegram/callback] Login code lookup — found:', !!codeData, 'error:', codeError?.message ?? null)

  if (codeError || !codeData) {
    console.error('[Telegram/callback] Login code not found or lookup error')
    return null
  }

  const isExpired = new Date(codeData.expires_at) < new Date()
  console.log('[Telegram/callback] Code expires_at:', codeData.expires_at, 'is expired:', isExpired)
  if (isExpired) {
    await supabaseAdmin.from('telegram_login_codes').delete().eq('code', loginCode)
    console.error('[Telegram/callback] Login code has expired')
    return null
  }

  console.log('[Telegram/callback] Creating session for user_id:', codeData.user_id)
  const { data: sessionData, error: sessionError } = await supabaseAdmin.auth.admin.createSession({
    user_id: codeData.user_id,
  })

  console.log('[Telegram/callback] createSession — session present:', !!sessionData?.session, 'error:', sessionError?.message ?? null)
  if (sessionError || !sessionData?.session) {
    console.error('[Telegram/callback] Session creation failed:', sessionError?.message)
    return null
  }

  // Delete the used code only after session is successfully created
  await supabaseAdmin.from('telegram_login_codes').delete().eq('code', loginCode)

  const session = sessionData.session

  console.log('[Telegram/callback] Setting auth cookies and redirecting to /dashboard')
  const response = NextResponse.redirect(new URL('/dashboard', req.url))
  response.cookies.set('sb-access-token', session.access_token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: session.expires_in || 3600,
  })
  response.cookies.set('sb-refresh-token', session.refresh_token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 604800,
  })

  return response
}

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams
    const sessionParam = searchParams.get('session')
    let loginCode = searchParams.get('login_code')

    // Also support 'code' parameter for webhook messages
    if (!loginCode) {
      loginCode = searchParams.get('code')
    }

    console.log('[Telegram/callback] GET request — session param present:', !!sessionParam, 'login_code present:', !!loginCode)

    if (loginCode) {
      console.log('[Telegram/callback] Processing login_code from URL')
      const response = await setAuthCookiesFromLoginCode(req, loginCode)
      if (response) return response
      console.error('[Telegram/callback] Failed to exchange login_code, redirecting to /login')
      return NextResponse.redirect(new URL('/login', req.url))
    }

    if (!sessionParam) {
      console.error('[Telegram/callback] No session or login_code param, redirecting to /login')
      return NextResponse.redirect(new URL('/login', req.url))
    }

    // Decode session data
    let sessionData
    try {
      sessionData = JSON.parse(atob(sessionParam))
      console.log('[Telegram/callback] Decoded session data — access_token present:', !!sessionData?.access_token, 'refresh_token present:', !!sessionData?.refresh_token)
    } catch {
      console.error('[Telegram/callback] Failed to decode session param')
      return NextResponse.redirect(new URL('/login', req.url))
    }

    // Create response with redirect
    const response = NextResponse.redirect(new URL('/dashboard', req.url))

    // Set auth cookies
    if (sessionData.access_token) {
      response.cookies.set('sb-access-token', sessionData.access_token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: sessionData.expires_in || 3600,
      })
    }

    if (sessionData.refresh_token) {
      response.cookies.set('sb-refresh-token', sessionData.refresh_token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 604800, // 7 days
      })
    }

    console.log('[Telegram/callback] Auth cookies set, redirecting to /dashboard')
    return response
  } catch (err: any) {
    console.error('[Telegram/callback] Unhandled exception:', err)
    return NextResponse.redirect(new URL('/login', req.url))
  }
}
