import axios from 'axios';

const INLOMAX_API_KEY = process.env.INLOMAX_API_KEY;
const BASE_URL = 'https://inlomax.com/api';

const api = axios.create({
    baseURL: BASE_URL,
    headers: {
        'Authorization': `Token ${INLOMAX_API_KEY}`,
        'Content-Type': 'application/json',
    },
});

export interface GenericResponse {
    status: string;
    message: string;
}

export const inlomax = {
    getBalance: async () => {
        try {
            const { data } = await api.get('/balance');
            return data;
        } catch (error: any) {
            console.error('Inlomax Balance Error:', error.response?.data || error.message);
            return { status: 'error', message: 'Failed to fetch balance' };
        }
    },


    getServices: async () => {
        try {
            const { data } = await api.get('/services');
            return data;
        } catch (error: any) {
            console.error('Inlomax Services Error:', error.response?.data || error.message);
            return { status: 'error', message: 'Failed to fetch services' };
        }
    },

    purchaseAirtime: async (mobileNumber: string, amount: number, serviceID: string) => {
        try {
            const { data } = await api.post('/airtime', { mobileNumber, amount, serviceID });
            return data;
        } catch (error: any) {
            console.error('Inlomax Airtime Error:', error.response?.data || error.message);
            // Return the error response properly
            return error.response?.data || { status: 'error', message: 'Failed to purchase airtime' };
        }
    },

    purchaseData: async (mobileNumber: string, serviceID: string) => {
        try {
            const { data } = await api.post('/data', { mobileNumber, serviceID });
            return data;
        } catch (error: any) {
            console.error('Inlomax Data Error:', error.response?.data || error.message);
            return error.response?.data || { status: 'error', message: 'Failed to purchase data' };
        }
    },

    validateCable: async (iucNum: string, serviceID: string) => {
        try {
            const { data } = await api.post('/validatecable', { iucNum, serviceID });
            return data;
        } catch (error: any) {
            return error.response?.data || { status: 'error', message: 'Failed to validate cable' };
        }
    },

    purchaseCable: async (iucNum: string, serviceID: string) => {
        try {
            const { data } = await api.post('/subcable', { iucNum, serviceID });
            return data;
        } catch (error: any) {
            return error.response?.data || { status: 'error', message: 'Failed to subscribe cable' };
        }
    },

    validateMeter: async (meterNum: string, serviceID: string, meterType: number) => {
        try {
            const { data } = await api.post('/validatemeter', { meterNum, serviceID, meterType });
            return data;
        } catch (error: any) {
            return error.response?.data || { status: 'error', message: 'Failed to validate meter' };
        }
    },

    payElectricity: async (meterNum: string, serviceID: string, meterType: number, amount: number) => {
        try {
            const { data } = await api.post('/payelectric', { meterNum, serviceID, meterType, amount });
            return data;
        } catch (error: any) {
            return error.response?.data || { status: 'error', message: 'Failed to pay electricity' };
        }
    },

    getTransaction: async (reference: string) => {
        try {
            const { data } = await api.post('/transaction', { reference });
            return data;
        } catch (error: any) {
            return error.response?.data || { status: 'error', message: 'Failed to fetch transaction' };
        }
    },

    purchaseEducation: async (serviceID: string, quantity: number) => {
        try {
            const { data } = await api.post('/education', { serviceID, quantity });
            return data;
        } catch (error: any) {
            console.error('Inlomax Education Error:', error.response?.data || error.message);
            return error.response?.data || { status: 'error', message: 'Failed to purchase education pins' };
        }
    }
};

/**
 * Inlomax calls used exclusively by the public API v1 wrapper. Keeping these
 * separate from the legacy helpers above avoids changing existing website and
 * app purchase behaviour for current users.
 */
async function requestForPublicApi(method: 'get' | 'post', endpoint: string, payload?: Record<string, unknown>): Promise<unknown> {
    try {
        const { data } = await api.request({ method, url: endpoint, data: payload });
        return data;
    } catch (error: unknown) {
        if (axios.isAxiosError(error)) {
            return error.response?.data || { status: 'failed', message: 'Unable to reach VTU provider' };
        }
        return { status: 'failed', message: 'Unable to reach VTU provider' };
    }
}

export const publicInlomax = {
    getBalance: () => requestForPublicApi('get', '/balance'),
    getServices: () => requestForPublicApi('get', '/services'),
    purchaseAirtime: (mobileNumber: string, amount: number, serviceID: string, requestId: string) =>
        requestForPublicApi('post', '/airtime', { mobileNumber, amount, serviceID, 'request-id': requestId }),
    purchaseData: (mobileNumber: string, serviceID: string, requestId: string) =>
        requestForPublicApi('post', '/data', { mobileNumber, serviceID, 'request-id': requestId }),
    validateCable: (iucNum: string, serviceID: string) => requestForPublicApi('post', '/validatecable', { iucNum, serviceID }),
    purchaseCable: (iucNum: string, serviceID: string, requestId: string) =>
        requestForPublicApi('post', '/subcable', { iucNum, serviceID, 'request-id': requestId }),
    validateMeter: (meterNum: string, serviceID: string, meterType: number) =>
        requestForPublicApi('post', '/validatemeter', { meterNum, serviceID, meterType }),
    payElectricity: (meterNum: string, serviceID: string, meterType: number, amount: number, requestId: string) =>
        requestForPublicApi('post', '/payelectric', { meterNum, serviceID, meterType, amount, 'request-id': requestId }),
    getTransaction: (reference: string) => requestForPublicApi('post', '/transaction', { reference }),
    purchaseEducation: (serviceID: string, quantity: number, requestId: string) =>
        requestForPublicApi('post', '/education', { serviceID, quantity, 'request-id': requestId }),
};
