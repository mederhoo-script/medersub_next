'use client';

import { useState } from 'react';
import { approveTransactionWithBiometrics } from '@/components/dashboard/biometric-transaction';

export function useTransactionPin() {
  const [open, setOpen] = useState(false);
  const [pin, setPin] = useState('');
  const [resolvePin, setResolvePin] = useState<((value: string | null) => void) | null>(null);

  const requestPin = () => new Promise<string | null>((resolve) => {
    setPin('');
    setResolvePin(() => resolve);
    setOpen(true);
  });

  const requestBiometricApproval = async () => {
    return await approveTransactionWithBiometrics();
  };

  const close = (value: string | null) => {
    setOpen(false);
    resolvePin?.(value);
    setResolvePin(null);
  };

  const PinDialog = open ? (
    <div className="fixed inset-0 z-100 flex items-center justify-center bg-black/50 px-4" role="dialog" aria-modal="true" aria-labelledby="transaction-pin-title">
      <form
        className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl"
        onSubmit={(event) => { event.preventDefault(); if (pin.length === 4) close(pin); }}
      >
        <h2 id="transaction-pin-title" className="text-lg font-semibold text-gray-900">Confirm transaction</h2>
        <p className="mt-1 text-sm text-gray-600">Enter your 4-digit transaction PIN.</p>
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
        <div className="mt-5 flex gap-3">
          <button type="button" onClick={() => close(null)} className="flex-1 rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700">Cancel</button>
          <button type="submit" disabled={pin.length !== 4} className="flex-1 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50">Continue</button>
        </div>
      </form>
    </div>
  ) : null;

  return { requestPin, requestBiometricApproval, PinDialog };
}
