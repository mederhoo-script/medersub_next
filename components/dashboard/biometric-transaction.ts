'use client';

import { startAuthentication, startRegistration } from '@simplewebauthn/browser';

function normalizeBiometricError(error: unknown, fallback: string) {
  if (error instanceof Error) {
    const name = error.name || '';
    const message = error.message || '';

    if (name === 'NotAllowedError') {
      return 'Biometric approval was cancelled or blocked. Please try again or use your transaction PIN.';
    }

    if (name === 'NotSupportedError' || message.includes('not supported')) {
      return 'This browser does not support biometric approval. Please use a recent version of Chrome, Safari, or Edge on your phone, and open the app over HTTPS or localhost.';
    }

    if (name === 'SecurityError' || message.includes('secure connection') || message.includes('secure context') || message.includes('HTTPS') || message.includes('https')) {
      return 'Biometrics require a secure connection. Please open the app over HTTPS or localhost.';
    }

    if (message.includes('Set up fingerprint') || message.includes('first')) {
      return message;
    }

    if (message.includes('expired') || message.includes('already been used')) {
      return message;
    }

    return message || fallback;
  }

  return fallback;
}

async function ensureBiometricAvailability() {
  if (typeof window === 'undefined' || typeof window.PublicKeyCredential === 'undefined') {
    throw new Error('Biometrics are not supported on this device.');
  }

  const isSecure = window.isSecureContext || window.location.protocol === 'https:' || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  if (!isSecure) {
    throw new Error('Biometrics require a secure connection. Please open the app over HTTPS or localhost.');
  }

  if (typeof window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable === 'function') {
    try {
      await window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
    } catch {
      // Ignore capability probe failures and continue with the actual authentication attempt.
    }
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
