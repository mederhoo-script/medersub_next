'use client';

import { NativeBiometric } from 'capacitor-native-biometric';

export async function isNativeBiometricAvailable() {
  try {
    const result = await NativeBiometric.isAvailable();
    return !!(result && (result.isAvailable));
  } catch (error) {
    return false;
  }
}

export async function requestNativeBiometric() {
  try {
    await NativeBiometric.verifyIdentity({
      reason: 'Confirm transaction with biometrics',
      title: 'Confirm Purchase',
      subtitle: 'Use fingerprint or Face ID to approve your purchase',
      description: '',
      negativeButtonText: 'Cancel',
      useFallback: true,
    });
    return true;
  } catch (err) {
    throw new Error('Biometric approval was cancelled or not verified.');
  }
}
