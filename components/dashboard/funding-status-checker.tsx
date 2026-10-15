'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { CheckCircle2, X } from 'lucide-react';

type FundingConfirmation = {
    reference: string;
    creditedAmount: number;
};

export default function FundingStatusChecker() {
    const pathname = usePathname();
    const router = useRouter();
    const pathnameRef = useRef(pathname);
    const checkedReferences = useRef(new Set<string>());
    const [confirmation, setConfirmation] = useState<FundingConfirmation | null>(null);

    useEffect(() => {
        pathnameRef.current = pathname;
    }, [pathname]);

    useEffect(() => {
        let cancelled = false;
        let timer: number | undefined;

        const checkPendingFunding = async () => {
            if (cancelled) return;

            if (pathnameRef.current !== '/dashboard/fund') {
                try {
                    const pendingResponse = await fetch('/api/payments/korapay/checkout/verify', { cache: 'no-store' });
                    if (pendingResponse.ok) {
                        const pendingData = await pendingResponse.json();
                        let walletChanged = false;

                        for (const pending of pendingData.pending || []) {
                            if (cancelled || pathnameRef.current === '/dashboard/fund' || typeof pending.reference !== 'string') break;
                            const createdAt = Date.parse(pending.createdAt);
                            const isExpired = Number.isFinite(createdAt) && Date.now() >= createdAt + 20 * 60 * 1000;
                            if (isExpired && checkedReferences.current.has(pending.reference)) continue;

                            try {
                                const response = await fetch('/api/payments/korapay/checkout/verify', {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({ reference: pending.reference }),
                                });
                                if (cancelled || pathnameRef.current === '/dashboard/fund') break;
                                if (!response.ok) {
                                    if (isExpired) checkedReferences.current.add(pending.reference);
                                    continue;
                                }

                                const result = await response.json();
                                if (result.status !== 'credited' && result.status !== 'duplicate' && !result.creditedAmount) {
                                    if (isExpired) checkedReferences.current.add(pending.reference);
                                    continue;
                                }

                                walletChanged = true;
                                if (pathnameRef.current !== '/dashboard/fund' && !checkedReferences.current.has(pending.reference)) {
                                    checkedReferences.current.add(pending.reference);
                                    setConfirmation({
                                        reference: pending.reference,
                                        creditedAmount: Number(result.creditedAmount) || 0,
                                    });
                                }
                            } catch {
                                // Try again during the next dashboard check.
                            }
                        }

                        if (walletChanged) {
                            window.dispatchEvent(new Event('medersub:wallet-updated'));
                            router.refresh();
                        }
                    }
                } catch {
                    // A temporary network failure should not interrupt future checks.
                }
            }

            if (!cancelled) timer = window.setTimeout(() => void checkPendingFunding(), 15000);
        };

        void checkPendingFunding();
        return () => {
            cancelled = true;
            if (timer !== undefined) window.clearTimeout(timer);
        };
    }, [router]);

    useEffect(() => {
        if (!confirmation) return;
        const timer = window.setTimeout(() => setConfirmation(null), 8000);
        return () => window.clearTimeout(timer);
    }, [confirmation]);

    if (!confirmation) return null;

    return (
        <div className="fixed bottom-24 right-4 z-[130] flex w-[calc(100%-2rem)] max-w-sm items-start gap-3 rounded-xl border border-emerald-200 bg-white p-4 shadow-lg md:bottom-6 md:right-6" role="status" aria-live="polite">
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
            <div className="min-w-0 flex-1">
                <p className="font-semibold text-slate-900">Wallet funded successfully</p>
                <p className="mt-1 text-sm text-slate-600">₦{confirmation.creditedAmount.toLocaleString('en-NG', { minimumFractionDigits: 2 })} has been added to your wallet.</p>
            </div>
            <button type="button" onClick={() => setConfirmation(null)} className="shrink-0 rounded-md p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-900" aria-label="Dismiss funding confirmation">
                <X className="h-4 w-4" />
            </button>
        </div>
    );
}