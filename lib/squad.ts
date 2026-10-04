import crypto from 'crypto';

const DEFAULT_BASE_URL = 'https://api-d.squadco.com';

type SquadResponse<T> = { status?: number; message?: string; data?: T };

export class SquadApiError extends Error {
  constructor(message: string, public readonly status: number) {
    super(message);
    this.name = 'SquadApiError';
  }
}

export function getSquadConfig() {
  const secretKey = (process.env.SQUAD_SECRET_KEY || process.env.SQUAD_API_KEY || '').trim().replace(/^Bearer\s+/i, '');
  const configuredWebhookSecret = (process.env.SQUAD_WEBHOOK_SECRET || '').trim();
  const webhookSecret = configuredWebhookSecret && !/^your[-_ ]/i.test(configuredWebhookSecret)
    ? configuredWebhookSecret
    : secretKey;
  return {
    secretKey,
    baseUrl: (process.env.SQUAD_BASE_URL || DEFAULT_BASE_URL).trim().replace(/\/+$/, ''),
    webhookSecret,
  };
}

export async function squadFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const { secretKey, baseUrl } = getSquadConfig();
  if (!secretKey) throw new Error('Squad secret key is not configured.');

  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: { Accept: 'application/json', 'Content-Type': 'application/json', Authorization: `Bearer ${secretKey}`, ...init.headers },
  });
  const raw = await response.text();
  let payload: SquadResponse<T> | null = null;
  try { payload = raw ? JSON.parse(raw) : null; } catch { throw new Error('Squad returned an invalid response.'); }
  if (!response.ok || (payload?.status !== undefined && ![200, 201].includes(Number(payload.status)))) {
    throw new SquadApiError(payload?.message || `Squad request failed with status ${response.status}`, Number(payload?.status) || response.status);
  }
  return (payload?.data ?? payload) as T;
}

export function verifySquadWebhookSignature(rawBody: string, payload: Record<string, any>, signature?: string | null) {
  const { webhookSecret } = getSquadConfig();
  const received = String(signature || '').trim().replace(/^sha512=/i, '');
  if (!webhookSecret || !/^[\da-f]{128}$/i.test(received)) return false;

  const version = String(payload.version || '').toLowerCase();
  if (version && !['v1', 'v2', 'v3'].includes(version)) return false;
  let message = rawBody;
  if (version === 'v2' || version === 'v3') {
    const fields = [
      payload.transaction_reference,
      payload.virtual_account_number,
      payload.currency,
      payload.principal_amount,
      payload.settled_amount,
      payload.customer_identifier,
    ];
    if (fields.some((field) => field === undefined || field === null)) return false;
    message = fields.map(String).join('|');
  }

  const expectedBuffer = crypto.createHmac('sha512', webhookSecret).update(message, 'utf8').digest();
  const receivedBuffer = Buffer.from(received, 'hex');
  return expectedBuffer.length === receivedBuffer.length && crypto.timingSafeEqual(expectedBuffer, receivedBuffer);
}
