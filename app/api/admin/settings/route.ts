import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function GET() {
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
