import { randomBytes } from 'crypto';
import { inlomax } from '@/lib/inlomax';
import { supabaseAdmin } from '@/lib/supabase-admin';

export type VtuServiceType = 'AIRTIME' | 'DATA' | 'CABLE' | 'ELECTRICITY' | 'EDUCATION';

export type VtuProviderConfig = {
    globalProvider: string;
    enabledProviders: string[];
    routes: Record<string, Record<string, string>>;
};

type PurchaseInput = {
    serviceType: VtuServiceType;
    network?: string;
    serviceID: string;
    providerServiceID?: string;
    mobileNumber: string;
    amount?: number;
    meterType?: number;
    quantity?: number;
    requestId?: string;
    portedNumber?: boolean;
};

const DEFAULT_CONFIG: VtuProviderConfig = {
    globalProvider: 'inlomax',
    enabledProviders: ['inlomax'],
    routes: {},
};

export function generatedVtuReference(serviceType: string) {
    return `MS-${serviceType}-${Date.now()}-${randomBytes(4).toString('hex')}`;
}

export function normalizeVtuProviderConfig(value: unknown): VtuProviderConfig {
    if (!value || typeof value !== 'object') return DEFAULT_CONFIG;
    const input = value as Partial<VtuProviderConfig>;
    const enabledProviders: string[] = ['inlomax'];
    if (Array.isArray(input.enabledProviders)) {
        for (const provider of input.enabledProviders) {
            if ((provider === 'inlomax' || provider === 'smeapi') && !enabledProviders.includes(provider)) enabledProviders.push(provider);
        }
    }
    const globalProvider = String(input.globalProvider || '').toLowerCase() === 'smeapi' && enabledProviders.includes('smeapi') ? 'smeapi' : 'inlomax';
    const routes: Record<string, Record<string, string>> = {};
    if (input.routes && typeof input.routes === 'object') {
        for (const serviceType of ['AIRTIME', 'DATA', 'CABLE', 'ELECTRICITY', 'EDUCATION'] as VtuServiceType[]) {
            const serviceRoutes = (input.routes as Record<string, unknown>)[serviceType];
            if (!serviceRoutes || typeof serviceRoutes !== 'object') continue;
            routes[serviceType] = {};
            for (const [network, provider] of Object.entries(serviceRoutes)) {
                if (typeof provider === 'string' && enabledProviders.includes(provider.toLowerCase())) {
                    routes[serviceType][network.toUpperCase()] = provider.toLowerCase();
                }
            }
        }
    }
    return {
        globalProvider,
        enabledProviders,
        routes,
    } as VtuProviderConfig;
}

export function selectVtuProvider(config: VtuProviderConfig, serviceType: VtuServiceType, network?: string) {
    const selected = network ? config.routes[serviceType]?.[network.toUpperCase()] : undefined;
    if (selected && config.enabledProviders.includes(selected)) return selected;
    return config.enabledProviders.includes(config.globalProvider) ? config.globalProvider : config.enabledProviders[0];
}

