import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function POST(req: Request) {
    try {
        const { userId, amount, type } = await req.json(); // type: 'CREDIT' or 'DEBIT'

        if (!userId || !amount) {
            return NextResponse.json({ error: 'Missing userId or amount' }, { status: 400 });
        }

        // Get current balance from WALLETS
        const { data: wallet, error: fetchError } = await supabaseAdmin
            .from('wallets')
            .select('balance')
            .eq('user_id', userId)
            .single();

        if (fetchError || !wallet) {
            return NextResponse.json({ error: 'User wallet not found' }, { status: 404 });
        }

        const newBalance = type === 'CREDIT'
            ? Number(wallet.balance) + Number(amount)
            : Number(wallet.balance) - Number(amount);

        // Update balance
        const { error: updateError } = await supabaseAdmin
            .from('wallets')
            .update({ balance: newBalance })
            .eq('user_id', userId);

        if (updateError) {
            return NextResponse.json({ error: 'Failed to update balance' }, { status: 500 });
        }

        // Record Transaction
        await supabaseAdmin.from('transactions').insert({
            user_id: userId,
            type: type === 'CREDIT' ? 'deposit' : 'debit',
            amount: Number(amount),
            charged_amount: Number(amount),
            status: 'success',
            reference: `MANUAL-${Date.now()}`,
            meta: { manual: true, admin_action: true }
        });

        return NextResponse.json({ success: true, newBalance });
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
