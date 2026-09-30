import crypto from 'crypto';

const DEFAULT_BASE_URL = 'https://api-d.squadco.com';

type SquadResponse<T> = { status?: number; message?: string; data?: T };

export function getSquadConfig() {
  const secretKey = (process.env.SQUAD_SECRET_KEY || process.env.SQUAD_API_KEY || '').trim().replace(/^Bearer\s+/i, '');
  return {
    secretKey,
    baseUrl: (process.env.SQUAD_BASE_URL || DEFAULT_BASE_URL).trim().replace(/\/+$/, ''),
    webhookSecret: (process.env.SQUAD_WEBHOOK_SECRET || secretKey).trim(),
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
    throw new Error(payload?.message || `Squad request failed with status ${response.status}`);
  }
  return (payload?.data ?? payload) as T;
}

export function verifySquadWebhookSignature(rawBody: string, signature?: string | null) {
  const { webhookSecret } = getSquadConfig();
  const received = String(signature || '').trim().replace(/^sha512=/i, '');
  if (!webhookSecret || !received) return false;
  const expected = crypto.createHmac('sha512', webhookSecret).update(rawBody, 'utf8').digest('hex');
  const expectedBuffer = Buffer.from(expected, 'utf8');
  const receivedBuffer = Buffer.from(received, 'utf8');
  return expectedBuffer.length === receivedBuffer.length && crypto.timingSafeEqual(expectedBuffer, receivedBuffer);
}
