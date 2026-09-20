import { randomBytes } from 'crypto';
import { inlomax } from '@/lib/inlomax';

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
        if (input.serviceType === 'AIRTIME') return inlomax.purchaseAirtime(input.mobileNumber, input.amount || 0, input.serviceID);
        if (input.serviceType === 'DATA') return inlomax.purchaseData(input.mobileNumber, input.serviceID, generatedVtuReference(input.serviceType));
        if (input.serviceType === 'CABLE') return inlomax.purchaseCable(input.mobileNumber, input.serviceID);
        if (input.serviceType === 'ELECTRICITY') return inlomax.payElectricity(input.mobileNumber, input.serviceID, input.meterType || 1, input.amount || 0);
        return inlomax.purchaseEducation(input.serviceID, input.quantity || 1);
    }

    const network = smeNetworkId(input.network);
    if (!network) return { status: 'error', message: `SMEAPI does not support network ${input.network || 'unknown'}.` };
    const ref = generatedVtuReference(input.serviceType);
    if (input.serviceType === 'AIRTIME') return requestSmeApi('airtime', { network, phone: input.mobileNumber, amount: input.amount, ref });
    if (input.serviceType === 'DATA') {
        if (!input.providerServiceID) return { status: 'error', message: 'SMEAPI data-plan mapping is not configured for this product.' };
        return requestSmeApi('data', { network, data_plan: input.providerServiceID, phone: input.mobileNumber, ref });
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