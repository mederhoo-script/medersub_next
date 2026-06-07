'use client'

import { useEffect, useState } from 'react'
import { Loader2, Check, X } from 'lucide-react'

type RewardStats = {
  users_with_reward_uid: number
  total_reward_outstanding_ngn: number
  total_ads_watched: number
  total_referral_earnings_ngn: number
  pending_withdrawals_count: number
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <p className="text-xs text-gray-500">{label}</p>
      <p className="text-xl font-bold">{value}</p>
    </div>
  )
}

export default function AdminRewardsPage() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<{
    stats: RewardStats
    users: any[]
    pending_withdrawals: any[]
    recent_transactions: any[]
  } | null>(null)

  const fetchData = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/rewards')
      const json = await res.json()
      if (!res.ok || !json.ok) throw new Error(json.error || 'Failed to load rewards data')
      setData(json)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load rewards data')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  const reviewWithdrawal = async (withdrawalId: number, status: 'approved' | 'rejected') => {
    setSaving(withdrawalId)
    try {
      const res = await fetch('/api/admin/rewards/withdrawals', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ withdrawalId, status }),
      })
      const json = await res.json()
      if (!res.ok || !json.ok) throw new Error(json.error || 'Failed to review withdrawal')
      await fetchData()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to review withdrawal')
    } finally {
      setSaving(null)
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-7 w-7 animate-spin text-blue-600" />
      </div>
    )
  }

  if (error) {
    return <div className="text-red-600 bg-red-50 border border-red-200 rounded-xl p-4">{error}</div>
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Rewards Dashboard</h1>

      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <StatCard label="Reward Users" value={data?.stats.users_with_reward_uid || 0} />
        <StatCard label="Outstanding" value={`₦${Number(data?.stats.total_reward_outstanding_ngn || 0).toLocaleString()}`} />
        <StatCard label="Ads Watched" value={data?.stats.total_ads_watched || 0} />
        <StatCard label="Referral Earnings" value={`₦${Number(data?.stats.total_referral_earnings_ngn || 0).toLocaleString()}`} />
        <StatCard label="Pending Withdrawals" value={data?.stats.pending_withdrawals_count || 0} />
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="p-4 border-b border-gray-100 font-semibold">Pending Withdrawals</div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-gray-500">
              <tr>
                <th className="text-left px-4 py-3">User</th>
                <th className="text-left px-4 py-3">UID</th>
                <th className="text-left px-4 py-3">Amount</th>
                <th className="text-left px-4 py-3">Account Details</th>
                <th className="text-left px-4 py-3">Date</th>
                <th className="text-right px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {(data?.pending_withdrawals || []).length === 0 ? (
                <tr><td className="px-4 py-4 text-gray-500" colSpan={6}>No pending withdrawals.</td></tr>
              ) : (
                (data?.pending_withdrawals || []).map((w: any) => (
                  <tr key={w.id}>
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900">{w.profiles?.full_name || 'Unknown'}</div>
                      <div className="text-xs text-gray-500">{w.profiles?.email || '—'}</div>
                    </td>
                    <td className="px-4 py-3 font-mono">{w.profiles?.reward_uid || '—'}</td>
                    <td className="px-4 py-3 font-semibold">
                      <div>₦{Number(w.amount_ngn || 0).toLocaleString()}</div>
                      <div className="text-xs text-gray-500">Earn: {Number(w.earn_amount || 0).toLocaleString()}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900">{w.bank_name || '—'}</div>
                      <div className="text-xs text-gray-500">{w.account_name || '—'}</div>
                      <div className="text-xs font-mono text-gray-500">{w.account_number || '—'}</div>
                    </td>
                    <td className="px-4 py-3">{new Date(w.created_at).toLocaleString()}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="inline-flex gap-2">
                        <button
                          disabled={saving === w.id}
                          onClick={() => reviewWithdrawal(w.id, 'approved')}
                          className="px-2 py-1 rounded bg-green-100 text-green-700 hover:bg-green-200 disabled:opacity-50"
                        >
                          <Check className="h-4 w-4" />
                        </button>
                        <button
                          disabled={saving === w.id}
                          onClick={() => reviewWithdrawal(w.id, 'rejected')}
                          className="px-2 py-1 rounded bg-red-100 text-red-700 hover:bg-red-200 disabled:opacity-50"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
