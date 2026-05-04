import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { supabaseAdmin } from '@/lib/supabase-admin'
import crypto from 'crypto'

export async function POST(req: NextRequest) {
  console.log('[TG bot-link] POST /api/auth/telegram/bot-link called')
  try {
    const body = await req.json().catch(() => ({}))
    const mode = body?.mode === 'link' ? 'link' : 'login'
    console.log('[TG bot-link] mode=%s', mode)
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
      console.error('[TG bot-link] NEXT_PUBLIC_TELEGRAM_BOT_USERNAME env var is not set')
      return NextResponse.json({ error: 'Bot not configured' }, { status: 500 })
    }

    // Login mode is anonymous: just generate a one-time start code.
    if (mode === 'login') {
      const code = crypto.randomBytes(8).toString('hex')
      const deepLinkUrl = `https://t.me/${botUsername}?start=login_${code}`
      console.log('[TG bot-link] Generated login deep link for code=%s', code)

      return NextResponse.json({
        ok: true,
        code,
        deep_link: deepLinkUrl,
      })
    }

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      console.error('[TG bot-link] No logged-in user for link mode')
      return NextResponse.json({ error: 'not_logged_in' }, { status: 401 })
    }

    console.log('[TG bot-link] Generating link code for user=%s', user.id)

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
      console.error('[TG bot-link] Failed to insert telegram_links record:', insertError)
      return NextResponse.json({ error: insertError.message }, { status: 500 })
    }

    // Return the deep link URL
    const deepLinkUrl = `https://t.me/${botUsername}?start=link_${code}`
    console.log('[TG bot-link] Generated link deep link for code=%s, user=%s', code, user.id)

    return NextResponse.json({
      ok: true,
      code,
      deep_link: deepLinkUrl,
    })
  } catch (err: any) {
    console.error('[TG bot-link] Unhandled exception:', err)
    return NextResponse.json({ error: err.message || String(err) }, { status: 500 })
  }
}
