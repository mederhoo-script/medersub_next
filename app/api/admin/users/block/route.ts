import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function POST(req: Request) {
    try {
        const { userId, action } = await req.json(); // action: 'BLOCK' or 'UNBLOCK'

        if (!userId || !action) {
            return NextResponse.json({ error: 'Missing userId or action' }, { status: 400 });
        }

        const isBlocked = action === 'BLOCK';

        const { error } = await supabaseAdmin
            .from('profiles')
            .update({ is_blocked: isBlocked })
            .eq('id', userId);

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json({ success: true, message: `User ${action === 'BLOCK' ? 'blocked' : 'unblocked'} successfully` });

    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
