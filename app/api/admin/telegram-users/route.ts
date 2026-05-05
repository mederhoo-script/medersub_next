import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

async function checkTelegramIdConflict(telegram_id: string, exclude_user_id: string) {
    const { data: existing } = await supabaseAdmin
        .from('profiles')
        .select('id, email')
        .eq('telegram_id', telegram_id)
        .maybeSingle();

    if (existing && existing.id !== exclude_user_id) {
        return existing.email as string;
    }
    return null;
}

// GET - list all profiles that have a telegram_id linked
export async function GET() {
    try {
        const { data, error } = await supabaseAdmin
            .from('profiles')
            .select('id, email, full_name, role, telegram_id, telegram_username, telegram_linked_at, created_at')
            .not('telegram_id', 'is', null)
            .order('telegram_linked_at', { ascending: false });

        if (error) return NextResponse.json({ error: error.message }, { status: 500 });

        return NextResponse.json(data);
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

// POST - manually link a telegram account to a user profile
export async function POST(req: Request) {
    try {
        const { user_id, telegram_id, telegram_username } = await req.json();

        if (!user_id || !telegram_id) {
            return NextResponse.json({ error: 'user_id and telegram_id are required' }, { status: 400 });
        }

        // Check if the telegram_id is already linked to another user
        const conflictEmail = await checkTelegramIdConflict(telegram_id, user_id);
        if (conflictEmail) {
            return NextResponse.json(
                { error: `Telegram ID is already linked to user: ${conflictEmail}` },
                { status: 409 }
            );
        }

        const { error } = await supabaseAdmin
            .from('profiles')
            .update({
                telegram_id,
                telegram_username: telegram_username || null,
                telegram_linked_at: new Date().toISOString(),
            })
            .eq('id', user_id);

        if (error) return NextResponse.json({ error: error.message }, { status: 500 });

        return NextResponse.json({ success: true });
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

// PUT - update telegram fields for a linked user
export async function PUT(req: Request) {
    try {
        const { user_id, telegram_id, telegram_username } = await req.json();

        if (!user_id || !telegram_id) {
            return NextResponse.json({ error: 'user_id and telegram_id are required' }, { status: 400 });
        }

        // Check if the new telegram_id is already linked to a different user
        const conflictEmail = await checkTelegramIdConflict(telegram_id, user_id);
        if (conflictEmail) {
            return NextResponse.json(
                { error: `Telegram ID is already linked to user: ${conflictEmail}` },
                { status: 409 }
            );
        }

        const { error } = await supabaseAdmin
            .from('profiles')
            .update({
                telegram_id,
                telegram_username: telegram_username || null,
            })
            .eq('id', user_id);

        if (error) return NextResponse.json({ error: error.message }, { status: 500 });

        return NextResponse.json({ success: true });
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

// DELETE - unlink telegram from a user profile
export async function DELETE(req: Request) {
    try {
        const { user_id } = await req.json();

        if (!user_id) {
            return NextResponse.json({ error: 'user_id is required' }, { status: 400 });
        }

        const { error } = await supabaseAdmin
            .from('profiles')
            .update({
                telegram_id: null,
                telegram_username: null,
                telegram_linked_at: null,
            })
            .eq('id', user_id);

        if (error) return NextResponse.json({ error: error.message }, { status: 500 });

        return NextResponse.json({ success: true });
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
