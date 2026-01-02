import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function POST(req: Request) {
    try {
        const { transactionId, reason } = await req.json();

        if (!transactionId) {
            return NextResponse.json({ error: 'Transaction ID required' }, { status: 400 });
        }

        // 1. Fetch original transaction
        const { data: tx, error: txError } = await supabaseAdmin
            .from('transactions')
            .select('*')
            .eq('id', transactionId)
            .single();

        if (txError || !tx) {
            return NextResponse.json({ error: 'Transaction not found' }, { status: 404 });
        }

        if (tx.status === 'refunded') {
            return NextResponse.json({ error: 'Transaction already refunded' }, { status: 400 });
        }

        // 2. Credit the User's Wallet
        const { data: wallet, error: walletError } = await supabaseAdmin
            .from('wallets')
            .select('balance')
            .eq('user_id', tx.user_id)
            .single();

        if (walletError || !wallet) {
            return NextResponse.json({ error: 'User wallet not found' }, { status: 404 });
        }

        const refundAmount = Number(tx.amount);
        const newBalance = Number(wallet.balance) + refundAmount;

        const { error: updateError } = await supabaseAdmin
            .from('wallets')
            .update({ balance: newBalance })
            .eq('user_id', tx.user_id);

        if (updateError) {
            throw new Error('Failed to credit wallet');
        }

        // 3. Update original transaction status
        await supabaseAdmin
            .from('transactions')
            .update({ status: 'refunded', meta: { ...tx.meta, refund_reason: reason } })
            .eq('id', transactionId);

        // 4. Create a new "REFUND" transaction record for audit
        await supabaseAdmin.from('transactions').insert({
            user_id: tx.user_id,
            type: 'refund',
            amount: refundAmount,
            charged_amount: 0,
            status: 'success',
            reference: `REFUND-${Date.now()}`,
            meta: { original_tx_id: transactionId, reason: reason }
        });

        return NextResponse.json({ success: true, message: 'Refund processed successfully' });

    } catch (err: any) {
        console.error('Refund Error:', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
