import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function GET() {
    try {
        const { data: users, error } = await supabaseAdmin
            .from('profiles')
            .select('*, wallets(balance)')
            .order('created_at', { ascending: false });

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        const formattedUsers = users.map((user: any) => ({
            ...user,
            balance: user.wallets?.[0]?.balance || 0
        }));

        return NextResponse.json(formattedUsers);
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

export async function PUT(req: Request) {
    try {
        const { id, full_name, role, balance } = await req.json();

        if (!id) return NextResponse.json({ error: 'User ID required' }, { status: 400 });

        // Update Profile
        const { error: profileError } = await supabaseAdmin
            .from('profiles')
            .update({ full_name, role })
            .eq('id', id);

        if (profileError) return NextResponse.json({ error: profileError.message }, { status: 500 });

        // Update Wallet if balance is provided
        if (balance !== undefined && balance !== '') {
            // Check if wallet exists first, if not create it (safe guard)
            const { data: wallet } = await supabaseAdmin.from('wallets').select('id').eq('user_id', id).single();

            if (wallet) {
                const { error: walletError } = await supabaseAdmin
                    .from('wallets')
                    .update({ balance: Number(balance) })
                    .eq('user_id', id);
                if (walletError) console.error('Wallet update failed', walletError);
            } else {
                const { error: walletError } = await supabaseAdmin
                    .from('wallets')
                    .insert({ user_id: id, balance: Number(balance) });
                if (walletError) console.error('Wallet create failed', walletError);
            }
        }

        return NextResponse.json({ success: true });
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
