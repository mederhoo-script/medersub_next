import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { requireAdmin } from '@/lib/admin-auth';

export async function GET() {
    try {
        if (!await requireAdmin()) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        const { data: users, error } = await supabaseAdmin
            .from('profiles')
            .select('*, wallets(balance), reward_balance_ngn')
            .order('created_at', { ascending: false });

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        const formattedUsers = users.map((user: any) => ({
            ...user,
            balance: user.wallets?.[0]?.balance || 0,
            rewardBalance: Number(user.reward_balance_ngn || 0)
        }));

        return NextResponse.json(formattedUsers);
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

export async function PUT(req: Request) {
    try {
        if (!await requireAdmin()) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        const { id, email, full_name, phone, bvn, nin, role, telegram_id, telegram_username, balance } = await req.json();

        if (!id) return NextResponse.json({ error: 'User ID required' }, { status: 400 });

        // Update Profile
        if (bvn && (!/^\d{11}$/.test(String(bvn)) || String(bvn).length !== 11)) {
            return NextResponse.json({ error: 'BVN must be 11 digits.' }, { status: 400 });
        }

        const { error: profileError } = await supabaseAdmin
            .from('profiles')
            .update({
                email: email || null,
                full_name: full_name || null,
                phone: phone || null,
                bvn: bvn || null,
                nin: nin || null,
                role: role || 'USER',
                telegram_id: telegram_id || null,
                telegram_username: telegram_username || null,
            })
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

export async function DELETE(req: Request) {
    try {
        if (!await requireAdmin()) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        const { id } = await req.json();

        if (!id) return NextResponse.json({ error: 'User ID required' }, { status: 400 });

        // Delete from Supabase Auth (profiles/wallets cascade via DB foreign keys)
        const { error } = await supabaseAdmin.auth.admin.deleteUser(id);

        if (error) return NextResponse.json({ error: error.message }, { status: 500 });

        return NextResponse.json({ success: true });
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
