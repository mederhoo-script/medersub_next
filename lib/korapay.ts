import crypto from 'crypto';

export type KoraPayProviderConfig = {
  secretKey?: string;
  webhookSecret?: string;
  baseUrl?: string;
};

export function getKoraPayConfig(): KoraPayProviderConfig {
  const secretKey = (process.env.KORAPAY_SECRET_KEY || process.env.KORAPAY_API_KEY || '').trim();
  const baseUrl = (process.env.KORAPAY_BASE_URL || 'https://api.korapay.com/merchant/api/v1').trim().replace(/\/+$/, '');

  return {
    secretKey: secretKey.replace(/^Bearer\s+/i, ''),
    webhookSecret: process.env.KORAPAY_WEBHOOK_SECRET || '',
    baseUrl,
  };
}

export function verifyKoraPayWebhookSignature(data: unknown, signature?: string | null) {
  const { secretKey } = getKoraPayConfig();
  const receivedSignature = String(signature || '').trim();

  if (!secretKey || !receivedSignature) {
    return false;
  }

  const signedData = JSON.stringify(data);
  const expectedSignature = crypto
    .createHmac('sha256', secretKey)
    .update(signedData, 'utf8')
    .digest('hex');
  const expected = Buffer.from(expectedSignature, 'utf8');
  const received = Buffer.from(receivedSignature, 'utf8');

  return expected.length === received.length && crypto.timingSafeEqual(expected, received);
}

export async function korapayFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const { secretKey, baseUrl } = getKoraPayConfig();

  if (!secretKey) {
    throw new Error('KoraPay secret key is not configured.');
  }

  const headers = new Headers(init.headers || {});
  headers.set('Accept', 'application/json');
  headers.set('Content-Type', 'application/json');
  headers.set('Authorization', `Bearer ${secretKey}`);

  const bodyText = typeof init.body === 'string' ? init.body : '';
  const debugIsSandbox = /^sk_test_|^pk_test_/.test(secretKey);

  if (debugIsSandbox) {
    console.log('[korapay-debug] final request:', {
      url: `${baseUrl}${path}`,
      headers: {
        Accept: headers.get('Accept'),
        'Content-Type': headers.get('Content-Type'),
        Authorization: headers.get('Authorization'),
      },
      body: bodyText ? JSON.parse(bodyText) : null,
    });
  }

  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers,
  });

  const rawText = await response.text();
  const payload = rawText ? JSON.parse(rawText) : null;

  if (process.env.NODE_ENV !== 'production') {
    console.log('[korapay-debug] raw response:', {
      status: response.status,
      statusText: response.statusText,
      payload,
      rawText,
    });
  }

  if (!response.ok) {
    throw new Error(payload?.message || `KoraPay request failed with status ${response.status}`);
  }

  return payload as T;
}

export async function createKoraPayVirtualAccount(payload: Record<string, unknown>) {
  return korapayFetch<{ status: boolean; message?: string; data?: Record<string, any> }>('/virtual-bank-account', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function getKoraPayCharge(reference: string) {
  return korapayFetch<{ status: boolean; message?: string; data?: Record<string, any> }>(`/charges/${encodeURIComponent(reference)}`);
}

export function normalizeCurrency(value?: string | null) {
  return String(value || 'NGN').toUpperCase();
}

export function normalizeAmount(value: number | string | null | undefined) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}
