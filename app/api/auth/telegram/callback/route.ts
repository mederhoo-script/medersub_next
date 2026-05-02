import { NextResponse, type NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

async function setAuthCookiesFromLoginCode(req: NextRequest, loginCode: string) {
  const { data: codeData, error: codeError } = await supabaseAdmin
    .from('telegram_login_codes')
    .select('user_id, expires_at, temporary_password')
    .eq('code', loginCode)
    .single()

  if (codeError || !codeData) {
    return null
  }

  if (new Date(codeData.expires_at) < new Date()) {
    await supabaseAdmin.from('telegram_login_codes').delete().eq('code', loginCode)
    return null
  }

  const { data: user, error: userError } = await supabaseAdmin.auth.admin.getUserById(codeData.user_id)
  if (userError || !user) {
    return null
  }

  const tempPassword = (codeData as any).temporary_password
  const email = (user as any)?.email
  if (!tempPassword || !email) {
    return null
  }

  const signInResult = await (supabaseAdmin.auth as any).signInWithPassword({
    email,
    password: tempPassword,
  })

  const session = signInResult?.data?.session
  if (!session) {
    return null
  }

  await supabaseAdmin.from('telegram_login_codes').delete().eq('code', loginCode)

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

    if (loginCode) {
      const response = await setAuthCookiesFromLoginCode(req, loginCode)
      if (response) return response
      return NextResponse.redirect(new URL('/login', req.url))
    }

    if (!sessionParam) {
      return NextResponse.redirect(new URL('/login', req.url))
    }

    // Decode session data
    let sessionData
    try {
      sessionData = JSON.parse(atob(sessionParam))
    } catch {
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

    return response
  } catch (err: any) {
    return NextResponse.redirect(new URL('/login', req.url))
  }
}
