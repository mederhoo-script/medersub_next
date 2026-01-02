import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function GET() {
    try {
        console.log('Fetching transactions...');
        const { data: transactions, error } = await supabaseAdmin
            .from('transactions')
            .select('*, profiles(full_name, email)') // Join with profiles
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Transaction Fetch Error:', error);
            // Fallback: Fetch without join to at least show something if join fails
            const { data: rawTransactions, error: rawError } = await supabaseAdmin
                .from('transactions')
                .select('*')
                .order('created_at', { ascending: false });

            if (rawError) return NextResponse.json({ error: rawError.message }, { status: 500 });
            return NextResponse.json(rawTransactions);
        }

        return NextResponse.json(transactions);
    } catch (err: any) {
        console.error('Transaction Fetch Exception:', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
