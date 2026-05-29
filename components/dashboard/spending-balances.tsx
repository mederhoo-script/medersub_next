'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

type PaymentSource = 'wallet' | 'reward';
type BalanceCache = {
    walletBalance: number;
    rewardBalance: number;
    fetchedAt?: number;
};

const BALANCE_CACHE_DURATION_SECONDS = 20;

const getCachedBalances = (): BalanceCache | null => {
    try {
        const cached = sessionStorage.getItem('dashboard_balances');
        return cached ? (JSON.parse(cached) as BalanceCache) : null;
    } catch {
        return null;
    }
};

const setCachedBalances = (value: BalanceCache) => {
    try {
        sessionStorage.setItem('dashboard_balances', JSON.stringify(value));
    } catch {
        // Ignore storage write errors
    }
};

const clearCachedBalances = () => {
    try {
        sessionStorage.removeItem('dashboard_balances');
    } catch {
        // Ignore storage cleanup errors
    }
};

export default function SpendingBalances({ paymentSource }: { paymentSource?: PaymentSource }) {
    const [walletBalance, setWalletBalance] = useState(0);
    const [rewardBalance, setRewardBalance] = useState(0);
    const [loadError, setLoadError] = useState('');

    useEffect(() => {
        const fetchBalances = async () => {
            try {
                const cached = getCachedBalances();
                if (cached) {
                    const fetchedAt = Number(cached.fetchedAt || 0);
                    if (Date.now() - fetchedAt < BALANCE_CACHE_DURATION_SECONDS * 1000) {
                        setWalletBalance(Number(cached.walletBalance || 0));
                        setRewardBalance(Number(cached.rewardBalance || 0));
                        return;
                    }
                    clearCachedBalances();
                }

                const { data: { user } } = await supabase.auth.getUser();
                if (!user) return;

                const [{ data: wallet }, { data: profile }] = await Promise.all([
                    supabase
                        .from('wallets')
                        .select('balance')
                        .eq('user_id', user.id)
                        .maybeSingle(),
                    supabase
                        .from('profiles')
                        .select('reward_balance_ngn')
                        .eq('id', user.id)
                        .maybeSingle()
                ]);

                const nextWalletBalance = Number(wallet?.balance || 0);
                const nextRewardBalance = Number(profile?.reward_balance_ngn || 0);

                setWalletBalance(nextWalletBalance);
                setRewardBalance(nextRewardBalance);
                setCachedBalances({
                    walletBalance: nextWalletBalance,
                    rewardBalance: nextRewardBalance,
                    fetchedAt: Date.now()
                });
            } catch (error) {
                console.error('Failed to fetch balances:', error);
                setLoadError('Unable to load balances right now.');
            }
        };

        fetchBalances();
    }, []);

    return (
        <div className="rounded-xl border border-gray-200 bg-gray-50 p-3 space-y-2">
            <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">Main Wallet</span>
                <span className="font-semibold text-gray-900">₦{walletBalance.toLocaleString()}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">Reward Balance</span>
                <span className="font-semibold text-gray-900">₦{rewardBalance.toLocaleString()}</span>
            </div>
            {loadError && <p className="text-xs text-red-600">{loadError}</p>}
            {paymentSource && (
                <p className="text-xs text-blue-600">
                    Paying from: {paymentSource === 'wallet' ? 'Main Wallet' : 'Reward Balance'}
                </p>
            )}
        </div>
    );
}
