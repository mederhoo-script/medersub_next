'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Loader2, AlertCircle } from 'lucide-react'

/**
 * Detects whether the app is running inside the Telegram Mini App (WebApp) environment.
 * If so, it automatically exchanges the Telegram initData for a Supabase session
 * (via /api/tg-auth) and redirects the user to /dashboard.
 *
 * The telegram-web-app.js script is loaded in app/layout.tsx so
 * window.Telegram.WebApp is available before this component mounts.
 *
 * Renders its own loading spinner and, on failure, an error message with a
 * retry button — so the caller never shows a stuck spinner.
 */
export default function TelegramMiniAppLogin() {
  const [error, setError] = useState<string | null>(null)
  // Incrementing retryKey re-runs the auth effect without a full page reload.
  const [retryKey, setRetryKey] = useState(0)

  useEffect(() => {
    let cancelled = false

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
      .then(async (json: { ok: boolean; access_token?: string; refresh_token?: string; error?: string }) => {
        if (cancelled) return

        if (!json.ok || !json.access_token) {
          console.error('[MiniApp] Auto-login failed:', json.error)
          setError('Sign-in failed. Please tap Retry or reopen the app.')
          return
        }

        console.log('[MiniApp] Session received — setting session via Supabase client')

        // Set the session client-side so Supabase SSR cookies are written correctly
        const { error: sessionErr } = await supabase.auth.setSession({
          access_token: json.access_token,
          refresh_token: json.refresh_token!,
        })

        if (cancelled) return

        if (sessionErr) {
          console.error('[MiniApp] setSession failed:', sessionErr.message)
          setError('Session error. Please tap Retry or reopen the app.')
          return
        }

        console.log('[MiniApp] Session set — redirecting to /dashboard')
        window.location.href = '/dashboard'
      })
      .catch(err => {
        if (cancelled) return
        console.error('[MiniApp] Network error during auto-login:', err)
        setError('Network error. Please check your connection and tap Retry.')
      })

    return () => { cancelled = true }
  // retryKey is intentionally included: incrementing it re-runs the auth flow.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [retryKey])

  if (error) {
    return (
      <>
        <AlertCircle className="h-10 w-10 text-red-500" />
        <p className="text-sm text-red-500 text-center px-4">{error}</p>
        <button
          onClick={() => { setError(null); setRetryKey(k => k + 1) }}
          className="mt-1 text-sm font-medium text-blue-600 underline underline-offset-2"
        >
          Retry
        </button>
      </>
    )
  }

  return (
    <>
      <Loader2 className="h-10 w-10 animate-spin text-blue-600" />
      <p className="text-sm text-gray-500">Signing you in via Telegram…</p>
    </>
  )
}
