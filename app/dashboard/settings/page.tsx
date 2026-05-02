'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import dynamic from 'next/dynamic'
import { Mail, Lock, Unlink2, CheckCircle2, AlertCircle, LogOut } from 'lucide-react'

const TelegramButton = dynamic(() => import('@/components/auth/telegram-button'), { ssr: false })

interface Profile {
  id: string
  full_name: string
  telegram_id: string | null
  telegram_username: string | null
  telegram_linked_at: string | null
  created_at: string
}

export default function SettingsPage() {
  const router = useRouter()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [editMode, setEditMode] = useState(false)
  const [settingPassword, setSettingPassword] = useState(false)
  const [unlinkingTelegram, setUnlinkingTelegram] = useState(false)

  const [formData, setFormData] = useState({
    email: '',
    fullName: '',
  })

  const [passwordData, setPasswordData] = useState({
    newPassword: '',
    confirmPassword: '',
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
          .select('*')
          .eq('id', user.id)
          .single()

        if (error) throw error
        setProfile(data)
        setFormData({
          email: user.email || '',
          fullName: data?.full_name || '',
        })
      } catch (err) {
        setMessage({ type: 'error', text: 'Failed to load profile' })
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [router])

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
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message })
    } finally {
      setUnlinkingTelegram(false)
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
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message })
    } finally {
      setLoading(false)
    }
  }

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          full_name: formData.fullName,
        })
        .eq('id', profile?.id)

      if (profileError) throw profileError

      if (formData.email !== user?.email) {
        const { error: emailError } = await supabase.auth.updateUser({
          email: formData.email,
        })
        if (emailError) throw emailError
      }

      setMessage({ type: 'success', text: 'Profile updated successfully' })
      setProfile((prev) => (prev ? { ...prev, full_name: formData.fullName } : null))
      setEditMode(false)
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message })
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
            <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
          ) : (
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
          )}
          <span>{message.text}</span>
        </div>
      )}

      {/* Login Methods */}
      <div className="bg-white rounded-xl border border-gray-100 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-6">Login Methods</h2>

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
                <TelegramButton label="Link Telegram" />
              </div>
            )}
          </div>
        </div>
      </div>

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

            <div className="flex gap-2 pt-4">
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
