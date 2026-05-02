'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

type Props = {
  botUsername?: string
  label?: string
}

export default function TelegramButton({ botUsername, label = 'Continue with Telegram' }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    function handleMessage(e: MessageEvent) {
      if (!e.origin || e.origin !== window.location.origin) return
      if (e.data?.type === 'telegram_auth' && e.data.payload) {
        handleTelegramAuth(e.data.payload)
      }
    }

    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [])

  const handleTelegramAuth = async (payload: Record<string, any>) => {
    setLoading(true)
    try {
      // Send the payload to server to verify and link/create account
      const res = await fetch('/api/auth/telegram/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ payload }),
        credentials: 'include',
      })

      const json = await res.json()

      if (!json.ok) {
        alert(json.error || 'Telegram verification failed')
        setLoading(false)
        return
      }

      // Handle different response actions
      if (json.action === 'linked') {
        // Already logged in user linked their telegram account
        window.location.reload()
      } else if (json.action === 'signup_new' || json.action === 'login_existing') {
        // New user created or existing telegram user logging in
        // Exchange login_code for session
        if (json.login_code) {
          await exchangeLoginCode(json.login_code)
        } else {
          alert('Login failed. Please try again.')
          setLoading(false)
        }
      }
    } catch (err) {
      console.error(err)
      alert('Network error while verifying Telegram')
      setLoading(false)
    }
  }

  const openPopup = () => {
    const bot = botUsername || (process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME || '')
    const url = `/telegram-login.html${bot ? '?bot=' + encodeURIComponent(bot) : ''}`
    window.open(url, 'telegram_login', 'width=520,height=640')
  }

  const exchangeLoginCode = async (loginCode: string) => {
    try {
      const res = await fetch('/api/auth/telegram/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ login_code: loginCode }),
        credentials: 'include',
      })

      const json = await res.json()

      if (!json.ok || !json.session) {
        alert('Login failed. Please try again.')
        setLoading(false)
        return
      }

      // We have session tokens - redirect to callback handler
      const encodedSession = btoa(JSON.stringify(json.session))
      window.location.href = `/api/auth/telegram/callback?session=${encodedSession}`
    } catch (err) {
      console.error(err)
      alert('Network error during login')
      setLoading(false)
    }
  }

  return (
    <button
      type="button"
      onClick={openPopup}
      disabled={loading}
      className="w-full inline-flex items-center justify-center gap-2 py-2 px-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
    >
      <svg width="20" height="20" viewBox="0 0 240 240" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M120 0C53.7 0 0 53.7 0 120s53.7 120 120 120 120-53.7 120-120S186.3 0 120 0z" fill="#37AEE2"/>
        <path d="M49 122.5l28.2 10.7 9.9 34.1c1.4 4.9 5 6.2 9.6 3.9 18.2-8.8 39.3-19 98.5-48.2 5.5-2.6 9.1-6.1 5-10-3.7-3.4-7.6-3.1-12-1.5L55.8 141.8c-5.4 1.9-9.5.8-6.8-19.3z" fill="#FFF"/>
      </svg>
      <span className="text-sm font-medium">{loading ? 'Authenticating...' : label}</span>
    </button>
  )
}
