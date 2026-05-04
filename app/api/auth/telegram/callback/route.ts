import { NextResponse, type NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

async function setAuthCookiesFromLoginCode(req: NextRequest, loginCode: string) {
  console.log('[TG callback] setAuthCookiesFromLoginCode — looking up code (length=%d)', loginCode.length)
  const { data: codeData, error: codeError } = await supabaseAdmin
    .from('telegram_login_codes')
    .select('user_id, expires_at, temporary_password')
    .eq('code', loginCode)
    .single()

  if (codeError || !codeData) {
    console.error('[TG callback] Login code not found in DB:', codeError?.message ?? 'no data')
    return null
  }

  console.log('[TG callback] Code found — user_id=%s, expires_at=%s', codeData.user_id, codeData.expires_at)

  if (new Date(codeData.expires_at) < new Date()) {
    console.error('[TG callback] Login code expired at %s', codeData.expires_at)
    await supabaseAdmin.from('telegram_login_codes').delete().eq('code', loginCode)
    return null
  }

  const { data: user, error: userError } = await supabaseAdmin.auth.admin.getUserById(codeData.user_id)
  if (userError || !user) {
    console.error('[TG callback] User not found for user_id=%s:', codeData.user_id, userError?.message)
    return null
  }

  const tempPassword = (codeData as any).temporary_password
  const email = (user as any)?.email
  console.log('[TG callback] User found — email=%s, hasTempPassword=%s', email, !!tempPassword)
  if (!tempPassword || !email) {
    console.error('[TG callback] Missing tempPassword or email — cannot sign in')
    return null
  }

  console.log('[TG callback] Attempting signInWithPassword for email=%s', email)
  const signInResult = await (supabaseAdmin.auth as any).signInWithPassword({
    email,
    password: tempPassword,
  })

  const session = signInResult?.data?.session
  console.log('[TG callback] signInWithPassword — hasSession=%s, error=%s', !!session, signInResult?.error?.message ?? 'none')
  if (!session) {
    console.error('[TG callback] Session creation failed:', signInResult?.error)
    return null
  }

  await supabaseAdmin.from('telegram_login_codes').delete().eq('code', loginCode)

  console.log('[TG callback] Setting auth cookies and redirecting to /dashboard')
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
  console.log('[TG callback] GET /api/auth/telegram/callback called, url=%s', req.nextUrl.toString())
  try {
    const searchParams = req.nextUrl.searchParams
    const sessionParam = searchParams.get('session')
    let loginCode = searchParams.get('login_code')

    // Also support 'code' parameter for webhook messages
    if (!loginCode) {
      loginCode = searchParams.get('code')
    }

    console.log('[TG callback] Params — loginCode=%s, sessionParam=%s', loginCode ? `[length:${loginCode.length}]` : null, sessionParam ? '[present]' : null)

    if (loginCode) {
      const response = await setAuthCookiesFromLoginCode(req, loginCode)
      if (response) return response
      console.error('[TG callback] setAuthCookiesFromLoginCode returned null — redirecting to /login')
      return NextResponse.redirect(new URL('/login', req.url))
    }

    if (!sessionParam) {
      console.error('[TG callback] No loginCode or session param — redirecting to /login')
      return NextResponse.redirect(new URL('/login', req.url))
    }

    // Decode session data
    let sessionData
    try {
      sessionData = JSON.parse(atob(sessionParam))
      console.log('[TG callback] Decoded session — hasAccessToken=%s, hasRefreshToken=%s', !!sessionData?.access_token, !!sessionData?.refresh_token)
    } catch {
      console.error('[TG callback] Failed to decode session param base64/JSON')
      return NextResponse.redirect(new URL('/login', req.url))
    }

    // Create response with redirect
    console.log('[TG callback] Setting cookies from session param and redirecting to /dashboard')
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

    return response
  } catch (err: any) {
    console.error('[TG callback] Unhandled exception:', err)
    return NextResponse.redirect(new URL('/login', req.url))
  }
}
