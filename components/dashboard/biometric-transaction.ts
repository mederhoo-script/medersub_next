'use client';

import { startAuthentication, startRegistration } from '@simplewebauthn/browser';

function normalizeBiometricError(error: unknown, fallback: string) {
  if (error instanceof Error) {
    const message = error.message;
    if (message.includes('not supported')) {
      return 'This device does not support biometric approval.';
    }
    if (message.includes('secure connection') || message.includes('HTTPS')) {
      return message;
    }
    if (message.includes('Set up fingerprint') || message.includes('first')) {
      return message;
    }
    if (message.includes('expired') || message.includes('already been used')) {
      return message;
    }
    return message;
  }

  return fallback;
}

async function ensureBiometricAvailability() {
  if (typeof window === 'undefined' || typeof window.PublicKeyCredential === 'undefined') {
    throw new Error('Biometrics are not supported on this device.');
  }

  if (!window.isSecureContext) {
    throw new Error('Biometrics require a secure connection. Please open the app over HTTPS or localhost.');
  }

  try {
    const available = await window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
    if (!available) {
      throw new Error('This device or browser has no biometric authenticator available. Set up fingerprint or Face ID in your phone settings first.');
    }
  } catch {
    // Some browsers do not expose the capability check; continue with the WebAuthn flow.
  }
}

export async function enrollTransactionBiometrics() {
  await ensureBiometricAvailability();

  try {
    const optionsResponse = await fetch('/api/account/biometric', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify({ action: 'enroll-options' }) });
    const options = await optionsResponse.json();
    if (!optionsResponse.ok) throw new Error(options.error || 'Unable to start biometric setup.');

    const response = await startRegistration({ optionsJSON: options });
    const verifyResponse = await fetch('/api/account/biometric', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify({ action: 'enroll-verify', response }) });
    const verified = await verifyResponse.json();
    if (!verifyResponse.ok) throw new Error(verified.error || 'Biometric setup failed.');
  } catch (error) {
    throw new Error(normalizeBiometricError(error, 'Biometric setup failed.'));
  }
}

export async function approveTransactionWithBiometrics() {
  try {
    await ensureBiometricAvailability();
    const optionsResponse = await fetch('/api/account/biometric', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify({ action: 'purchase-options' }) });
    const options = await optionsResponse.json();
    if (!optionsResponse.ok) throw new Error(options.error || 'Unable to start biometric approval.');

    const response = await startAuthentication({ optionsJSON: options });
    const verifyResponse = await fetch('/api/account/biometric', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify({ action: 'purchase-verify', response }) });
    const verified = await verifyResponse.json();
    if (!verifyResponse.ok) throw new Error(verified.error || 'Biometric approval failed.');

    return verified.token as string;
  } catch (error) {
    throw new Error(normalizeBiometricError(error, 'Biometric approval failed.'));
  }
}
