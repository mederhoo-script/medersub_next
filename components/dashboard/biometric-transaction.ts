'use client';

import { Capacitor } from '@capacitor/core';
import { startAuthentication, startRegistration } from '@simplewebauthn/browser';
import { requestNativeBiometric, isNativeBiometricAvailable } from '@/components/dashboard/native-biometric';

function normalizeBiometricError(error: unknown, fallback: string) {
  if (error instanceof Error) {
    const name = error.name || '';
    const message = error.message || '';

    if (name === 'NotAllowedError') {
      return 'Biometric approval was cancelled or blocked. Please try again or use your transaction PIN.';
    }

    if (name === 'NotSupportedError' || message.includes('not supported')) {
      return 'Biometric approval is not supported in this browser or app environment. Use Chrome, Safari, or Edge directly over HTTPS, not inside an embedded webview.';
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

function isEmbeddedBrowser() {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  return /FBAN|FBAV|Instagram|Twitter|Line|WhatsApp|Snapchat|Telegram|TikTok|WeChat|Pinterest/i.test(ua);
}

function isNativeCapacitorPlatform() {
  if (typeof window === 'undefined') return false;
  return Capacitor.isNativePlatform?.() || Capacitor.getPlatform() !== 'web';
}

export async function checkBiometricSupport() {
  if (typeof window === 'undefined') {
    return { supported: false, message: 'Biometrics are only available in the browser.' };
  }

  if (isNativeCapacitorPlatform()) {
    const available = await isNativeBiometricAvailable();
    return available
      ? { supported: true }
      : { supported: false, message: 'Native biometric authentication is not available on this device.' };
  }

  if (isEmbeddedBrowser()) {
    return {
      supported: false,
      message: 'Biometric approval may not work inside embedded app browsers. Open this page in Safari or Chrome directly over HTTPS.',
    };
  }

  if (typeof window.PublicKeyCredential === 'undefined') {
    return {
      supported: false,
      message: 'Your browser does not support WebAuthn biometric approval. Use Safari or Chrome on your phone over HTTPS.',
    };
  }

  const isSecure = window.isSecureContext || window.location.protocol === 'https:' || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  if (!isSecure) {
    return { supported: false, message: 'Biometrics require a secure HTTPS connection or localhost.' };
  }

  return { supported: true };
}

async function ensureBiometricAvailability() {
  const support = await checkBiometricSupport();
  if (!support.supported) {
    throw new Error(support.message || 'Biometrics are not supported on this device.');
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
    if (isNativeCapacitorPlatform()) {
      await requestNativeBiometric();
      const tokenResponse = await fetch('/api/account/biometric', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ action: 'purchase-native' }),
      });
      const tokenPayload = await tokenResponse.json();
      if (!tokenResponse.ok) throw new Error(tokenPayload.error || 'Unable to create native biometric approval token.');
      return tokenPayload.token as string;
    }

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
