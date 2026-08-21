'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import type { User } from '@supabase/supabase-js'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import dynamic from 'next/dynamic'
import { Mail, Lock, Unlink2, CheckCircle2, AlertCircle, LogOut, Bell, ShieldAlert } from 'lucide-react'
import { enrollTransactionBiometrics } from '@/components/dashboard/biometric-transaction'
import { disableCurrentNativePushToken, registerNativePushNotifications } from '@/components/dashboard/native-push-notifications'
    
const TelegramButton = dynamic(() => import('@/components/auth/telegram-button'), { ssr: false })

interface Profile {
  id: string
  full_name: string
  telegram_id: string | null
  telegram_username: string | null
  telegram_linked_at: string | null
  created_at: string
  role: string | null
  bvn: string | null
}

interface NotificationSettings {
  pushEnabled: boolean
  transactionsEnabled: boolean
  accountEnabled: boolean
  promosEnabled: boolean
}

export default function SettingsPage() {
  const router = useRouter()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [editMode, setEditMode] = useState(true)
  const [settingPassword, setSettingPassword] = useState(false)
  const [settingPin, setSettingPin] = useState(false)
  const [hasTransactionPin, setHasTransactionPin] = useState(false)
  const [mustChangeTransactionPin, setMustChangeTransactionPin] = useState(false)
  const [unlinkingTelegram, setUnlinkingTelegram] = useState(false)
  const [notificationSettings, setNotificationSettings] = useState<NotificationSettings>({
    pushEnabled: true,
    transactionsEnabled: true,
    accountEnabled: true,
    promosEnabled: false,
  })
  const [savingNotificationSettings, setSavingNotificationSettings] = useState(false)

  const [formData, setFormData] = useState({
    email: '',
    fullName: '',
    bvn: '',
  })

  const [passwordData, setPasswordData] = useState({
    newPassword: '',
    confirmPassword: '',
  })

  const [pinData, setPinData] = useState({
    currentPin: '',
    pin: '',
    confirmPin: '',
  })

  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  useEffect(() => {
    const fetchData = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
          router.push('/login')
          return
        }

        setUser(user)

        const { data, error } = await supabase
          .from('profiles')
          .select('id,full_name,telegram_id,telegram_username,telegram_linked_at,created_at,role,bvn')
          .eq('id', user.id)
          .single()

        if (error) throw error
        setProfile(data)
        setFormData({
          email: user.email || '',
          fullName: data?.full_name || '',
          bvn: data?.bvn || '',
        })

        if (data.bvn) {setEditMode(false)}

        const pinResponse = await fetch('/api/account/transaction-pin', { credentials: 'include' })
        if (pinResponse.ok) {
          const pinStatus = await pinResponse.json()
          setHasTransactionPin(Boolean(pinStatus.hasTransactionPin))
          setMustChangeTransactionPin(Boolean(pinStatus.mustChangeTransactionPin))
          if (hasTransactionPin) {
          setSettingPin(true)
        }
        }

        const notificationResponse = await fetch('/api/account/notifications', { credentials: 'include' })
        if (notificationResponse.ok) {
          const notificationPayload = await notificationResponse.json()
          if (notificationPayload?.settings) {
            setNotificationSettings({
              pushEnabled: notificationPayload.settings.pushEnabled !== false,
              transactionsEnabled: notificationPayload.settings.transactionsEnabled !== false,
              accountEnabled: notificationPayload.settings.accountEnabled !== false,
              promosEnabled: notificationPayload.settings.promosEnabled === true,
            })
          }
        }
      } catch {
        setMessage({ type: 'error', text: 'Failed to load profile' })
      } finally {
        setLoading(false)
      }
      
    }

    fetchData()
  }, [router])

  useEffect(() => {
    if (!loading && !hasTransactionPin) {
      setSettingPin(true)
    }
  }, [hasTransactionPin, loading])
  

  const handleUnlinkTelegram = async () => {
    if (!confirm('Unlink Telegram from your account? You can link it again later.')) return

    setUnlinkingTelegram(true)
    try {
      const response = await fetch('/api/auth/telegram/unlink', {
        method: 'POST',
        credentials: 'include',
      })
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to unlink')
      }

      setMessage({ type: 'success', text: 'Telegram unlinked successfully' })
      setProfile((prev) =>
        prev
          ? { ...prev, telegram_id: null, telegram_username: null, telegram_linked_at: null }
          : null
      )
    } catch (err: unknown) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Something went wrong' })
    } finally {
      setUnlinkingTelegram(false)
    }
  }

  const handleUpdatePin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    if (!/^\d{4}$/.test(pinData.pin) || pinData.pin !== pinData.confirmPin) {
      setMessage({ type: 'error', text: 'Enter matching 4-digit PINs.' })
      setLoading(false)
      return
    }

    try {
      const response = await fetch('/api/account/transaction-pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(pinData),
      })
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to save transaction PIN')
      }

      setMessage({ type: 'success', text: 'Transaction PIN saved successfully' })
      setSettingPin(false)
      setPinData({ currentPin: '', pin: '', confirmPin: '' })
      setHasTransactionPin(true)
      setMustChangeTransactionPin(false)

      if (hasTransactionPin) {
          setSettingPin(true)
        }
    } catch (err: unknown) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Something went wrong' })
    } finally {
      setLoading(false)
    }
  }

  const handleEnrollBiometrics = async () => {
    try {
      await enrollTransactionBiometrics()
      setMessage({ type: 'success', text: 'Fingerprint / Face ID is ready for transaction approval.' })
    } catch (err: unknown) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Something went wrong' })
    }
  }

  const persistNotificationSettings = async (nextSettings: NotificationSettings) => {
    setSavingNotificationSettings(true)
    try {
      const response = await fetch('/api/account/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          action: 'update-settings',
          ...nextSettings,
        }),
      })
      const payload = await response.json()
      if (!response.ok) {
        throw new Error(payload.error || 'Failed to update notification settings')
      }
      setNotificationSettings(nextSettings)
      setMessage({ type: 'success', text: 'Notification settings updated.' })
    } catch (err: unknown) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Something went wrong' })
    } finally {
      setSavingNotificationSettings(false)
    }
  }

  const handleNativeNotificationEnable = async () => {
    const result = await registerNativePushNotifications()
    if (!result.ok) {
      setMessage({ type: 'error', text: result.message || 'Could not enable notifications on this device.' })
      return
    }
    setMessage({ type: 'success', text: 'Notifications enabled on this Android device.' })
  }

  const handlePushEnabledToggle = async (enabled: boolean) => {
    const nextSettings = {
      ...notificationSettings,
      pushEnabled: enabled,
    }
    await persistNotificationSettings(nextSettings)
    if (!enabled) {
      await disableCurrentNativePushToken()
    } else {
      await handleNativeNotificationEnable()
    }
  }

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setMessage({ type: 'error', text: 'Passwords do not match' })
      setLoading(false)
      return
    }

    if (passwordData.newPassword.length < 8) {
      setMessage({ type: 'error', text: 'Password must be at least 8 characters' })
      setLoading(false)
      return
    }

    try {
      const { error } = await supabase.auth.updateUser({
        password: passwordData.newPassword,
      })

      if (error) throw error

      setMessage({ type: 'success', text: 'Password updated successfully' })
      setSettingPassword(false)
      setPasswordData({
        newPassword: '',
        confirmPassword: '',
      })
    } catch (err: unknown) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Something went wrong' })
    } finally {
      setLoading(false)
    }
  }

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault()
    if (formData.bvn && (formData.bvn.length !== 11 || /[^0-9]/.test(formData.bvn))) {
      setMessage({ type: 'error', text: 'Enter a valid 11-digit BVN.' })
      return
    }

    const normalizedBvn = formData.bvn.replace(/[^0-9]/g, '')
    const bvnChanged = normalizedBvn !== (profile?.bvn || '')
    setLoading(true)

    try {
      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          full_name: formData.fullName,
          bvn: normalizedBvn,
        })
        .eq('id', profile?.id)

      if (profileError) throw profileError

      if (bvnChanged && normalizedBvn) {
        const accountResponse = await fetch('/api/payments/korapay/account', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ regenerate: true }),
        })
        const accountPayload = await accountResponse.json()
        if (!accountResponse.ok) {
          throw new Error(accountPayload.error || 'Your BVN was saved, but we could not generate a new virtual account.')
        }
      }

      if (formData.email !== user?.email) {
        const { error: emailError } = await supabase.auth.updateUser({
          email: formData.email,
        })
        if (emailError) throw emailError
      }

      setMessage({ type: 'success', text: 'Profile updated successfully' })
      setProfile((prev) => (prev ? { ...prev, full_name: formData.fullName, bvn: normalizedBvn || null } : null))
      setEditMode(false)
    } catch (err: unknown) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Something went wrong' })
    } finally {
      setLoading(false)
    }
  }

  if (loading && !profile) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Account Settings</h1>

      {message && (
        <div
          className={`p-4 rounded-lg flex items-center gap-2 ${
            message.type === 'success'
              ? 'bg-green-50 text-green-700 border border-green-200'
              : 'bg-red-50 text-red-700 border border-red-200'
          }`}
        >
          {message.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 shrink-0" />
          ) : (
            <AlertCircle className="w-5 h-5 shrink-0" />
          )}
          <span>{message.text}</span>
        </div>
      )}

      {profile?.role?.toUpperCase() === 'ADMIN' && (
        <div className="rounded-xl border border-purple-100 bg-purple-50 p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <ShieldAlert className="mt-1 h-5 w-5 text-purple-600" />
              <div>
                <h2 className="font-semibold text-purple-950">Admin access</h2>
                <p className="text-sm text-purple-700">Open the admin panel from here if the bottom mobile admin tab is hard to reach.</p>
              </div>
            </div>
           {/* Admin Link - Only visible to admins */}
                    {profile?.role?.toUpperCase() === 'ADMIN' && (
                      <div className="pt-4 mt-4 border-t border-gray-100">
                        <Link
                          href="/admin"
                          className="flex items-center px-4 py-3 text-sm font-medium rounded-xl text-purple-600 bg-purple-50 hover:bg-purple-100 transition-colors"
                        >
                          <ShieldAlert className="mr-3 h-5 w-5" />
                          Admin Panel
                        </Link>
                      </div>
                    )}
          </div>
        </div>
      )}

      {/* Login Methods */}
      <div className="bg-white rounded-xl border border-gray-100 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-6">Login Methods</h2>

        {/* Profile Information */}
      <div className="bg-white rounded-xl border border-gray-100 p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-gray-900">Profile Information</h2>
          {!editMode && (
            <button
              onClick={() => setEditMode(true)}
              className="text-blue-600 hover:text-blue-700 font-medium text-sm"
            >
              Edit
            </button>
          )}
        </div>

        {editMode ? (
          <form onSubmit={handleUpdateProfile} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Full Name
              </label>
              <input
                type="text"
                value={formData.fullName}
                onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className='block text-sm font-medium text-gray-700 mb-1'>BVN</label>
              <input
                type='text'
                inputMode='numeric'
                maxLength={11}
                value={formData.bvn}
                onChange={(e) => setFormData({ ...formData, bvn: e.target.value.replace(/[^0-9]/g, '') })}
                placeholder='Enter your 11-digit BVN'
                className='w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent'
              />
              <p className='mt-1 text-xs text-gray-500'>Your BVN removes the ₦5,000 daily transfer limit.</p>
            </div>

            <div className='flex gap-2 pt-4'>
              <button
                type="submit"
                disabled={loading}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium"
              >
                Save Changes
              </button>
              <button
                type="button"
                onClick={() => setEditMode(false)}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium"
              >
                Cancel
              </button>
            </div>
          </form>
        ) : (
          <div className="space-y-4">
            <div>
              <p className="text-sm text-gray-600">Full Name</p>
              <p className="text-gray-900 font-medium">{profile?.full_name || 'Not set'}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Email</p>
              <p className="text-gray-900 font-medium">{user?.email}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Member Since</p>
              <p className="text-gray-900 font-medium">
                {profile?.created_at ? new Date(profile.created_at).toLocaleDateString() : 'N/A'}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Transaction PIN Section */}
        <div className="mb-6 pb-6 border-b border-gray-200">
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-start gap-3">
              <Lock className="w-5 h-5 text-purple-600 mt-1" />
              <div>
                <p className="font-medium text-gray-900">Transaction PIN</p>
                <p className="text-sm text-gray-600">Use a 4-digit PIN to approve wallet and reward purchases.</p>
                <div className={`flex items-center gap-1 text-xs mt-1 ${mustChangeTransactionPin ? 'text-amber-600' : 'text-green-600'}`}>
                  <CheckCircle2 className="w-4 h-4" />
                  {mustChangeTransactionPin ? 'Default PIN must be changed before purchases' : hasTransactionPin ? 'Active' : 'Not set'}
                </div>
              </div>
            </div>
          </div>

          {!settingPin && (
            <button
              onClick={() => setSettingPin(true)}
              className="text-sm text-blue-600 hover:text-blue-700 font-medium ml-8"
            >
              {mustChangeTransactionPin ? 'Change Default Transaction PIN' : hasTransactionPin ? 'Change Transaction PIN' : 'Create Transaction PIN'}
            </button>
          )}

          {settingPin && (
            <form onSubmit={handleUpdatePin} className="space-y-4 mt-4 pt-4 border-t border-gray-200 ml-8">
              {hasTransactionPin && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Current PIN</label>
                  {mustChangeTransactionPin && <p className="text-xs text-amber-700 mb-1">Your current default PIN is 1234. Choose a new PIN to enable purchases.</p>}
                  <input
                    type="password"
                    inputMode="numeric"
                    pattern="\d{4}"
                    maxLength={4}
                    value={pinData.currentPin}
                    onChange={(e) => setPinData({ ...pinData, currentPin: e.target.value.replace(/\D/g, '').slice(0, 4) })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Enter current 4-digit PIN"
                    required
                  />
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">New PIN</label>
                <input
                  type="password"
                  inputMode="numeric"
                  pattern="\d{4}"
                  maxLength={4}
                  value={pinData.pin}
                  onChange={(e) => setPinData({ ...pinData, pin: e.target.value.replace(/\D/g, '').slice(0, 4) })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Enter 4-digit PIN"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Confirm New PIN</label>
                <input
                  type="password"
                  inputMode="numeric"
                  pattern="\d{4}"
                  maxLength={4}
                  value={pinData.confirmPin}
                  onChange={(e) => setPinData({ ...pinData, confirmPin: e.target.value.replace(/\D/g, '').slice(0, 4) })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Confirm 4-digit PIN"
                  required
                />
              </div>
              <div className="flex gap-2">
                <button type="submit" disabled={loading} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm font-medium">Save PIN</button>
                <button type="button" onClick={() => setSettingPin(false)} className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 text-sm font-medium">Cancel</button>
              </div>
            </form>
          )}
        </div>

        {/* Email/Password Section */}
        <div className="mb-6 pb-6 border-b border-gray-200">
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-start gap-3">
              <Mail className="w-5 h-5 text-blue-600 mt-1" />
              <div>
                <p className="font-medium text-gray-900">Email & Password</p>
                <p className="text-sm text-gray-600">{user?.email}</p>
                <div className="flex items-center gap-1 text-xs text-green-600 mt-1">
                  <CheckCircle2 className="w-4 h-4" />
                  Active
                </div>

                <div className="mb-6 pb-6 border-b border-gray-200">
                  <div className="flex items-start gap-3">
                    <Bell className="w-5 h-5 text-emerald-600 mt-1" />
                    <div className="w-full">
                      <p className="font-medium text-gray-900">Push Notifications</p>
                      <p className="text-sm text-gray-600">Receive transaction updates, account alerts, and promotional messages.</p>

                      <div className="mt-4 space-y-3">
                        <label className="flex items-center justify-between gap-3 text-sm text-gray-700">
                          <span>Enable push notifications</span>
                          <input
                            type="checkbox"
                            checked={notificationSettings.pushEnabled}
                            disabled={savingNotificationSettings}
                            onChange={(event) => {
                              void handlePushEnabledToggle(event.target.checked)
                            }}
                          />
                        </label>

                        <label className="flex items-center justify-between gap-3 text-sm text-gray-700">
                          <span>Transactions</span>
                          <input
                            type="checkbox"
                            checked={notificationSettings.transactionsEnabled}
                            disabled={savingNotificationSettings || !notificationSettings.pushEnabled}
                            onChange={(event) => {
                              const nextSettings = { ...notificationSettings, transactionsEnabled: event.target.checked }
                              void persistNotificationSettings(nextSettings)
                            }}
                          />
                        </label>

                        <label className="flex items-center justify-between gap-3 text-sm text-gray-700">
                          <span>Account alerts</span>
                          <input
                            type="checkbox"
                            checked={notificationSettings.accountEnabled}
                            disabled={savingNotificationSettings || !notificationSettings.pushEnabled}
                            onChange={(event) => {
                              const nextSettings = { ...notificationSettings, accountEnabled: event.target.checked }
                              void persistNotificationSettings(nextSettings)
                            }}
                          />
                        </label>

                        <label className="flex items-center justify-between gap-3 text-sm text-gray-700">
                          <span>Promotions</span>
                          <input
                            type="checkbox"
                            checked={notificationSettings.promosEnabled}
                            disabled={savingNotificationSettings || !notificationSettings.pushEnabled}
                            onChange={(event) => {
                              const nextSettings = { ...notificationSettings, promosEnabled: event.target.checked }
                              void persistNotificationSettings(nextSettings)
                            }}
                          />
                        </label>
                      </div>

                      <div className="mt-4 flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            void handleNativeNotificationEnable()
                          }}
                          className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                        >
                          Enable on this device
                        </button>
                        <span className="text-xs text-gray-500 self-center">For Android 13+, allow notification permission when prompted.</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {!settingPassword && (
            <button
              onClick={() => setSettingPassword(true)}
              className="text-sm text-blue-600 hover:text-blue-700 font-medium ml-8"
            >
              Change Password
            </button>
          )}

          {settingPassword && (
            <form onSubmit={handleUpdatePassword} className="space-y-4 mt-4 pt-4 border-t border-gray-200 ml-8">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  New Password
                </label>
                <input
                  type="password"
                  value={passwordData.newPassword}
                  onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="At least 8 characters"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Confirm Password
                </label>
                <input
                  type="password"
                  value={passwordData.confirmPassword}
                  onChange={(e) =>
                    setPasswordData({ ...passwordData, confirmPassword: e.target.value })
                  }
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Confirm new password"
                  required
                />
              </div>

              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm font-medium"
                >
                  Update Password
                </button>
                <button
                  type="button"
                  onClick={() => setSettingPassword(false)}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 text-sm font-medium"
                >
                  Cancel
                </button>
              </div>
            </form>
          )}
        </div>


        <div className="mb-6 pb-6 border-b border-gray-200">
          <div className="flex items-start gap-3">
            <Lock className="w-5 h-5 text-purple-600 mt-1" />
            <div>
              <p className="font-medium text-gray-900">Fingerprint / Face ID</p>
              <p className="text-sm text-gray-600">Use your device biometrics to approve transactions.</p>
              <button type="button" onClick={handleEnrollBiometrics} className="mt-3 text-sm font-medium text-blue-600 hover:text-blue-700">Set up biometrics</button>
            </div>
          </div>
        </div>

        

        {/* Telegram Section */}
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3">
            <div className="w-5 h-5 bg-blue-500 rounded text-white flex items-center justify-center text-xs font-bold mt-1">
              T
            </div>
            <div>
              <p className="font-medium text-gray-900">Telegram</p>
              {profile?.telegram_id ? (
                <>
                  <p className="text-sm text-gray-600">
                    @{profile.telegram_username || profile.telegram_id}
                  </p>
                  <div className="flex items-center gap-1 text-xs text-green-600 mt-1">
                    <CheckCircle2 className="w-4 h-4" />
                    Linked
                  </div>
                </>
              ) : (
                <p className="text-sm text-gray-600">Not linked</p>
              )}
            </div>
          </div>
          <div>
            {profile?.telegram_id ? (
              <button
                onClick={handleUnlinkTelegram}
                disabled={unlinkingTelegram}
                className="px-4 py-2 border border-red-300 text-red-600 rounded-lg hover:bg-red-50 disabled:opacity-50 flex items-center gap-2 text-sm font-medium"
              >
                <Unlink2 className="w-4 h-4" />
                Unlink
              </button>
            ) : (
              <div className="w-32">
                <TelegramButton label="Link Telegram" mode="link" />
              </div>
            )}
          </div>
        </div>
      </div>

      

      {/* Logout Button */}
      <button
        onClick={async () => {
          await supabase.auth.signOut()
          window.location.href = '/login'
        }}
        className="w-full bg-red-50 text-red-600 p-4 rounded-xl font-medium hover:bg-red-100 transition-colors flex items-center justify-center gap-2"
      >
        <LogOut className="h-5 w-5" />
        Log Out
      </button>
    </div>
  )
}
