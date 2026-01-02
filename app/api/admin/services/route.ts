import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function GET() {
    try {
        const { data: services, error } = await supabaseAdmin
            .from('services')
            .select('*')
            .order('type', { ascending: true })
            .order('name', { ascending: true });

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json(services);
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

export async function POST(req: Request) {
    try {
        const { id, is_active, markup } = await req.json();

        if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 });

        // Build update object dynamically
        const updateData: any = {};
        if (is_active !== undefined) updateData.is_active = is_active;
        if (markup !== undefined) updateData.markup = markup;

        const { error } = await supabaseAdmin
            .from('services')
            .update(updateData)
            .eq('id', id);

        if (error) return NextResponse.json({ error: error.message }, { status: 500 });

        return NextResponse.json({ success: true });
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
