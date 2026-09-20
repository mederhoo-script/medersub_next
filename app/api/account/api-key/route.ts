import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { apiKeyPrefix, createApiKey, decryptApiKey, encryptApiKey, hashApiKey } from '@/lib/public-api';

export const dynamic = 'force-dynamic';

async function currentUser() {
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
    return { userId: user?.id || null, supabase };
}

async function createOrRotateApiKey(userId: string, supabase: Awaited<ReturnType<typeof currentUser>>['supabase']) {
    const apiKey = createApiKey();
    const { data, error } = await supabase
        .from('profiles')
        .update({ api_key_hash: hashApiKey(apiKey), api_key_encrypted: encryptApiKey(apiKey), api_key_prefix: apiKeyPrefix(apiKey) })
        .eq('id', userId)
        .select('id')
        .maybeSingle();

    if (error || !data) return null;
    return apiKey;
}

/** Returns the visible key status and provisions a usable key for profiles that lack one. */
export async function GET() {
    const { userId, supabase } = await currentUser();
    if (!userId) return NextResponse.json({ status: 'failed', message: 'Unauthorized' }, { status: 401 });

    const { data, error } = await supabase
        .from('profiles')
        .select('api_key_hash, api_key_encrypted, api_key_prefix')
        .eq('id', userId)
        .single();
    if (error || !data) {
        console.error('Unable to load API key profile columns:', error);
        return NextResponse.json({ status: 'failed', message: 'Unable to load API key' }, { status: 500 });
    }

    if (data.api_key_encrypted) {
        try {
            const apiKey = decryptApiKey(data.api_key_encrypted);
            return NextResponse.json({ status: 'success', data: { apiKey, apiKeyPrefix: apiKeyPrefix(apiKey) } });
        } catch (decryptError) {
            console.error('Unable to decrypt API key:', decryptError);
            return NextResponse.json({ status: 'failed', message: 'Unable to load API key' }, { status: 500 });
        }
    }

    const apiKey = await createOrRotateApiKey(userId, supabase);
    if (!apiKey) return NextResponse.json({ status: 'failed', message: 'Unable to create API key' }, { status: 500 });
    return NextResponse.json({ status: 'success', message: 'Your API key is ready.', data: { apiKey, apiKeyPrefix: apiKeyPrefix(apiKey) } });
}

/** Rotate the caller's public key. Display the new key once, then store it safely. */
export async function POST() {
    const { userId, supabase } = await currentUser();
    if (!userId) return NextResponse.json({ status: 'failed', message: 'Unauthorized' }, { status: 401 });

    const apiKey = await createOrRotateApiKey(userId, supabase);
    if (!apiKey) return NextResponse.json({ status: 'failed', message: 'Unable to create API key' }, { status: 500 });
    return NextResponse.json({ status: 'success', message: 'API key rotated. Save it now; it cannot be shown again.', data: { apiKey, apiKeyPrefix: apiKeyPrefix(apiKey) } });
}
