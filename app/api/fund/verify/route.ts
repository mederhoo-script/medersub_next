import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function POST(req: Request) {
    try {
        const { transactionReference, amountPaid, userId, paymentStatus } = await req.json();

        console.log('[VERIFY] Processing Monnify payment for user:', userId);

        if (!transactionReference || !amountPaid || !userId) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        // Check payment status from Monnify SDK
        if (paymentStatus !== 'PAID' && paymentStatus !== 'OVERPAID') {
            return NextResponse.json({ error: 'Payment not successful', status: paymentStatus }, { status: 400 });
        }

        // 1. Check if transaction already processed
        const { data: existingTx } = await supabaseAdmin
            .from('transactions')
            .select('id')
            .eq('reference', transactionReference)
            .single();

        if (existingTx) {
            console.log('[VERIFY] Transaction already processed');
            return NextResponse.json({ error: 'Transaction already processed' }, { status: 400 });
        }

        // 2. Verify user exists
        const { data: userProfile } = await supabaseAdmin
            .from('profiles')
            .select('id')
            .eq('id', userId)
            .single();

        if (!userProfile) {
            console.error('[VERIFY] User not found with ID:', userId);
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        const fee = 50;
        const amountToCredit = Math.max(0, Number(amountPaid) - fee);

        // 3. Credit Wallet - Using robust query to find existing wallet
        const { data: wallet } = await supabaseAdmin
            .from('wallets')
            .select('balance')
            .eq('user_id', userId)
            .maybeSingle();

        const currentBalance = wallet?.balance ? Number(wallet.balance) : 0;
        const newBalance = currentBalance + amountToCredit;

        // Use upsert to prevent duplicates
        const { error: walletError } = await supabaseAdmin
            .from('wallets')
            .upsert({
                user_id: userId,
                balance: newBalance,
                updated_at: new Date().toISOString()
            }, { onConflict: 'user_id' });

        if (walletError) {
            console.error('[VERIFY] Wallet upsert failed:', walletError);
            // Fallback to update if upsert onConflict fails (in case constraint is missing)
            await supabaseAdmin.from('wallets').update({ balance: newBalance }).eq('user_id', userId);
        }

        // 3b. Also sync to profiles table for dashboard compatibility
        await supabaseAdmin.from('profiles').update({ balance: newBalance }).eq('id', userId);
        console.log('[VERIFY] Balance updated (Sync):', newBalance);

        // 4. Record Transaction
        await supabaseAdmin.from('transactions').insert({
            user_id: userId,
            type: 'deposit',
            amount: amountToCredit,
            charged_amount: Number(amountPaid),
            status: 'success',
            reference: transactionReference,
            meta: {
                provider: 'monnify',
                payment_status: paymentStatus,
                fee_deducted: fee
            }
        });

        console.log('[VERIFY] Transaction recorded successfully');
        return NextResponse.json({ success: true, newBalance });

    } catch (err: any) {
        console.error('[VERIFY] Error:', err.message, err.stack);
        return NextResponse.json({ error: err.message || 'Verification failed' }, { status: 500 });
    }
}
