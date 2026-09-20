const providerNamePattern = /\b(?:smeapi|inlomax|provider)\b/gi;

/** Converts upstream provider wording into stable Medersub-facing messages. */
export function customerFacingProviderMessage(value: unknown, fallback = 'Service temporarily unavailable. Please try again later.') {
    const message = String(value || '').trim();
    if (!message) return fallback;

    const normalized = message.toLowerCase();
    if (normalized.includes('data-plan mapping is not configured')) {
        return 'This data plan is temporarily unavailable. Please select another plan or try again later.';
    }
    if (normalized.includes('insufficient funds') || normalized.includes('insuffucient funds')) {
        return 'Service temporarily unavailable. Please try again later.';
    }
    if (normalized.includes('not configured on the server')) {
        return 'This service is temporarily unavailable. Please try again later.';
    }
    if (normalized.includes('does not support network')) {
        return 'This network is temporarily unavailable. Please try again later.';
    }
    if (normalized.includes('returned an invalid response') || normalized.includes('unable to connect')) {
        return 'Service temporarily unavailable. Please try again later.';
    }

    return message.replace(providerNamePattern, 'service').replace(/\s{2,}/g, ' ').trim();
}

export function providerResponseMessage(response: { message?: unknown; msg?: unknown; api_response?: unknown }, fallback?: string) {
    return customerFacingProviderMessage(response.message || response.msg || response.api_response, fallback);
}

export function customerFacingProviderResponse<T extends { status?: unknown; message?: unknown; msg?: unknown; api_response?: unknown }>(response: T): Omit<T, 'msg' | 'api_response'> & { message: string } {
    if (!response || typeof response !== 'object') return response;
    const { msg: _msg, api_response: _apiResponse, ...safeResponse } = response;
    return { ...safeResponse, message: providerResponseMessage(response) };
}
