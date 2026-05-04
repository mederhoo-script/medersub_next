'use client'

import { useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'

/**
 * Detects whether the app is running inside the Telegram Mini App (WebApp) environment.
 * If so, it automatically exchanges the Telegram initData for a Supabase session
 * (via /api/tg-auth) and redirects the user to /dashboard.
 *
 * The telegram-web-app.js script is loaded in app/layout.tsx so
 * window.Telegram.WebApp is available before this component mounts.
 */
export default function TelegramMiniAppLogin() {
  const attempted = useRef(false)

  useEffect(() => {
    if (attempted.current) return
    attempted.current = true

    const tg = (window as { Telegram?: { WebApp?: { initData?: string; ready?: () => void } } }).Telegram?.WebApp
    if (!tg?.initData) return

    // Tell Telegram the Mini App is ready (hides the native loading indicator)
    tg.ready?.()

    console.log('[MiniApp] Telegram WebApp context detected — attempting auto-login')

    fetch('/api/tg-auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ init_data: tg.initData }),
    })
      .then(res => res.json())
      .then(async json => {
        if (!json.ok || !json.access_token) {
          console.error('[MiniApp] Auto-login failed:', json.error)
          return
        }

        console.log('[MiniApp] Session received — setting session via Supabase client')

        // Set the session client-side so Supabase SSR cookies are written correctly
        const { error } = await supabase.auth.setSession({
          access_token: json.access_token,
          refresh_token: json.refresh_token,
        })

        if (error) {
          console.error('[MiniApp] setSession failed:', error.message)
          return
        }

        console.log('[MiniApp] Session set — redirecting to /dashboard')
        window.location.href = '/dashboard'
      })
      .catch(err => {
        console.error('[MiniApp] Network error during auto-login:', err)
      })
  }, [])

  // Renders nothing — this is a behaviour-only component
  return null
}
