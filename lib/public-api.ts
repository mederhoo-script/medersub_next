import { createHash, randomBytes } from 'crypto';
import { supabaseAdmin } from '@/lib/supabase-admin';

export type ApiPayload = Record<string, unknown>;

export function hashApiKey(apiKey: string) {
    return createHash('sha256').update(apiKey).digest('hex');
}

export function createApiKey() {
    return `ms_live_${randomBytes(24).toString('base64url')}`;
}

export function apiKeyPrefix(apiKey: string) {
    return `${apiKey.slice(0, 16)}…${apiKey.slice(-4)}`;
}

export async function authenticatePublicApi(request: Request) {
    const authorization = request.headers.get('authorization');
    const match = authorization?.match(/^Token\s+(.+)$/i);
    const apiKey = match?.[1]?.trim();
    if (!apiKey || !apiKey.startsWith('ms_live_')) return null;

    const { data, error } = await supabaseAdmin
        .from('profiles')
        .select('id, is_blocked')
        .eq('api_key_hash', hashApiKey(apiKey))
        .maybeSingle();

    if (error || !data || data.is_blocked) return null;
    return data.id as string;
}

export function providerStatus(response: unknown) {
    const status = typeof response === 'object' && response !== null && 'status' in response
        ? (response as { status?: unknown }).status
        : undefined;
    return status === 'success' ? 200 : 400;
}

export function generatedRequestId() {
    return `ms_${randomBytes(16).toString('hex')}`;
}

export function requireString(body: ApiPayload, name: string) {
    const value = body[name];
    return typeof value === 'string' && value.trim() ? value.trim() : null;
}

export function requirePositiveNumber(body: ApiPayload, name: string) {
    const value = Number(body[name]);
    return Number.isFinite(value) && value > 0 ? value : null;
}

type GeneralSettings = {
    public_api_markup_percentage?: number | string;
    global_markup_percentage?: number | string;
    markup?: number | string;
};

export async function publicApiMarkupPercentage() {
    const { data } = await supabaseAdmin.from('system_settings').select('value').eq('key', 'general').maybeSingle();
    const settings = (data?.value || {}) as GeneralSettings;
    const markup = Number(settings.public_api_markup_percentage ?? settings.global_markup_percentage ?? settings.markup ?? 0);
    return Number.isFinite(markup) && markup >= 0 ? markup : 0;
}

function markedAmount(value: unknown, markup: number) {
    const amount = Number(String(value).replace(/,/g, ''));
    if (!Number.isFinite(amount)) return value;
    return Number((amount * (1 + markup / 100)).toFixed(2));
}

/** Replace every provider service amount with its public selling price without changing IDs or service shape. */
export function applyServiceMarkup(response: unknown, markup: number) {
    const replaceAmounts = (value: unknown): unknown => {
        if (Array.isArray(value)) return value.map(replaceAmounts);
        if (!value || typeof value !== 'object') return value;

        const plan = value as ApiPayload;
        return Object.fromEntries(Object.entries(plan).map(([key, child]) => [
            key,
            key === 'amount' ? markedAmount(child, markup) : replaceAmounts(child),
        ]));
    };

    return replaceAmounts(response);
}
