import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { createApiKey, hashApiKey } from '@/lib/public-api';
import { supabaseAdmin } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';

async function currentUserId() {
    const cookieStore = await cookies();
    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                getAll: () => cookieStore.getAll(),
                setAll: (values) => values.forEach(({ name, value, options }) => cookieStore.set(name, value, options)),
            },
        },
    );
    const { data: { user } } = await supabase.auth.getUser();
    return user?.id || null;
}

/** Rotate the caller's public key. Display the returned key once, then store it safely. */
export async function POST() {
    const userId = await currentUserId();
    if (!userId) return NextResponse.json({ status: 'failed', message: 'Unauthorized' }, { status: 401 });

    const apiKey = createApiKey();
    const { error } = await supabaseAdmin
        .from('profiles')
        .update({ api_key_hash: hashApiKey(apiKey) })
        .eq('id', userId);

    if (error) return NextResponse.json({ status: 'failed', message: 'Unable to create API key' }, { status: 500 });
    return NextResponse.json({ status: 'success', message: 'API key created. Save it now; it cannot be shown again.', data: { apiKey } });
}
