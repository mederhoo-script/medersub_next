'use client';
import { useEffect, useState } from 'react';
import WalletCard from '@/components/dashboard/wallet-card';
import ServiceGrid from '@/components/dashboard/service-grid';
import { supabase } from '@/lib/supabase';
import { Bell, Smartphone, Wifi, Tv, Zap, GraduationCap, ArrowDownRight, AlertTriangle } from 'lucide-react';
import Link from 'next/link';

interface Transaction {
    id: string;
    type: string;
    amount: number;
    charged_amount: number;
    status: string;
    created_at: string;
    meta: {
        service_type?: string;
        mobile?: string;
        network?: string;
    };
}

interface ProfileData {
    full_name?: string;
    mainBalance: number;
    rewardBalance: number;
    virtualAccount?: {
        account_number: string;
        bank_name: string;
        account_name?: string;
    } | null;
}

export default function DashboardPage() {
    const [profile, setProfile] = useState<ProfileData | null>(null);
    const [loadingProfile, setLoadingProfile] = useState(true);
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [loadingTransactions, setLoadingTransactions] = useState(true);

    useEffect(() => {
        const fetchProfile = async () => {
            try {
                const { data: { user }, error: userError } = await supabase.auth.getUser();
                console.log('[Dashboard] User:', user?.email, 'Error:', userError);

                if (user) {
                    const { data, error: profileError } = await supabase
                        .from('profiles')
                        .select('*, wallets(balance), virtual_accounts(account_number,bank_name,account_name,status)')
                        .eq('id', user.id)
                        .single();

                    console.log('[Dashboard] Profile:', data, 'Error:', profileError);

                    if (data) {
                        const mainBalance = Number(data.wallets?.[0]?.balance || 0);
                        const rewardBalance = Number(data.reward_balance_ngn || 0);
                        const virtualAccount = data.virtual_accounts?.find((account: any) => account.status === 'active') || data.virtual_accounts?.[0] || null;
                        setProfile({ ...data, mainBalance, rewardBalance, virtualAccount });
                    }
                }
            } finally {
                setLoadingProfile(false);
            }
        };
        fetchProfile();
    }, []);

    useEffect(() => {
        const fetchTransactions = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            setLoadingTransactions(true);
            const { data, error } = await supabase
                .from('transactions')
                .select('*')
                .eq('user_id', user.id)
                .order('created_at', { ascending: false })
                .limit(5);

            if (data && !error) {
                setTransactions(data);
            }
            setLoadingTransactions(false);
        };

        fetchTransactions();
    }, []);

    const getServiceIcon = (serviceType?: string) => {
        switch (serviceType) {
            case 'AIRTIME': return <Smartphone className="h-4 w-4" />;
            case 'DATA': return <Wifi className="h-4 w-4" />;
            case 'CABLE': return <Tv className="h-4 w-4" />;
            case 'ELECTRICITY': return <Zap className="h-4 w-4" />;
            case 'EDUCATION': return <GraduationCap className="h-4 w-4" />;
            default: return <Smartphone className="h-4 w-4" />;
        }
    };

    const getServiceColor = (serviceType?: string) => {
        switch (serviceType) {
            case 'AIRTIME': return 'bg-green-100 text-green-600';
            case 'DATA': return 'bg-blue-100 text-blue-600';
            case 'CABLE': return 'bg-purple-100 text-purple-600';
            case 'ELECTRICITY': return 'bg-yellow-100 text-yellow-600';
            case 'EDUCATION': return 'bg-indigo-100 text-indigo-600';
            default: return 'bg-gray-100 text-gray-600';
        }
    };

    const formatServiceName = (transaction: Transaction) => {
        const serviceType = transaction.meta?.service_type || 'Service';
        const network = transaction.meta?.network;

        if (serviceType === 'AIRTIME' || serviceType === 'DATA') {
            return `${serviceType} ${network ? `- ${network}` : ''}`;
        }
        return serviceType;
    };

    const isRefundTransaction = (transaction: Transaction) => transaction.type === 'refund';
    const getDisplayTransactionAmount = (transaction: Transaction) => {
        const chargedAmount = Number(transaction.charged_amount ?? transaction.amount ?? 0);
        const amountValue = Number(transaction.amount ?? 0);
        const chargedAmountRaw = Number(transaction.charged_amount ?? NaN);

        if (!Number.isFinite(chargedAmountRaw) || chargedAmountRaw === 0) {
            return amountValue;
        }
        return chargedAmount;
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-xl font-bold text-gray-900">Hello, {profile?.full_name?.split(' ')[0] || 'User'} 👋</h1>
                    <p className="text-sm text-gray-500">What would you like to do today?</p>
                </div>
                <h1 className="text-2xl font-bold text-blue-600 tracking-tight">MEDERSUB</h1>
                <button className="p-2 rounded-full bg-white text-gray-600 border border-gray-200 hover:bg-gray-50 transition-colors relative">
                    <Bell className="h-5 w-5" />
                    <span className="absolute top-2 right-2 h-2 w-2 bg-red-500 rounded-full border border-white"></span>
                </button>
            </div>

            {/* Wallet Card */}
            <WalletCard
                mainBalance={profile?.mainBalance || 0}
                rewardBalance={profile?.rewardBalance || 0}
                virtualAccount={profile?.virtualAccount}
                loading={loadingProfile}
            />

            {/* Services */}
            <ServiceGrid />

             <div className="mb-4 flex gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
                <p>
                    Please, don&apos;t send Airtel Awoof and Gifting to any number owing Airtel. It will not deliver and you will not be refunded. Thank you for choosing MEDERSUB.
                </p>
            </div>

            {/* Recent Activity Mini List */}
            <div className="mt-10">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="font-semibold text-gray-900">Recent Transactions</h3>
                    <Link href="/dashboard/history" className="text-sm text-blue-600 hover:underline">See All</Link>
                </div>

                {loadingTransactions ? (
                    <div className="bg-white rounded-xl border border-gray-100 p-4 text-center text-gray-400 text-sm">
                        Loading transactions...
                    </div>
                ) : transactions.length === 0 ? (
                    <div className="bg-white rounded-xl border border-gray-100 p-4 text-center text-gray-400 text-sm">
                        No recent transactions
                    </div>
                ) : (
                    <div className="bg-white rounded-xl border border-gray-100 divide-y divide-gray-100">
                        {transactions.map((transaction) => {
                            const content = (
                                <div className="p-4 flex items-center justify-between hover:bg-gray-50 transition-colors">
                                    <div className="flex items-center gap-3">
                                        <div className={`p-2 rounded-lg ${isRefundTransaction(transaction) ? 'bg-green-100 text-green-600' : getServiceColor(transaction.meta?.service_type)}`}>
                                            {transaction.type === 'deposit' || isRefundTransaction(transaction) ? (
                                                <ArrowDownRight className="h-4 w-4" />
                                            ) : (
                                                getServiceIcon(transaction.meta?.service_type)
                                            )}
                                        </div>
                                        <div>
                                            <p className="text-sm font-medium text-gray-900">
                                                {transaction.type === 'deposit' ? 'Wallet Funding' : isRefundTransaction(transaction) ? 'Refund' : formatServiceName(transaction)}
                                            </p>
                                            <p className="text-xs text-gray-500">
                                                {new Date(transaction.created_at).toLocaleDateString('en-US', {
                                                    month: 'short',
                                                    day: 'numeric',
                                                    hour: '2-digit',
                                                    minute: '2-digit'
                                                })}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className={`text-sm font-semibold ${transaction.type === 'deposit' || isRefundTransaction(transaction) ? 'text-green-600' : 'text-red-600'
                                            }`}>
                                            {transaction.type === 'deposit' || isRefundTransaction(transaction) ? '+' : '-'}₦{getDisplayTransactionAmount(transaction).toLocaleString()}
                                        </p>
                                        <p className={`text-xs ${transaction.status === 'success' ? 'text-green-600' :
                                                transaction.status === 'failed' ? 'text-red-600' : 'text-yellow-600'
                                            }`}>
                                            {transaction.status}
                                        </p>
                                    </div>
                                </div>
                            );

                            return isRefundTransaction(transaction) ? (
                                <Link key={transaction.id} href={`/dashboard/history?txId=${transaction.id}`} className="block">
                                    {content}
                                </Link>
                            ) : (
                                <Link key={transaction.id} href={`/dashboard/history?txId=${transaction.id}`} className="block">
                                    {content}
                                </Link>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}
