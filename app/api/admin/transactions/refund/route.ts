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

        const status = String(tx.status || '').toLowerCase();
        const type = String(tx.type || '').toLowerCase();
        if (type === 'refund') {
            return NextResponse.json({ error: 'Cannot refund a refund transaction' }, { status: 400 });
        }
        if (type === 'deposit') {
            return NextResponse.json({ error: 'Cannot refund a deposit transaction' }, { status: 400 });
        }

        if (!['success', 'failed'].includes(status)) {
            return NextResponse.json({ error: 'Transaction not eligible for refund' }, { status: 400 });
        }

        const { data: existingRefunds, error: existingRefundError } = await supabaseAdmin
            .from('transactions')
            .select('id')
            .eq('type', 'refund')
            .filter('meta->>original_tx_id', 'eq', transactionId)
            .limit(1);

        if (existingRefundError) {
            console.error('Refund lookup error:', existingRefundError);
            return NextResponse.json({ error: 'Unable to validate refund eligibility' }, { status: 500 });
        }

        if (Array.isArray(existingRefunds) && existingRefunds.length > 0) {
            return NextResponse.json({ error: 'Transaction already refunded' }, { status: 400 });
        }

        // 2. Mark the original transaction as refunded via metadata only.
        const updatedMeta = { ...(tx.meta ?? {}), refund_reason: reason, refunded: true };
        const { data: updatedTx, error: updateTxError } = await supabaseAdmin
            .from('transactions')
            .update({ meta: updatedMeta })
            .eq('id', transactionId)
            .neq('type', 'refund')
            .neq('type', 'deposit')
            .select()
            .single();

        if (updateTxError || !updatedTx) {
            return NextResponse.json({ error: 'Transaction already refunded or not eligible for refund' }, { status: 400 });
        }

        // 3. Credit the User's Wallet
        const { data: wallet, error: walletError } = await supabaseAdmin
            .from('wallets')
            .select('balance')
            .eq('user_id', tx.user_id)
            .single();

        if (walletError || !wallet) {
            return NextResponse.json({ error: 'User wallet not found' }, { status: 404 });
        }

        const refundAmount = Number(updatedTx.charged_amount ?? updatedTx.amount);
        const newBalance = Number(wallet.balance) + refundAmount;

        const { error: updateError } = await supabaseAdmin
            .from('wallets')
            .update({ balance: newBalance })
            .eq('user_id', tx.user_id);

        if (updateError) {
            throw new Error('Failed to credit wallet');
        }

        // 4. Create a new "REFUND" transaction record for audit
        await supabaseAdmin.from('transactions').insert({
            user_id: tx.user_id,
            type: 'refund',
            amount: refundAmount,
            charged_amount: refundAmount,
            status: 'success',
            reference: `REFUND-${Date.now()}`,
            meta: {
                original_tx_id: transactionId,
                original_reference: tx.reference,
                original_inlomax_reference: tx.meta?.provider_ref || tx.meta?.inlomax_id || tx.reference,
                original_provider_reference: tx.meta?.provider_ref,
                original_status: tx.status,
                reason: reason
            }
        });

        return NextResponse.json({ success: true, message: 'Refund processed successfully' });

    } catch (err: any) {
        console.error('Refund Error:', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

export async function DELETE(req: Request) {
    try {
        const { transactionId, reason } = await req.json();

        if (!transactionId) {
            return NextResponse.json({ error: 'Refund transaction ID required' }, { status: 400 });
        }

        const { data: refundTx, error: refundError } = await supabaseAdmin
            .from('transactions')
            .select('*')
            .eq('id', transactionId)
            .single();

        if (refundError || !refundTx) {
            return NextResponse.json({ error: 'Refund transaction not found' }, { status: 404 });
        }

        if (refundTx.type !== 'refund') {
            return NextResponse.json({ error: 'Transaction is not a refund' }, { status: 400 });
        }

        const originalTxId = refundTx.meta?.original_tx_id;
        if (!originalTxId) {
            return NextResponse.json({ error: 'Original transaction reference is missing' }, { status: 400 });
        }

        const { data: originalTx, error: originalError } = await supabaseAdmin
            .from('transactions')
            .select('*')
            .eq('id', originalTxId)
            .single();

        if (originalError || !originalTx) {
            return NextResponse.json({ error: 'Original transaction not found' }, { status: 404 });
        }

        const { data: wallet, error: walletError } = await supabaseAdmin
            .from('wallets')
            .select('balance')
            .eq('user_id', refundTx.user_id)
            .single();

        if (walletError || !wallet) {
            return NextResponse.json({ error: 'User wallet not found' }, { status: 404 });
        }

        const refundAmount = Number(refundTx.charged_amount ?? refundTx.amount);
        const currentBalance = Number(wallet.balance);
        if (currentBalance < refundAmount) {
            return NextResponse.json({ error: 'Insufficient wallet balance to reverse refund' }, { status: 400 });
        }

        const { error: balanceError } = await supabaseAdmin
            .from('wallets')
            .update({ balance: currentBalance - refundAmount })
            .eq('user_id', refundTx.user_id);

        if (balanceError) {
            throw new Error('Failed to debit wallet');
        }

        const restoredStatus = refundTx.meta?.original_status || originalTx.status;
        const restoredMeta = { ...(originalTx.meta ?? {}) };
        delete restoredMeta.refund_reason;
        delete restoredMeta.refunded;

        await supabaseAdmin
            .from('transactions')
            .update({ status: restoredStatus, meta: restoredMeta })
            .eq('id', originalTxId);

        const { error: deleteError } = await supabaseAdmin
            .from('transactions')
            .delete()
            .eq('id', transactionId);

        if (deleteError) {
            throw new Error('Failed to delete refund transaction');
        }

        return NextResponse.json({ success: true, message: 'Refund deleted and amount charged back' });
    } catch (err: any) {
        console.error('Delete Refund Error:', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
