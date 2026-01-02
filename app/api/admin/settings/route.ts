import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function GET() {
    // Return key-value map of settings
    const { data, error } = await supabaseAdmin.from('system_settings').select('*');
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // Convert array to object: { "general": { ... } }
    const settingsMap = data.reduce((acc: any, curr: any) => {
        acc[curr.key] = curr.value;
        return acc;
    }, {});

    return NextResponse.json(settingsMap);
}

export async function POST(req: Request) {
    try {
        const { key, value } = await req.json();

        const { error } = await supabaseAdmin
            .from('system_settings')
            .upsert({ key, value, updated_at: new Date() });

        if (error) return NextResponse.json({ error: error.message }, { status: 500 });

        return NextResponse.json({ success: true });
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
