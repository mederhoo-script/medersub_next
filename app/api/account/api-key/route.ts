import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { apiKeyPrefix, createApiKey, hashApiKey } from '@/lib/public-api';
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

async function createOrRotateApiKey(userId: string) {
    const apiKey = createApiKey();
    const { error } = await supabaseAdmin
        .from('profiles')
        .update({ api_key_hash: hashApiKey(apiKey), api_key_prefix: apiKeyPrefix(apiKey) })
        .eq('id', userId);

    if (error) return null;
    return apiKey;
}

/** Returns the visible key status and provisions a usable key for profiles that lack one. */
export async function GET() {
    const userId = await currentUserId();
    if (!userId) return NextResponse.json({ status: 'failed', message: 'Unauthorized' }, { status: 401 });

    const { data, error } = await supabaseAdmin
        .from('profiles')
        .select('api_key_hash, api_key_prefix')
        .eq('id', userId)
        .single();
    if (error || !data) return NextResponse.json({ status: 'failed', message: 'Unable to load API key' }, { status: 500 });

    if (data.api_key_hash) {
        return NextResponse.json({ status: 'success', data: { apiKey: null, apiKeyPrefix: data.api_key_prefix || 'Active API key' } });
    }

    const apiKey = await createOrRotateApiKey(userId);
    if (!apiKey) return NextResponse.json({ status: 'failed', message: 'Unable to create API key' }, { status: 500 });
    return NextResponse.json({ status: 'success', message: 'Your API key has been created. Save it now; it cannot be shown again.', data: { apiKey, apiKeyPrefix: apiKeyPrefix(apiKey) } });
}

/** Rotate the caller's public key. Display the new key once, then store it safely. */
export async function POST() {
    const userId = await currentUserId();
    if (!userId) return NextResponse.json({ status: 'failed', message: 'Unauthorized' }, { status: 401 });

    const apiKey = await createOrRotateApiKey(userId);
    if (!apiKey) return NextResponse.json({ status: 'failed', message: 'Unable to create API key' }, { status: 500 });
    return NextResponse.json({ status: 'success', message: 'API key rotated. Save it now; it cannot be shown again.', data: { apiKey, apiKeyPrefix: apiKeyPrefix(apiKey) } });
}
