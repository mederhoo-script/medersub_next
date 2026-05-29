'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

type PaymentSource = 'wallet' | 'reward';

export default function SpendingBalances({ paymentSource }: { paymentSource?: PaymentSource }) {
    const [walletBalance, setWalletBalance] = useState(0);
    const [rewardBalance, setRewardBalance] = useState(0);

    useEffect(() => {
        const fetchBalances = async () => {
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

            setWalletBalance(Number(wallet?.balance || 0));
            setRewardBalance(Number(profile?.reward_balance_ngn || 0));
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
            {paymentSource && (
                <p className="text-xs text-blue-600">
                    Paying from: {paymentSource === 'wallet' ? 'Main Wallet' : 'Reward Balance'}
                </p>
            )}
        </div>
    );
}
