import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { supabaseAdmin } from '@/lib/supabase-admin'
import crypto from 'crypto'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const mode = body?.mode === 'link' ? 'link' : 'login'
    const { NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY } = process.env

    // Get current user from session
    const supabase = createServerClient(
      NEXT_PUBLIC_SUPABASE_URL!,
      NEXT_PUBLIC_SUPABASE_ANON_KEY!,
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

    const botUsername = process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME
    if (!botUsername) {
      return NextResponse.json({ error: 'Bot not configured' }, { status: 500 })
    }

    // Login mode is anonymous: just generate a one-time start code.
    if (mode === 'login') {
      const code = crypto.randomBytes(8).toString('hex')
      const deepLinkUrl = `https://t.me/${botUsername}?start=login_${code}`

      return NextResponse.json({
        ok: true,
        code,
        deep_link: deepLinkUrl,
      })
    }

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'not_logged_in' }, { status: 401 })
    }

    // Generate a random code
    const code = crypto.randomBytes(8).toString('hex')

    // Store it in the database (30 minute expiry)
    const { error: insertError } = await supabaseAdmin
      .from('telegram_links')
      .insert({
        code,
        user_id: user.id,
      })

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 })
    }

    // Return the deep link URL
    const deepLinkUrl = `https://t.me/${botUsername}?start=link_${code}`

    return NextResponse.json({
      ok: true,
      code,
      deep_link: deepLinkUrl,
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || String(err) }, { status: 500 })
  }
}
