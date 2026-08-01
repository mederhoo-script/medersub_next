'use client';

import { startAuthentication } from '@simplewebauthn/browser';

export async function approveTransactionWithBiometrics() {
  if (!window.PublicKeyCredential) throw new Error('Biometric approval is not supported on this device.');
  const optionsResponse = await fetch('/api/account/biometric', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify({ action: 'purchase-options' }) });
  const options = await optionsResponse.json();
  if (!optionsResponse.ok) throw new Error(options.error || 'Unable to start biometric approval.');
  const response = await startAuthentication({ optionsJSON: options });
  const verifyResponse = await fetch('/api/account/biometric', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify({ action: 'purchase-verify', response }) });
  const verified = await verifyResponse.json();
  if (!verifyResponse.ok) throw new Error(verified.error || 'Biometric approval failed.');
  return verified.token as string;
}
