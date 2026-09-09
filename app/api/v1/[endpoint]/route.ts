import { NextResponse } from 'next/server';
import { publicInlomax } from '@/lib/inlomax';
import {
    ApiPayload,
    applyServiceMarkup,
    authenticatePublicApi,
    generatedRequestId,
    providerStatus,
    publicApiMarkupPercentage,
    requirePositiveNumber,
    requireString,
} from '@/lib/public-api';

export const dynamic = 'force-dynamic';

const endpoints = new Set(['services', 'balance', 'airtime', 'data', 'validatecable', 'subcable', 'validatemeter', 'payelectric', 'education', 'transaction']);
const purchases = new Set(['airtime', 'data', 'subcable', 'payelectric', 'education']);

function failed(message: string, status: number) {
    return NextResponse.json({ status: 'failed', message }, { status });
}

async function bodyFor(request: Request): Promise<ApiPayload | null> {
    try {
        const body: unknown = await request.json();
        return body && typeof body === 'object' && !Array.isArray(body) ? body as ApiPayload : null;
    } catch {
        return null;
    }
}

export async function GET(request: Request, context: { params: Promise<{ endpoint: string }> }) {
    const { endpoint } = await context.params;
    if (!endpoints.has(endpoint) || !['services', 'balance'].includes(endpoint)) return failed('Endpoint not found', 404);
    // Service discovery is deliberately public so developers can browse plans before signing up.
    if (endpoint !== 'services' && !await authenticatePublicApi(request)) return failed('Invalid or missing API key', 401);

    const response = endpoint === 'services' ? await publicInlomax.getServices() : await publicInlomax.getBalance();
    const result = endpoint === 'services' ? applyServiceMarkup(response, await publicApiMarkupPercentage()) : response;
    return NextResponse.json(result, { status: providerStatus(result) });
}

export async function POST(request: Request, context: { params: Promise<{ endpoint: string }> }) {
    const { endpoint } = await context.params;
    if (!endpoints.has(endpoint) || ['services', 'balance'].includes(endpoint)) return failed('Endpoint not found', 404);
    if (!await authenticatePublicApi(request)) return failed('Invalid or missing API key', 401);

    const body = await bodyFor(request);
    if (!body) return failed('Request body must be a JSON object', 400);
    const serviceID = requireString(body, 'serviceID');
    // Preserve a supplied Inlomax-compatible request-id byte-for-byte; it is the
    // upstream idempotency reference used when a customer retries a purchase.
    const suppliedRequestId = body['request-id'];
    const requestId = typeof suppliedRequestId === 'string' && suppliedRequestId.length > 0
        ? suppliedRequestId
        : (purchases.has(endpoint) ? generatedRequestId() : undefined);
    const purchaseRequestId = requestId || generatedRequestId();
    let response: unknown;

    switch (endpoint) {
        case 'airtime': {
            const mobileNumber = requireString(body, 'mobileNumber');
            const amount = requirePositiveNumber(body, 'amount');
            if (!serviceID || !mobileNumber || !amount) return failed('serviceID, amount, and mobileNumber are required', 400);
            response = await publicInlomax.purchaseAirtime(mobileNumber, amount, serviceID, purchaseRequestId);
            break;
        }
        case 'data': {
            const mobileNumber = requireString(body, 'mobileNumber');
            if (!serviceID || !mobileNumber) return failed('serviceID and mobileNumber are required', 400);
            response = await publicInlomax.purchaseData(mobileNumber, serviceID, purchaseRequestId);
            break;
        }
        case 'validatecable': {
            const iucNum = requireString(body, 'iucNum');
            if (!serviceID || !iucNum) return failed('serviceID and iucNum are required', 400);
            response = await publicInlomax.validateCable(iucNum, serviceID);
            break;
        }
        case 'subcable': {
            const iucNum = requireString(body, 'iucNum');
            if (!serviceID || !iucNum) return failed('serviceID and iucNum are required', 400);
            response = await publicInlomax.purchaseCable(iucNum, serviceID, purchaseRequestId);
            break;
        }
        case 'validatemeter': {
            const meterNum = requireString(body, 'meterNum');
            const meterType = requirePositiveNumber(body, 'meterType');
            if (!serviceID || !meterNum || !meterType) return failed('serviceID, meterNum, and meterType are required', 400);
            response = await publicInlomax.validateMeter(meterNum, serviceID, meterType);
            break;
        }
        case 'payelectric': {
            const meterNum = requireString(body, 'meterNum');
            const meterType = requirePositiveNumber(body, 'meterType');
            const amount = requirePositiveNumber(body, 'amount');
            if (!serviceID || !meterNum || !meterType || !amount) return failed('serviceID, meterNum, meterType, and amount are required', 400);
            response = await publicInlomax.payElectricity(meterNum, serviceID, meterType, amount, purchaseRequestId);
            break;
        }
        case 'education': {
            const quantity = requirePositiveNumber(body, 'quantity');
            if (!serviceID || !quantity || !Number.isInteger(quantity)) return failed('serviceID and a whole-number quantity are required', 400);
            response = await publicInlomax.purchaseEducation(serviceID, quantity, purchaseRequestId);
            break;
        }
        case 'transaction': {
            const reference = requireString(body, 'reference');
            if (!reference) return failed('reference is required', 400);
            response = await publicInlomax.getTransaction(reference);
            break;
        }
        default:
            return failed('Endpoint not found', 404);
    }

    return NextResponse.json(response, { status: providerStatus(response) });
}
