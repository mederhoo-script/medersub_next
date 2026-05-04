'use client'

import { useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'

/**
 * Detects whether the app is running inside the Telegram Mini App (WebApp) environment.
 * If so, it automatically exchanges the Telegram initData for a Supabase session
 * and redirects the user to /dashboard.
 *
 * The telegram-web-app.js script is already loaded in app/layout.tsx so
 * window.Telegram.WebApp is available before this component mounts.
 */
export default function TelegramMiniAppLogin() {
  const router = useRouter()
  const attempted = useRef(false)

  useEffect(() => {
    if (attempted.current) return
    attempted.current = true

    const tg = (window as any).Telegram?.WebApp
    if (!tg?.initData) return

    // Tell Telegram the app is ready (hides the loading indicator)
    tg.ready?.()

    console.log('[MiniApp] Telegram WebApp context detected — attempting auto-login')

    fetch('/api/auth/telegram/miniapp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ init_data: tg.initData }),
      credentials: 'include',
    })
      .then(res => res.json())
      .then(json => {
        if (!json.ok || !json.session) {
          console.error('[MiniApp] Auto-login failed:', json.error)
          return
        }
        console.log('[MiniApp] Session obtained — redirecting to /dashboard via callback')
        const encodedSession = btoa(JSON.stringify(json.session))
        window.location.href = `/api/auth/telegram/callback?session=${encodedSession}`
      })
      .catch(err => {
        console.error('[MiniApp] Network error during auto-login:', err)
      })
  }, [router])

  // Renders nothing — this is a behaviour-only component
  return null
}
