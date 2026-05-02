import { NextResponse, type NextRequest } from 'next/server'

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams
    const sessionParam = searchParams.get('session')

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
