import { inlomax } from '@/lib/inlomax';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { CreditCard, Users, Activity, ExternalLink, Plus, RefreshCw, AlertTriangle } from 'lucide-react';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default async function AdminDashboardPage() {
    // 1. Fetch Data in Parallel
    const [inlomaxData, userStats, walletStats, recentTx] = await Promise.all([
        inlomax.getBalance(),
        supabaseAdmin.from('profiles').select('*', { count: 'exact', head: true }),
        supabaseAdmin.from('wallets').select('balance'),
        supabaseAdmin.from('transactions').select('*, profiles(email)').order('created_at', { ascending: false }).limit(5)
    ]);

    const providerBalance = inlomaxData?.data?.funds || 0;
    const userCount = userStats.count || 0;
    const totalUserWallet = walletStats.data?.reduce((acc, curr) => acc + (Number(curr.balance) || 0), 0) || 0;
    const transactions = recentTx.data || [];

    // Low Balance Warning
    const lowBalance = providerBalance < 5000;

    return (
        <div className="space-y-8">
            <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4">
                <h1 className="text-xl md:text-2xl font-bold text-gray-900">Admin Dashboard</h1>
                <div className="flex gap-2">
                    <Link href="/admin/users/fund" className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition w-fit">
                        <Plus className="h-4 w-4 mr-2" /> Fund User
                    </Link>
                </div>
            </div>

            {lowBalance && (
                <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-r-lg flex items-center">
                    <AlertTriangle className="h-5 w-5 text-red-500 mr-3" />
                    <p className="text-red-700 font-medium">Low Provider Balance! Please top up your Inlomax account to prevent service failures.</p>
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Cards */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                    <div className="flex justify-between items-start">
                        <div>
                            <p className="text-sm font-medium text-gray-500">Provider Balance</p>
                            <h3 className="text-3xl font-bold text-gray-900 mt-2">
                                ₦{Number(providerBalance).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                            </h3>
                        </div>
                        <div className="p-3 bg-blue-50 rounded-lg text-blue-600">
                            <Activity className="h-6 w-6" />
                        </div>
                    </div>
                    <div className="mt-4 text-xs text-gray-400 flex items-center">
                        <span className="w-2 h-2 bg-green-500 rounded-full mr-2"></span>
                        Connected to Inlomax
                    </div>
                </div>

                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                    <div className="flex justify-between items-start">
                        <div>
                            <p className="text-sm font-medium text-gray-500">User Wallet Assets</p>
                            <h3 className="text-3xl font-bold text-gray-900 mt-2">
                                ₦{totalUserWallet.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                            </h3>
                        </div>
                        <div className="p-3 bg-green-50 rounded-lg text-green-600">
                            <CreditCard className="h-6 w-6" />
                        </div>
                    </div>
                </div>

                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                    <div className="flex justify-between items-start">
                        <div>
                            <p className="text-sm font-medium text-gray-500">Total Users</p>
                            <h3 className="text-3xl font-bold text-gray-900 mt-2">{userCount}</h3>
                        </div>
                        <div className="p-3 bg-purple-50 rounded-lg text-purple-600">
                            <Users className="h-6 w-6" />
                        </div>
                    </div>
                </div>
            </div>

            {/* Recent Activity Section */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                    <div className="p-5 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                        <h3 className="font-semibold text-gray-900">Recent Transactions</h3>
                        <Link href="/admin/transactions" className="text-sm text-blue-600 hover:underline flex items-center">
                            View All <ExternalLink className="h-3 w-3 ml-1" />
                        </Link>
                    </div>
                    <div className="divide-y divide-gray-100">
                        {transactions.length === 0 ? (
                            <div className="p-6 text-center text-gray-400 text-sm">No recent transactions.</div>
                        ) : (
                            transactions.map((tx: any) => (
                                <div key={tx.id} className="p-4 flex justify-between items-center hover:bg-gray-50 transition">
                                    <div className="flex items-center gap-3">
                                        <div className={`h-8 w-8 rounded-full flex items-center justify-center ${tx.status === 'success' ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>
                                            {tx.status === 'success' ? <RefreshCw className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
                                        </div>
                                        <div>
                                            <p className="text-sm font-medium text-gray-900">{tx.type.toUpperCase()}</p>
                                            <p className="text-xs text-gray-500">{tx.profiles?.email || 'Unknown User'}</p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-sm font-bold text-gray-900">₦{Number(tx.amount).toLocaleString()}</p>
                                        <p className="text-xs text-gray-400">{new Date(tx.created_at).toLocaleTimeString()}</p>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {/* Quick Actions / System Health */}
                <div className="space-y-6">
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                        <h3 className="font-semibold text-gray-900 mb-4">Quick Actions</h3>
                        <div className="grid grid-cols-2 gap-4">
                            <Link href="/admin/services" className="p-4 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 transition text-center text-sm font-medium">
                                Manage Services
                            </Link>
                            <Link href="/admin/users" className="p-4 rounded-lg bg-purple-50 text-purple-700 hover:bg-purple-100 transition text-center text-sm font-medium">
                                View Users
                            </Link>
                            <Link href="/admin/settings" className="p-4 rounded-lg bg-gray-50 text-gray-700 hover:bg-gray-100 transition text-center text-sm font-medium">
                                Pricing Settings
                            </Link>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
