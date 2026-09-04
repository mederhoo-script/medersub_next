import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { requireAdmin } from '@/lib/admin-auth';

export async function GET() {
    if (!await requireAdmin()) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const { data, error } = await supabaseAdmin.from('system_settings').select('*');
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const settingsMap = (data || []).reduce((acc: any, curr: any) => {
        acc[curr.key] = curr.value;
        return acc;
    }, {});

    if (settingsMap.payment_provider === undefined) {
        settingsMap.payment_provider = 'monnify';
    }

    return NextResponse.json(settingsMap);
}

export async function POST(req: Request) {
    try {
    if (!await requireAdmin()) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        const { key, value } = await req.json();
        const targetKey = key || 'general';
        const targetValue = value ?? { maintenance_mode: false, global_markup_percentage: 0 };

        const { error } = await supabaseAdmin
            .from('system_settings')
            .upsert({ key: targetKey, value: targetValue, updated_at: new Date().toISOString() }, { onConflict: 'key' });

        if (error) return NextResponse.json({ error: error.message }, { status: 500 });

        return NextResponse.json({ success: true, key: targetKey, value: targetValue });
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
