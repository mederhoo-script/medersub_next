import { createHash, randomBytes } from 'crypto';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { calculateDataProfit, educationProfitPerPin, type PricingSettings } from '@/utils/pricing';

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
    // Support the documented Token scheme as well as the conventional Bearer
    // and x-api-key forms used by API clients. This avoids rejecting valid
    // user keys simply because a client library chooses a different header.
    const match = authorization?.match(/^(?:Token|Bearer)\s+(.+)$/i);
    const apiKey = (match?.[1] || request.headers.get('x-api-key') || request.headers.get('api-key'))?.trim();
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

type GeneralSettings = PricingSettings & {
    public_api_data_profit_up_to_1gb?: number | string;
    public_api_data_profit_up_to_3gb?: number | string;
    public_api_data_profit_up_to_5gb?: number | string;
    public_api_data_profit_up_to_10gb?: number | string;
    public_api_data_profit_over_10gb?: number | string;
    public_api_education_profit_per_pin?: number | string;
};

/** Returns the independent, fixed-profit configuration for public API plans. */
export async function publicApiPricing(): Promise<PricingSettings> {
    const { data } = await supabaseAdmin.from('system_settings').select('value').eq('key', 'general').maybeSingle();
    const settings = (data?.value || {}) as GeneralSettings;
    return {
        data_profit_up_to_1gb: settings.public_api_data_profit_up_to_1gb ?? 10,
        data_profit_up_to_3gb: settings.public_api_data_profit_up_to_3gb ?? 20,
        data_profit_up_to_5gb: settings.public_api_data_profit_up_to_5gb ?? 30,
        data_profit_up_to_10gb: settings.public_api_data_profit_up_to_10gb ?? 50,
        data_profit_over_10gb: settings.public_api_data_profit_over_10gb ?? 100,
        education_profit_per_pin: settings.public_api_education_profit_per_pin ?? 20,
    };
}

function markedAmount(value: unknown, profit: number) {
    const amount = Number(String(value).replace(/,/g, ''));
    if (!Number.isFinite(amount)) return value;
    return Number((amount + profit).toFixed(2));
}

/** Apply the admin's plan-tier and education profits to the public service catalogue. */
export function applyServiceMarkup(response: unknown, pricing: PricingSettings) {
    if (!response || typeof response !== 'object') return response;
    const clone = structuredClone(response) as { data?: Record<string, unknown> };
    const data = clone.data;
    if (!data || typeof data !== 'object') return clone;

    if (Array.isArray(data.dataPlans)) {
        data.dataPlans = data.dataPlans.map((plan) => {
            if (!plan || typeof plan !== 'object') return plan;
            const item = plan as ApiPayload;
            return 'amount' in item
                ? { ...item, amount: markedAmount(item.amount, calculateDataProfit(String(item.dataPlan || ''), pricing)) }
                : item;
        });
    }

    if (Array.isArray(data.education)) {
        data.education = data.education.map((plan) => {
            if (!plan || typeof plan !== 'object') return plan;
            const item = plan as ApiPayload;
            return 'amount' in item
                ? { ...item, amount: markedAmount(item.amount, educationProfitPerPin(pricing)) }
                : item;
        });
    }

    return clone;
}
