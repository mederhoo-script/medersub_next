'use client';

import { useEffect, useState } from 'react';
import { approveTransactionWithBiometrics, checkBiometricSupport } from '@/components/dashboard/biometric-transaction';

export function useTransactionPin() {
  const [open, setOpen] = useState(false);
  const [setupMode, setSetupMode] = useState(false);
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [resolvePin, setResolvePin] = useState<((value: string | null) => void) | null>(null);
  const [biometricSupported, setBiometricSupported] = useState(false);
  const [biometricSupportMessage, setBiometricSupportMessage] = useState<string | null>(null);

  const requestPin = async () => new Promise<string | null>(async (resolve) => {
    let mustChangeTransactionPin = false;
    try {
      const response = await fetch('/api/account/transaction-pin', { credentials: 'include' });
      if (response.ok) {
        const status = await response.json();
        mustChangeTransactionPin = Boolean(status.mustChangeTransactionPin);
      }
    } catch {
      // Fall back to the regular PIN prompt if the status check is unavailable.
    }

    setPin('');
    setConfirmPin('');
    setError(null);
    setSetupMode(mustChangeTransactionPin);
    setResolvePin(() => resolve);
    setOpen(true);
  });

  const requestBiometricApproval = async () => {
    const response = await fetch('/api/account/transaction-pin', { credentials: 'include' });
    if (response.ok) {
      const status = await response.json();
      if (status.mustChangeTransactionPin) {
        const initialPin = await requestPin();
        if (!initialPin) return null;
      }
    }
    return await approveTransactionWithBiometrics();
  };

  useEffect(() => {
    const loadSupport = async () => {
      const support = await checkBiometricSupport();
      setBiometricSupported(support.supported);
      setBiometricSupportMessage(support.message || null);
    };

    loadSupport();
  }, []);

  const close = (value: string | null) => {
    setOpen(false);
    setSetupMode(false);
    setError(null);
    resolvePin?.(value);
    setResolvePin(null);
  };

  const saveInitialPin = async () => {
    if (pin.length !== 4 || pin !== confirmPin) {
      setError('Enter matching 4-digit PINs.');
      return;
    }
    if (pin === '1234') {
      setError('Choose a PIN other than the default PIN.');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const response = await fetch('/api/account/transaction-pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ pin, confirmPin }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to save transaction PIN.');
      close(pin);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Failed to save transaction PIN.');
    } finally {
      setSaving(false);
    }
  };

  const PinDialog = open ? (
    <div className="fixed inset-0 z-100 flex items-center justify-center bg-black/50 px-4" role="dialog" aria-modal="true" aria-labelledby="transaction-pin-title">
      <form
        className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl"
        onSubmit={(event) => { event.preventDefault(); if (setupMode) { void saveInitialPin(); } else if (pin.length === 4) close(pin); }}
      >
        <h2 id="transaction-pin-title" className="text-lg font-semibold text-gray-900">{setupMode ? 'Set your transaction PIN' : 'Confirm transaction'}</h2>
        <p className="mt-1 text-sm text-gray-600">{setupMode ? 'Choose a new 4-digit PIN to secure transactions.' : 'Enter your 4-digit transaction PIN.'}</p>
        <input
          autoFocus
          type="password"
          inputMode="numeric"
          pattern="[0-9]*"
          autoComplete="one-time-code"
          maxLength={4}
          value={pin}
          onChange={(event) => setPin(event.target.value.replace(/\D/g, '').slice(0, 4))}
          className="mt-5 w-full rounded-lg border border-gray-300 px-4 py-3 text-center text-xl tracking-[0.5em] focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
          placeholder="••••"
          aria-label="Four digit transaction PIN"
          required
        />
        {setupMode && <input
          type="password"
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={4}
          value={confirmPin}
          onChange={(event) => setConfirmPin(event.target.value.replace(/\D/g, '').slice(0, 4))}
          className="mt-3 w-full rounded-lg border border-gray-300 px-4 py-3 text-center text-xl tracking-[0.5em] focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
          placeholder="Confirm PIN"
          aria-label="Confirm four digit transaction PIN"
          required
        />}
        {error && <p className="mt-3 text-sm text-red-600" role="alert">{error}</p>}
        <div className="mt-5 flex gap-3">
          <button type="button" onClick={() => close(null)} className="flex-1 rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700">Cancel</button>
          <button type="submit" disabled={saving || pin.length !== 4 || (setupMode && confirmPin.length !== 4)} className="flex-1 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50">{saving ? 'Saving...' : setupMode ? 'Save PIN' : 'Continue'}</button>
        </div>
      </form>
    </div>
  ) : null;

  return { requestPin, requestBiometricApproval, PinDialog, biometricSupported, biometricSupportMessage };
}
