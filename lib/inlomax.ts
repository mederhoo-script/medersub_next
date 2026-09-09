import axios from 'axios';

const BASE_URL = 'https://inlomax.com/api';

export interface ProviderData {
    funds?: number;
    id?: string | number;
    reference?: string;
    pins?: unknown;
    [key: string]: unknown;
}

export interface GenericResponse {
    status: string;
    message: string;
    // Provider payloads vary by service; preserve their unmodified response shape.
    data?: ProviderData;
}

function providerError(error: unknown, fallback: string): GenericResponse {
    if (axios.isAxiosError(error)) {
        return error.response?.data || { status: 'failed', message: fallback };
    }
    return { status: 'failed', message: fallback };
}

async function request<T = GenericResponse>(method: 'get' | 'post', endpoint: string, payload?: Record<string, unknown>): Promise<T | GenericResponse> {
    const apiKey = process.env.INLOMAX_API_KEY;
    if (!apiKey) return { status: 'failed', message: 'VTU provider is not configured' };

    try {
        const { data } = await axios.request<T>({
            baseURL: BASE_URL,
            url: endpoint,
            method,
            data: payload,
            headers: {
                Authorization: `Token ${apiKey}`,
                'Content-Type': 'application/json',
            },
            timeout: 30_000,
        });
        return data;
    } catch (error: unknown) {
        return providerError(error, 'Unable to reach VTU provider');
    }
}

/** The sole server-side client for Inlomax. Never expose its API key to callers. */
export const inlomax = {
    getBalance: () => request('get', '/balance'),
    getServices: () => request('get', '/services'),
    purchaseAirtime: (mobileNumber: string, amount: number, serviceID: string, requestId?: string) =>
        request('post', '/airtime', { mobileNumber, amount, serviceID, ...(requestId ? { 'request-id': requestId } : {}) }),
    purchaseData: (mobileNumber: string, serviceID: string, requestId?: string) =>
        request('post', '/data', { mobileNumber, serviceID, ...(requestId ? { 'request-id': requestId } : {}) }),
    validateCable: (iucNum: string, serviceID: string) => request('post', '/validatecable', { iucNum, serviceID }),
    purchaseCable: (iucNum: string, serviceID: string, requestId?: string) =>
        request('post', '/subcable', { iucNum, serviceID, ...(requestId ? { 'request-id': requestId } : {}) }),
    validateMeter: (meterNum: string, serviceID: string, meterType: number) =>
        request('post', '/validatemeter', { meterNum, serviceID, meterType }),
    payElectricity: (meterNum: string, serviceID: string, meterType: number, amount: number, requestId?: string) =>
        request('post', '/payelectric', { meterNum, serviceID, meterType, amount, ...(requestId ? { 'request-id': requestId } : {}) }),
    getTransaction: (reference: string) => request('post', '/transaction', { reference }),
    purchaseEducation: (serviceID: string, quantity: number, requestId?: string) =>
        request('post', '/education', { serviceID, quantity, ...(requestId ? { 'request-id': requestId } : {}) }),
};