async function requestSmeApi(endpoint: string, payload: Record<string, unknown>) {
    const apiKey = process.env.SMEAPI_API_KEY;
    if (!apiKey) return { status: 'error', message: 'SMEAPI is not configured on the server.' };
    const response = await fetch(`https://smeapi.com.ng/api/${endpoint}/`, {
        method: 'POST',
        headers: { Authorization: `Token ${apiKey}`, 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(payload),
        cache: 'no-store',
    });
    const result = await response.json().catch(() => ({ status: 'error', message: 'SMEAPI returned an invalid response.' }));
    if (response.status === 202) return { ...result, status: 'processing' };
    return result;
}

export function normalizeNetworkName(network?: string) {
    const value = String(network ?? '').trim().replace(/[_\-\s]+/g, '').toUpperCase();
    if (!value) return '';
    if (value.includes('T2MOBILE') || value.includes('9MOBILE') || value.includes('9MO') || value.includes('T2M')) return 'T2MOBILE';
    return value;
}

function smeNetworkId(network?: string) {
    const normalized = normalizeNetworkName(network);
    return ({ MTN: 1, GLO: 2, T2MOBILE: 3, AIRTEL: 4 } as Record<string, number>)[normalized || ''];
}

export async function purchaseWithVtuProvider(provider: string, input: PurchaseInput) {
    if (provider === 'inlomax') {
        if (input.serviceType === 'AIRTIME') return inlomax.purchaseAirtime(input.mobileNumber, input.amount || 0, input.serviceID, input.requestId);
        if (input.serviceType === 'DATA') return inlomax.purchaseData(input.mobileNumber, input.serviceID, input.requestId || generatedVtuReference(input.serviceType));
        if (input.serviceType === 'CABLE') return inlomax.purchaseCable(input.mobileNumber, input.serviceID, input.requestId);
        if (input.serviceType === 'ELECTRICITY') return inlomax.payElectricity(input.mobileNumber, input.serviceID, input.meterType || 1, input.amount || 0, input.requestId);
        return inlomax.purchaseEducation(input.serviceID, input.quantity || 1, input.requestId);
    }

    const network = smeNetworkId(input.network);
    if (!network) return { status: 'error', message: `SMEAPI does not support network ${input.network || 'unknown'}.` };
    const ref = generatedVtuReference(input.serviceType);
    if (input.serviceType === 'AIRTIME') return requestSmeApi('airtime', {
        network,
        phone: input.mobileNumber,
        amount: input.amount,
        ported_number: input.portedNumber ?? true,
        ref: input.requestId || ref,
    });
    if (input.serviceType === 'DATA') {
        const dataPlanID = input.providerServiceID || input.serviceID;
        if (!dataPlanID) return { status: 'error', message: 'SMEAPI data-plan mapping is not configured for this product.' };
        return requestSmeApi('data', {
            network,
            data_plan: dataPlanID,
            phone: input.mobileNumber,
            ported_number: input.portedNumber ?? true,
            ref: input.requestId || ref,
        });
    }
    return { status: 'error', message: `SMEAPI routing is not configured for ${input.serviceType}.` };
}

export async function getSmeApiDataPlans() {
    const apiKey = process.env.SMEAPI_API_KEY;
    if (!apiKey) return null;
    const response = await fetch('https://smeapi.com.ng/api/dataplans/', {
        headers: { Authorization: `Token ${apiKey}`, Accept: 'application/json' },
        cache: 'no-store',
    });
    if (!response.ok) return null;
    return response.json().catch(() => null);
}

/** Builds the service catalog using the provider routes configured by an admin. */
export async function getConfiguredServices() {
    const data = await inlomax.getServices();
    const { data: providerSetting } = await supabaseAdmin
        .from('system_settings')
        .select('value')
        .eq('key', 'vtu_provider_config')
        .maybeSingle();
    const providerConfig = normalizeVtuProviderConfig(providerSetting?.value);
    const networks = ['MTN', 'GLO', 'AIRTEL', 'T2MOBILE'];
    const needsSmeApi = networks.some((network) => selectVtuProvider(providerConfig, 'DATA', network) === 'smeapi');
    const smeApiDataPlans = needsSmeApi ? await getSmeApiDataPlans() : null;
    const inlomaxPlans = Array.isArray(data?.data?.dataPlans) ? data.data.dataPlans : [];
    const smeApiPlans = normalizeSmeApiDataPlans(smeApiDataPlans);

    if (data?.data) {
        data.data.dataPlans = networks.flatMap((network) => {
            const provider = selectVtuProvider(providerConfig, 'DATA', network);
            return provider === 'smeapi'
                ? smeApiPlans.filter((plan) => normalizeNetworkName(plan.network) === network)
                : inlomaxPlans.filter((plan: { network?: string }) => normalizeNetworkName(plan.network) === network).map((plan) => ({ ...plan, provider: 'inlomax' }));
        });
        data.data.providerConfig = providerConfig;
    }

    return data;
}

type PublicProviderResolution = {
    provider: string;
    network?: string;
    providerServiceID?: string;
};

/** Resolves a public API purchase from server configuration and catalog data. */
export async function resolvePublicProvider(serviceType: VtuServiceType, serviceID: string, network?: string): Promise<PublicProviderResolution | null> {
    const { data: providerSetting } = await supabaseAdmin
        .from('system_settings')
        .select('value')
        .eq('key', 'vtu_provider_config')
        .maybeSingle();
    const providerConfig = normalizeVtuProviderConfig(providerSetting?.value);
    const normalizedNetwork = normalizeNetworkName(network);

    if (serviceType === 'DATA') {
        const catalog = await getConfiguredServices();
        const plans = Array.isArray(catalog?.data?.dataPlans) ? catalog.data.dataPlans : [];
        const matches = plans.filter((plan: { serviceID?: unknown; network?: string }) => String(plan.serviceID) === serviceID && (!normalizedNetwork || normalizeNetworkName(plan.network) === normalizedNetwork));
        if (matches.length !== 1) return null;
        const plan = matches[0] as { provider?: string; providerServiceID?: string; network?: string; serviceID?: string };
        const selectedNetwork = normalizeNetworkName(plan.network);
        return {
            provider: plan.provider || selectVtuProvider(providerConfig, serviceType, selectedNetwork),
            network: selectedNetwork,
            providerServiceID: plan.providerServiceID || plan.serviceID,
        };
    }

    if (normalizedNetwork) {
        return { provider: selectVtuProvider(providerConfig, serviceType, normalizedNetwork), network: normalizedNetwork };
    }

    if (serviceType === 'AIRTIME') {
        const networkByServiceID: Record<string, string> = { '1': 'MTN', '2': 'AIRTEL', '3': 'GLO', '4': 'T2MOBILE' };
        const knownNetwork = networkByServiceID[serviceID];
        if (knownNetwork) return { provider: selectVtuProvider(providerConfig, serviceType, knownNetwork), network: knownNetwork };
        const providers = ['MTN', 'AIRTEL', 'GLO', 'T2MOBILE'].map((item) => selectVtuProvider(providerConfig, serviceType, item));
        if (new Set(providers).size !== 1) return null;
        return { provider: providers[0] };
    }

    return { provider: selectVtuProvider(providerConfig, serviceType) };
}

export async function getSmeApiAccount() {
    const apiKey = process.env.SMEAPI_API_KEY;
    if (!apiKey) return { status: 'error', message: 'SMEAPI is not configured on the server.' };

    try {
        const response = await fetch('https://smeapi.com.ng/api/user/', {
            headers: { Authorization: `Token ${apiKey}`, Accept: 'application/json' },
            cache: 'no-store',
        });
        const result = await response.json().catch(() => ({ status: 'error', message: 'SMEAPI returned an invalid response.' }));
        if (!response.ok) return { status: 'error', message: result?.detail || result?.message || 'Unable to fetch SMEAPI account.' };
        return result;
    } catch (error) {
        console.error('SMEAPI account error:', error);
        return { status: 'error', message: 'Unable to connect to SMEAPI.' };
    }
}

export function normalizeSmeApiDataPlans(response: unknown) {
    const payload = response && typeof response === 'object' && !Array.isArray(response) ? response as Record<string, unknown> : {};
    const nestedData = payload.data && typeof payload.data === 'object' && !Array.isArray(payload.data)
        ? payload.data as Record<string, unknown>
        : {};
    const rawPlans = Array.isArray(response)
        ? response
        : Array.isArray(payload.data)
        ? payload.data
        : Array.isArray(nestedData.data)
            ? nestedData.data
        : Array.isArray(payload.plans)
            ? payload.plans
            : Array.isArray(payload.results)
                ? payload.results
                : [];
    const networkNames: Record<string, string> = { '1': 'MTN', '2': 'GLO', '3': 'T2MOBILE', '4': 'AIRTEL' };

    return rawPlans.flatMap((rawPlan) => {
        if (!rawPlan || typeof rawPlan !== 'object') return [];
        const plan = rawPlan as Record<string, unknown>;
        const networkValue = String(plan.network ?? plan.network_id ?? plan.networkId ?? '').trim();
        const network = normalizeNetworkName(networkNames[networkValue] || networkValue);
        const providerServiceID = String(plan.id ?? plan.data_plan ?? plan.dataPlanId ?? plan.plan_id ?? '').trim();
        const dataPlan = String(plan.name ?? plan.plan_name ?? plan.dataPlan ?? plan.plan ?? plan.title ?? '').trim();
        if (!network || !providerServiceID || !dataPlan) return [];
        return [{
            serviceID: providerServiceID,
            providerServiceID,
            network,
            dataPlan,
            amount: Number(plan.amount ?? plan.price ?? plan.selling_price ?? plan.sellingPrice ?? 0),
            dataType: String(plan.dataType ?? plan.data_type ?? plan.type ?? 'SMEAPI').trim(),
            validity: String(plan.days ?? plan.validity ?? plan.duration ?? '').trim(),
            provider: 'smeapi',
        }];
    });
}