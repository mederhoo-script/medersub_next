'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

export type PaymentSource = 'wallet' | 'reward';

export function useDefaultPaymentSource() {
    const [paymentSource, setPaymentSource] = useState<PaymentSource>('wallet');

    useEffect(() => {
        let active = true;

        const resolveDefaultPaymentSource = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user || !active) return;

            const { data: profile, error } = await supabase
                .from('profiles')
                .select('telegram_id')
                .eq('id', user.id)
                .maybeSingle();
            if (error) {
                console.warn(
                    `Unable to determine Telegram-linked profile while resolving default payment source. Defaulting to wallet source. ${error.message}`
                );
            }

            if (!active) return;
            setPaymentSource(profile?.telegram_id ? 'reward' : 'wallet');
        };

        resolveDefaultPaymentSource();

        return () => {
            active = false;
        };
    }, []);

    return { paymentSource, setPaymentSource };
}
