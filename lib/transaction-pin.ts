import { randomBytes, pbkdf2Sync, timingSafeEqual } from 'crypto';

export const TRANSACTION_PIN_PATTERN = /^\d{4}$/;
export const DEFAULT_TRANSACTION_PIN = '1234';
const HASH_ITERATIONS = 120000;
const HASH_KEY_LENGTH = 32;
const HASH_DIGEST = 'sha256';

export function hashTransactionPin(pin: string) {
    const salt = randomBytes(16).toString('hex');
    const hash = pbkdf2Sync(pin, salt, HASH_ITERATIONS, HASH_KEY_LENGTH, HASH_DIGEST).toString('hex');
    return `pbkdf2_sha256$${HASH_ITERATIONS}$${salt}$${hash}`;
}

export function verifyTransactionPin(pin: string, storedHash: string | null | undefined) {
    if (!storedHash) return false;

    const [algorithm, iterations, salt, hash] = storedHash.split('$');
    if (algorithm !== 'pbkdf2_sha256' || !iterations || !salt || !hash) return false;

    const candidate = pbkdf2Sync(pin, salt, Number(iterations), HASH_KEY_LENGTH, HASH_DIGEST);
    const expected = Buffer.from(hash, 'hex');
    return candidate.length === expected.length && timingSafeEqual(candidate, expected);
}
