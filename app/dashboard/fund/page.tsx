'use client';
import { useState, useEffect } from 'react';
import { Copy, CreditCard, ArrowLeft, ShieldCheck, HelpCircle, Loader2, MessageCircle, CheckCircle2, XCircle } from 'lucide-react';
import Link from 'next/link';
import Script from 'next/script';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';

declare global {
    interface Window {
        MonnifySDK: any;
    }
}

export default function FundWalletPage() {
    const router = useRouter();
    const [amount, setAmount] = useState('');
    const [loading, setLoading] = useState(false);
    const [provider, setProvider] = useState<'monnify' | 'korapay' | 'squad' | 'none' | null>(null);
    const [providerLoading, setProviderLoading] = useState(true);
    const [virtualAccount, setVirtualAccount] = useState<any>(null);
    const [squadAccounts, setSquadAccounts] = useState<any[]>([]);
    const [squadDepositFee, setSquadDepositFee] = useState(0);
    const [accountCopyStatus, setAccountCopyStatus] = useState<'idle' | 'copied' | 'error'>('idle');
    const [accountLoading, setAccountLoading] = useState(false);
    const [koraError, setKoraError] = useState<string>('');
    const [hasBvn, setHasBvn] = useState(true);
    const [squadCustomerDetails, setSquadCustomerDetails] = useState({ fullName: '', bvn: '', dateOfBirth: '', gender: '', mobileNumber: '', address: '' });
    const [squadConfiguredDefaults, setSquadConfiguredDefaults] = useState({ defaultAccountReady: false, fullName: false, bvn: false, phone: false, dateOfBirth: false, gender: false, address: false });
    const [showSquadAccountChoice, setShowSquadAccountChoice] = useState(false);
    const [showSquadDetailsForm, setShowSquadDetailsForm] = useState(false);
    const [checkoutLoading, setCheckoutLoading] = useState(false);
    const [fundingResult, setFundingResult] = useState<{ type: 'success' | 'error' | 'pending'; title: string; message: string; grossAmount?: number; fee?: number; creditedAmount?: number } | null>(null);

    // Config - Should be in ENV used by component or public constant
    const MONNIFY_API_KEY = process.env.NEXT_PUBLIC_MONNIFY_API_KEY || 'MK_TEST_PLACEHOLDER';
    const CONTRACT_CODE = process.env.NEXT_PUBLIC_MONNIFY_CONTRACT_CODE || '0000000000';

    useEffect(() => {
        const loadProvider = async () => {
            try {
                const res = await fetch('/api/payments/provider', { cache: 'no-store' });
                if (res.ok) {
                    const settings = await res.json();
                    setProvider(settings.payment_provider === 'korapay' ? 'korapay' : settings.payment_provider === 'squad' ? 'squad' : settings.payment_provider === 'none' ? 'none' : 'monnify');
                } else {
                    setProvider('monnify');
                }
            } catch (err) {
                console.error('Failed to load payment provider', err);
                setProvider('monnify');
            } finally {
                setProviderLoading(false);
            }
        };

        loadProvider();
    }, []);

    useEffect(() => {
        if (provider !== 'korapay' && provider !== 'squad') return;

        const loadVirtualAccount = async () => {
            setAccountLoading(true);
            setKoraError('');
            try {
                const res = await fetch(`/api/payments/${provider}/account`, { cache: 'no-store' });
                const data = await res.json();
                if (res.ok) {
                    setVirtualAccount(data.virtualAccount || null);
                    setHasBvn(Boolean(data.hasBvn));
                    if (provider === 'squad') {
                        const accounts = data.virtualAccounts || (data.virtualAccount ? [data.virtualAccount] : []);
                        setSquadAccounts(accounts);
                        setSquadDepositFee(Number(data.squadDepositFee) || 0);
                        setSquadCustomerDetails((current) => ({ ...current, ...(data.customerDetails || {}) }));
                        setSquadConfiguredDefaults(data.configuredDefaults || { defaultAccountReady: false, fullName: false, bvn: false, phone: false, dateOfBirth: false, gender: false, address: false });
                        if (accounts.length === 0 && data.configuredDefaults?.defaultAccountReady) {
                            const accountRes = await fetch('/api/payments/squad/account', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ accountMode: 'default' }),
                            });
                            const accountData = await accountRes.json();
                            if (accountRes.ok) {
                                setVirtualAccount(accountData.virtualAccount || null);
                                setSquadAccounts(accountData.virtualAccount ? [accountData.virtualAccount] : []);
                            } else {
                                setKoraError(accountData?.error || 'Failed to create the default Squad account.');
                                setShowSquadAccountChoice(true);
                            }
                        }
                    }
                    if (!data.virtualAccount && provider === 'korapay') {
                        const accountRes = await fetch(`/api/payments/${provider}/account`, { method: 'POST', cache: 'no-store' });
                        const accountData = await accountRes.json();

                        if (!accountRes.ok) {
                            if (accountRes.status === 403) {
                                setProvider('monnify');
                                setKoraError('');
                                return;
                            }
                            const message = accountData?.error || 'Failed to auto-create your KoraPay account.';
                            console.error('[fund-page] Auto create KoraPay account failed:', message);
                            setKoraError(message);
                        } else {
                            setVirtualAccount(accountData.virtualAccount || null);
                        }
                    } else if (!data.virtualAccount && provider === 'squad') {
                        setKoraError('');
                        setShowSquadAccountChoice(true);
                    }
                } else {
                    if (res.status === 403) {
                        setProvider('monnify');
                        setVirtualAccount(null);
                        setKoraError('');
                        return;
                    }
                    const message = data?.error || 'Failed to load your KoraPay account.';
                    console.error('[fund-page] Failed to load KoraPay account:', message);
                    setKoraError(message);
                }
            } catch (error) {
                const message = 'Unable to reach KoraPay account service.';
                console.error('[fund-page] Failed to load KoraPay account', error);
                setKoraError(message);
            } finally {
                setAccountLoading(false);
            }
        };

        loadVirtualAccount();
    }, [provider]);

    useEffect(() => {
        if (provider !== 'korapay') return;
        let cancelled = false;

        const pollPendingCheckouts = async () => {
            try {
                const pendingResponse = await fetch('/api/payments/korapay/checkout/verify', { cache: 'no-store' });
                const pendingData = await pendingResponse.json();
                if (!pendingResponse.ok) throw new Error(pendingData.error || 'Unable to check pending payments.');

                const expiryFallback = Date.now() + 20 * 60 * 1000;
                const attempts = new Map<string, number>();
                for (const item of pendingData.pending || []) {
                    if (item.reference) attempts.set(String(item.reference), Date.parse(item.expiresAt) || expiryFallback);
                }
                const params = new URLSearchParams(window.location.search);
                const returnedReference = params.get('payment') === 'korapay' ? params.get('reference') : null;
                if (returnedReference && !attempts.has(returnedReference)) attempts.set(returnedReference, expiryFallback);
                if (attempts.size === 0) return;

                setCheckoutLoading(true);
                setFundingResult({ type: 'pending', title: 'Checking payment status', message: 'KoraPay is confirming your payment. We will keep checking for up to 20 minutes.' });

                const unresolved = new Set(attempts.keys());
                while (!cancelled && unresolved.size > 0) {
                    const now = Date.now();
                    const references = [...unresolved];
                    const results = await Promise.all(references.map(async (reference) => {
                        const expiresAt = attempts.get(reference) || now;
                        if (now >= expiresAt) return { reference, expired: true as const };
                        try {
                            const response = await fetch('/api/payments/korapay/checkout/verify', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ reference }),
                            });
                            const data = await response.json();
                            if (response.status === 404 || response.status === 403) return { reference, error: data.error || 'Payment reference could not be verified.' };
                            if (!response.ok) return { reference, retry: true as const };
                            if (data.status === 'credited' || data.status === 'duplicate' || data.creditedAmount) return { reference, success: data };
                            if (['failed', 'cancelled'].includes(String(data.status).toLowerCase())) return { reference, failed: data.status };
                            if (String(data.status).toLowerCase() === 'expired') return { reference, expired: true as const };
                            return { reference, retry: true as const };
                        } catch {
                            return { reference, retry: true as const };
                        }
                    }));

                    let keepChecking = false;
                    for (const result of results) {
                        if ('success' in result) {
                            unresolved.delete(result.reference);
                            setFundingResult({ type: 'success', title: 'Wallet funded successfully', message: 'Your payment was verified securely.', grossAmount: Number(result.success.grossAmount), fee: Number(result.success.fee), creditedAmount: Number(result.success.creditedAmount) });
                        } else if ('failed' in result) {
                            unresolved.delete(result.reference);
                            setFundingResult({ type: 'error', title: 'Payment not completed', message: `KoraPay payment status: ${result.failed}.` });
                        } else if ('error' in result) {
                            unresolved.delete(result.reference);
                            setFundingResult({ type: 'error', title: 'Payment could not be verified', message: result.error });
                        } else if ('expired' in result) {
                            unresolved.delete(result.reference);
                            setFundingResult({ type: 'pending', title: 'Payment still processing', message: 'KoraPay has not confirmed this payment within 20 minutes. If your account was debited, its webhook can still update your wallet; contact support with your payment reference if it does not.' });
                        } else {
                            keepChecking = true;
                        }
                    }

                    if (keepChecking && unresolved.size > 0 && !cancelled) {
                        await new Promise((resolve) => window.setTimeout(resolve, 15000));
                    }
                }
            } catch (error) {
                if (!cancelled) setFundingResult({ type: 'error', title: 'Payment status unavailable', message: error instanceof Error ? error.message : 'Unable to check payment status.' });
            } finally {
                if (!cancelled) setCheckoutLoading(false);
            }
        };

        void pollPendingCheckouts();
        return () => { cancelled = true; };
    }, [provider]);

    const startKoraPayCheckout = async () => {
        const checkoutAmount = Math.round(Number(amount));
        if (!Number.isFinite(checkoutAmount) || checkoutAmount < 100) {
            setFundingResult({ type: 'error', title: 'Amount too low', message: 'The minimum one-time funding amount is ₦100.' });
            return;
        }
        setCheckoutLoading(true);
        try {
            const response = await fetch('/api/payments/korapay/checkout/initialize', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ amount: checkoutAmount }),
            });
            const data = await response.json();
            if (!response.ok || !data.checkoutUrl) throw new Error(data.error || 'Unable to start KoraPay checkout.');
            window.location.assign(data.checkoutUrl);
        } catch (error) {
            setFundingResult({ type: 'error', title: 'Checkout could not start', message: error instanceof Error ? error.message : 'Unable to start KoraPay checkout.' });
            setCheckoutLoading(false);
        }
    };

    const closeFundingResult = () => {
        const destination = fundingResult?.type === 'success' ? '/dashboard' : '/dashboard/fund';
        setFundingResult(null);
        router.replace(destination);
        router.refresh();
    };

    const BANK_DETAILS = {
        bankName: 'OPAY',
        accountName: 'HAMMED AMUSAT ORIYOMI',
        accountNumber: '8034295030'
    };
    const MANUAL_PAYMENT_WHATSAPP_NUMBER = '2348034295030';

    const copyToClipboard = async (text: string) => {
        try {
            await navigator.clipboard.writeText(text);
            setAccountCopyStatus('copied');
        } catch {
            setAccountCopyStatus('error');
        }
        window.setTimeout(() => setAccountCopyStatus('idle'), 2000);
    };

    const retryCreateKoraAccount = async (accountMode: 'personal' | 'default' = 'personal') => {
        setAccountLoading(true);
        setKoraError('');
        try {
            const accountRes = await fetch(`/api/payments/${provider}/account`, {
                method: 'POST',
                headers: provider === 'squad' ? { 'Content-Type': 'application/json' } : undefined,
                body: provider === 'squad' ? JSON.stringify({ accountMode, ...(accountMode === 'personal' ? squadCustomerDetails : {}) }) : undefined,
            });
            const accountData = await accountRes.json();

            if (!accountRes.ok) {
                const message = accountData?.error || 'Failed to create KoraPay account.';
                console.error('[fund-page] Manual create KoraPay account failed:', message);
                setKoraError(message);
                return;
            }

            setVirtualAccount(accountData.virtualAccount || null);
            if (provider === 'squad' && accountData.virtualAccount) {
                setSquadAccounts((current) => [
                    ...current.filter((account) => account.account_mode !== accountData.virtualAccount.account_mode),
                    accountData.virtualAccount,
                ]);
            }
            setShowSquadAccountChoice(false);
            setShowSquadDetailsForm(false);
        } catch (error) {
            console.error('[fund-page] Manual create KoraPay account failed', error);
            setKoraError('Unable to create KoraPay account right now.');
        } finally {
            setAccountLoading(false);
        }
    };

    const payWithMonnify = async () => {
        if (!amount || Number(amount) < 100) {
            alert('Minimum funding amount is ₦100');
            return;
        }

        const { data: { user } } = await supabase.auth.getUser();
        if (!user || !user.email) {
            alert('Please login to continue');
            return;
        }

        const email = user.email;
        const name = user.user_metadata?.full_name || 'Valued User';

        // Check Keys - Fixed to properly detect placeholder/missing keys
        if (!MONNIFY_API_KEY || MONNIFY_API_KEY === 'MK_TEST_PLACEHOLDER') {
            alert('Monnify API Key is not configured in .env');
            return;
        }
        if (!CONTRACT_CODE || CONTRACT_CODE === '0000000000') {
            alert('Monnify Contract Code is not configured');
            return;
        }

        if (window.MonnifySDK) {
            setLoading(true);

            // Safety timeout: If SDK doesn't load modal in 10s, stop loading
            const timeoutId = setTimeout(() => {
                setLoading((current) => {
                    if (current) {
                        alert('Payment provider is not responding. Please check your network or API keys.');
                        return false;
                    }
                    return current;
                });
            }, 10000);

            try {
                // Wrap in setTimeout to ensure React state update (setLoading) 
                // has completed and DOM is stable before SDK manipulation
                setTimeout(() => {
                    window.MonnifySDK.initialize({
                        amount: Number(amount),
                        currency: "NGN",
                        reference: '' + Math.floor((Math.random() * 1000000000) + 1),
                        customerFullName: name,
                        customerEmail: email,
                        apiKey: MONNIFY_API_KEY,
                        contractCode: CONTRACT_CODE,
                        paymentDescription: "Wallet Funding",
                        metadata: {
                            name: name,
                        },
                        onLoadStart: () => {
                            console.log("loading has started");
                        },
                        onLoadComplete: () => {
                            console.log("SDK is UP");
                            clearTimeout(timeoutId); // Modal opened, cancel timeout
                            setLoading(false);
                        },
                        onComplete: function (response: any) {
                            // Only proceed if payment was successful
                            if (response.status !== 'SUCCESS' && response.paymentStatus !== 'PAID') {
                                setLoading(false);
                                return;
                            }

                            // Verify on Server - use user ID instead of email to avoid masking issues
                            setLoading(true);

                            fetch('/api/fund/verify', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                    transactionReference: response.transactionReference,
                                    amountPaid: response.amountPaid || response.amount,
                                    userId: user.id, // Use user ID - more reliable than email
                                    paymentStatus: response.paymentStatus
                                })
                            })
                                .then(verifyRes => verifyRes.json().then(data => ({ verifyRes, data })))
                                .then(({ verifyRes, data }) => {
                                    if (!verifyRes.ok) {
                                        throw new Error(data.error || 'Verification failed');
                                    }
                                    alert('Wallet Funded Successfully! New Balance: ₦' + data.newBalance);
                                    router.push('/dashboard');
                                    router.refresh();
                                })
                                .catch((e: any) => {
                                    console.error('Verification error:', e);
                                    alert(`System update error: ${e.message}. If you were already debited, please contact admin with Ref: ${response.transactionReference || 'N/A'}`);
                                })
                                .finally(() => {
                                    setLoading(false);
                                });
                        },
                        onClose: function (data: any) {
                            console.log("Payment closed", data);
                            setLoading(false);
                        }
                    });
                }, 100);
            } catch (err) {
                clearTimeout(timeoutId);
                setLoading(false);
                console.error("Monnify Init Error", err);
                alert("Failed to initialize payment system.");
            }
        } else {
            alert('Payment system loading... check your connection');
        }
    };

    const koraBankDetails = virtualAccount ? {
        bankName: virtualAccount.bank_name || (provider === 'squad' ? 'Squad' : 'KoraPay'),
        accountName: virtualAccount.account_name || (provider === 'squad' ? 'Squad Virtual Account' : 'KoraPay Virtual Account'),
        accountNumber: virtualAccount.account_number || ''
    } : null;

    if (providerLoading || !provider) {
        return <div className="flex min-h-[240px] items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-blue-600" /></div>;
    }

    return (
        <div className="max-w-xl mx-auto space-y-8">
            {fundingResult && (
                <div className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-950/60 px-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="funding-result-title">
                    <div className="w-full max-w-sm overflow-hidden rounded-3xl bg-white shadow-2xl">
                        <div className={`${fundingResult.type === 'success' ? 'bg-emerald-600' : fundingResult.type === 'pending' ? 'bg-sky-700' : 'bg-rose-600'} px-6 py-7 text-center text-white`}>
                            {fundingResult.type === 'success' ? <CheckCircle2 className="mx-auto h-14 w-14" /> : fundingResult.type === 'pending' ? <Loader2 className="mx-auto h-14 w-14 animate-spin" /> : <XCircle className="mx-auto h-14 w-14" />}
                            <h2 id="funding-result-title" className="mt-3 text-xl font-bold">{fundingResult.title}</h2>
                            <p className="mt-1 text-sm text-white/85">{fundingResult.message}</p>
                        </div>
                        {fundingResult.type === 'success' && (
                            <div className="space-y-3 p-6 text-sm">
                                <div className="flex justify-between text-slate-600"><span>Amount paid</span><strong className="text-slate-900">₦{fundingResult.grossAmount?.toLocaleString('en-NG', { minimumFractionDigits: 2 })}</strong></div>
                                <div className="flex justify-between text-slate-600"><span>Payment fee</span><strong className="text-rose-600">- ₦{fundingResult.fee?.toLocaleString('en-NG', { minimumFractionDigits: 2 })}</strong></div>
                                <div className="flex justify-between border-t border-slate-100 pt-3 font-bold text-slate-900"><span>Added to wallet</span><strong className="text-emerald-600">₦{fundingResult.creditedAmount?.toLocaleString('en-NG', { minimumFractionDigits: 2 })}</strong></div>
                            </div>
                        )}
                        <div className="px-6 pb-6">
                            <button type="button" onClick={closeFundingResult} className="w-full rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white hover:bg-slate-800">Close</button>
                        </div>
                    </div>
                </div>
            )}
            {showSquadAccountChoice && provider === 'squad' && (
                <div className="fixed inset-0 z-[120] flex items-center justify-center overflow-y-auto bg-slate-950/60 px-4 py-6 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="squad-account-choice-title">
                    <div className="my-auto w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl">
                        <div className="border-b border-slate-200 px-6 py-5">
                            <h2 id="squad-account-choice-title" className="text-lg font-bold text-slate-900">Choose your virtual account</h2>
                            <p className="mt-1 text-sm text-slate-600">Each option creates an account with its own account number.</p>
                        </div>
                        <div className="space-y-4 px-6 py-5">
                            {koraError && <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{koraError}</p>}
                            <button type="button" onClick={() => { setShowSquadAccountChoice(false); setShowSquadDetailsForm(true); }} disabled={accountLoading} className="w-full rounded-xl border border-slate-200 p-4 text-left transition-colors hover:border-sky-500 hover:bg-sky-50 disabled:opacity-60">
                                <span className="block font-semibold text-slate-900">Personal account</span>
                                <span className="mt-1 block text-sm leading-5 text-slate-600">Created with your own verified identity. No Medersub daily cap; Squad, bank, and regulatory limits still apply.</span>
                            </button>
                            <button type="button" onClick={() => void retryCreateKoraAccount('default')} disabled={!squadConfiguredDefaults.defaultAccountReady || accountLoading} className="w-full rounded-xl border border-slate-200 p-4 text-left transition-colors hover:border-sky-500 hover:bg-sky-50 disabled:cursor-not-allowed disabled:opacity-60">
                                <span className="block font-semibold text-slate-900">Default account · ₦10,000/day</span>
                                <span className="mt-1 block text-sm leading-5 text-slate-600">Created using the configured default customer profile. Deposits above the daily cap are held for review, not immediately credited.</span>
                                {!squadConfiguredDefaults.defaultAccountReady && <span className="mt-2 block text-xs font-medium text-amber-800">Unavailable until all six SQUAD_DEFAULT_* values are configured on the server.</span>}
                                {accountLoading && <span className="mt-2 flex items-center gap-2 text-xs font-semibold text-sky-800"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Creating account…</span>}
                            </button>
                        </div>
                        <div className="flex justify-end border-t border-slate-200 bg-slate-50 px-6 py-4">
                            <button type="button" onClick={() => setShowSquadAccountChoice(false)} disabled={accountLoading} className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-white disabled:opacity-60">Cancel</button>
                        </div>
                    </div>
                </div>
            )}
            {showSquadDetailsForm && provider === 'squad' && (
                <div className="fixed inset-0 z-[120] flex items-center justify-center overflow-y-auto bg-slate-950/60 px-4 py-6 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="squad-details-title">
                    <form onSubmit={(event) => { event.preventDefault(); void retryCreateKoraAccount(); }} className="my-auto w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl">
                        <div className="border-b border-slate-200 px-6 py-5">
                            <div className="flex items-start justify-between gap-4">
                                <div>
                                    <h2 id="squad-details-title" className="text-lg font-bold text-slate-900">Create your personal account</h2>
                                    <p className="mt-1 text-sm text-slate-600">Squad verifies these details against your BVN record.</p>
                                </div>
                                <button type="button" onClick={() => setShowSquadDetailsForm(false)} aria-label="Close form" className="rounded-md px-2 py-1 text-sm font-semibold text-slate-500 hover:bg-slate-100 hover:text-slate-900">Close</button>
                            </div>
                        </div>
                        <div className="max-h-[65vh] space-y-4 overflow-y-auto px-6 py-5">
                            {koraError && <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{koraError}</p>}
                            <label className="block text-sm font-medium text-slate-700">Full legal name<input autoComplete="name" value={squadCustomerDetails.fullName} onChange={(event) => setSquadCustomerDetails({ ...squadCustomerDetails, fullName: event.target.value })} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-slate-900 focus:border-sky-600 focus:outline-none focus:ring-2 focus:ring-sky-100" required /></label>
                            <div className="grid gap-4 sm:grid-cols-2">
                                <label className="block text-sm font-medium text-slate-700">BVN<input inputMode="numeric" autoComplete="off" maxLength={11} value={squadCustomerDetails.bvn} onChange={(event) => setSquadCustomerDetails({ ...squadCustomerDetails, bvn: event.target.value.replace(/\D/g, '').slice(0, 11) })} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-slate-900 focus:border-sky-600 focus:outline-none focus:ring-2 focus:ring-sky-100" placeholder="11 digits" required /></label>
                                <label className="block text-sm font-medium text-slate-700">Phone number<input type="tel" inputMode="numeric" autoComplete="tel" maxLength={11} value={squadCustomerDetails.mobileNumber} onChange={(event) => setSquadCustomerDetails({ ...squadCustomerDetails, mobileNumber: event.target.value.replace(/\D/g, '').slice(0, 11) })} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-slate-900 focus:border-sky-600 focus:outline-none focus:ring-2 focus:ring-sky-100" placeholder="08012345678" required /></label>
                            </div>
                            <div className="grid gap-4 sm:grid-cols-2">
                                <label className="block text-sm font-medium text-slate-700">Date of birth<input type="date" value={squadCustomerDetails.dateOfBirth} onChange={(event) => setSquadCustomerDetails({ ...squadCustomerDetails, dateOfBirth: event.target.value })} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-slate-900 focus:border-sky-600 focus:outline-none focus:ring-2 focus:ring-sky-100" required /></label>
                                <label className="block text-sm font-medium text-slate-700">Gender<select value={squadCustomerDetails.gender} onChange={(event) => setSquadCustomerDetails({ ...squadCustomerDetails, gender: event.target.value })} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-slate-900 focus:border-sky-600 focus:outline-none focus:ring-2 focus:ring-sky-100" required><option value="">Select gender</option><option value="1">Male</option><option value="2">Female</option></select></label>
                            </div>
                            <label className="block text-sm font-medium text-slate-700">Residential address<textarea autoComplete="street-address" value={squadCustomerDetails.address} onChange={(event) => setSquadCustomerDetails({ ...squadCustomerDetails, address: event.target.value })} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-slate-900 focus:border-sky-600 focus:outline-none focus:ring-2 focus:ring-sky-100" rows={3} required /></label>
                        </div>
                        <div className="flex flex-col-reverse gap-3 border-t border-slate-200 bg-slate-50 px-6 py-4 sm:flex-row sm:justify-end">
                            <button type="button" onClick={() => setShowSquadDetailsForm(false)} className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-white">Cancel</button>
                            <button type="submit" disabled={accountLoading} className="inline-flex items-center justify-center gap-2 rounded-lg bg-sky-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-sky-800 disabled:cursor-not-allowed disabled:opacity-60">
                                {accountLoading && <Loader2 className="h-4 w-4 animate-spin" />}
                                {accountLoading ? 'Creating account...' : 'Create virtual account'}
                            </button>
                        </div>
                    </form>
                </div>
            )}
            {/* Script with onLoad to confirm it loaded */}
            <Script
                src="https://sdk.monnify.com/plugin/monnify.js"
                strategy="afterInteractive"
                onLoad={() => console.log('Monnify SDK Script Loaded')}
                onError={(e) => alert('Failed to load Monnify Script. Check your connection.')}
            />

            <div className="flex items-center gap-4">
                <Link href="/dashboard" className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                    <ArrowLeft className="h-5 w-5 text-gray-600" />
                </Link>
                <h1 className="text-xl font-bold text-gray-900">Fund Wallet</h1>
                <div><h1 className="text-2xl  font-bold text-blue-600 tracking-tight">MEDERSUB</h1></div>
            </div>

            {/* Online Payment Card */}
            {(provider === 'korapay' || provider === 'squad') ? (
                <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
                    {provider === 'korapay' && <><h2 className="text-lg font-bold text-gray-900 mb-4">One-time funding</h2>
                    <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                        A 1.6% payment fee applies to one-time online funding and is deducted before the remaining amount is added to your wallet. For ₦ 0.00 fees, use the manual transfer option below.
                    </div>
                    <div className="mb-6 space-y-3">
                        <input type="number" min="100" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="Amount (₦)" className="w-full p-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 outline-none" />
                        <button type="button" onClick={startKoraPayCheckout} disabled={checkoutLoading} className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg disabled:opacity-60">
                            {checkoutLoading ? 'Opening checkout...' : 'Fund once with KoraPay'}
                        </button>
                    </div>
                    </>}<h2 className="text-lg font-bold text-gray-900 mb-4">Virtual Account</h2>
                    {!hasBvn && provider === 'korapay' && (
                        <div className='mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900'>
                            <p className='font-semibold'>Your daily transfer limit is ₦5,000.</p>
                            <p className='mt-1'>Add your BVN to remove this limit.</p>
                            <Link href='/dashboard/settings' className='mt-2 inline-flex rounded-md bg-amber-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-800'>
                                Add your BVN
                            </Link>
                        </div>
                    )}
                    {accountLoading ? (
                        <div className="flex items-center gap-2 text-sm text-gray-500"><Loader2 className="h-4 w-4 animate-spin" /> Loading your virtual account...</div>
                    ) : koraBankDetails ? (
                        <div className="space-y-3 text-sm">
                            {provider === 'squad' && squadAccounts.length > 1 && (
                                <div className="flex flex-wrap gap-2" aria-label="Choose account">
                                    {squadAccounts.map((account) => (
                                        <button key={account.id} type="button" onClick={() => setVirtualAccount(account)} aria-pressed={virtualAccount.id === account.id} className={`rounded-lg border px-3 py-2 text-xs font-semibold ${virtualAccount.id === account.id ? 'border-sky-700 bg-sky-50 text-sky-900' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                                            {account.account_mode === 'default' ? 'Default · ₦10k/day' : 'Personal'}
                                        </button>
                                    ))}
                                </div>
                            )}
                            <div><span className="text-gray-500">Bank:</span> <span className="font-semibold">{koraBankDetails.bankName}</span></div>
                            <div><span className="text-gray-500">Account Name:</span> <span className="font-semibold">{koraBankDetails.accountName}</span></div>
                            <div className="flex items-center justify-between gap-3">
                                <div className="min-w-0"><span className="text-gray-500">Account Number:</span> <span className="break-all text-lg font-semibold">{koraBankDetails.accountNumber}</span></div>
                                <button type="button" onClick={() => void copyToClipboard(koraBankDetails.accountNumber)} aria-label="Copy account number" title="Copy account number" className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-sky-500">
                                    {accountCopyStatus === 'copied' ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
                                    {accountCopyStatus === 'copied' ? 'Copied' : 'Copy'}
                                </button>
                            </div>
                            {accountCopyStatus === 'error' && <p role="status" className="text-xs text-rose-700">Could not copy automatically. Select and copy the account number.</p>}
                            {provider === 'squad' && virtualAccount.account_mode === 'default' && <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-amber-900">Default account limit: ₦{Number(virtualAccount.daily_limit || 10000).toLocaleString('en-NG')} credited per day. Deposits above the limit are held for review.</div>}
                            {provider === 'squad' && virtualAccount.account_mode === 'personal' && <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-emerald-900">Personal account. No Medersub daily funding cap; Squad and bank limits still apply.</div>}
                            {provider === 'squad' && <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-slate-700">{squadDepositFee > 0 ? `A ₦${squadDepositFee.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} fee is deducted from each deposit before wallet credit.` : 'No additional Medersub fee is deducted from Squad deposits.'}</div>}
                            <div className="text-xs text-amber-700 bg-amber-50 p-3 rounded-lg">Fund this account from your bank app; and our system will credit your wallet once verified.</div>
                            {provider === 'squad' && virtualAccount.account_mode === 'default' && !squadAccounts.some((account) => account.account_mode === 'personal') && (
                                <button type="button" onClick={() => { setKoraError(''); setShowSquadDetailsForm(true); }} className="w-full rounded-lg border border-sky-700 px-4 py-3 text-sm font-semibold text-sky-800 hover:bg-sky-50">Create personal account</button>
                            )}
                        </div>
                    ) : (
                        <div className="space-y-3">
                            <div className="text-sm text-red-600">No virtual account is available yet.</div>
                            {koraError ? (
                                <div className="text-xs bg-red-50 border border-red-200 text-red-700 rounded-lg p-3">{koraError}</div>
                            ) : null}
                            {provider === 'squad' ? (
                                <div className="space-y-3">
                                    {!hasBvn && <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">A personal account requires your own valid BVN. You can choose the configured default account if it is available.</div>}
                                    <button type="button" onClick={() => setShowSquadAccountChoice(true)} className="w-full rounded-lg bg-blue-600 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-700">Choose account type</button>
                                </div>
                            ) : (
                                <button onClick={retryCreateKoraAccount} disabled={accountLoading} className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 disabled:opacity-60">
                                    Retry Account Creation
                                </button>
                            )}
                        </div>
                    )}
                </div>
            ) : provider === 'monnify' ? (
                <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
                    <h2 className="text-lg font-bold text-gray-900 mb-4">Instant Funding</h2>
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Amount (₦)</label>
                            <input
                                type="number"
                                value={amount}
                                onChange={(e) => setAmount(e.target.value)}
                                placeholder="e.g. 1000"
                                className="w-full p-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 outline-none"
                            />
                        </div>

                        <div className="bg-amber-50 rounded-lg p-3 space-y-2">
                            <p className="text-[10px] text-amber-700 leading-tight">
                                Note: Instant funding via Monnify attracts a flat fee of **₦50**.
                            </p>
                            <p className="text-[10px] text-amber-700 leading-tight">
                                Tip: You can use **Bank Transfer** (below) with **0 charges** for amounts less than ₦10,000.
                            </p>
                        </div>

                        <button
                            onClick={payWithMonnify}
                            disabled={loading}
                            className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg transition-colors flex items-center justify-center gap-2"
                        >
                            {loading ? 'Processing...' : 'Pay with Monnify'}
                        </button>
                        <p className="text-xs text-center text-gray-400 flex items-center justify-center gap-1">
                            <ShieldCheck className="h-3 w-3" /> Secured by Monnify
                        </p>
                    </div>
                </div>
            ) : (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-amber-950 shadow-sm">
                    <h2 className="text-lg font-bold">Manual funding only</h2>
                    <p className="mt-2 text-sm">Online payment is currently unavailable. Make a transfer to the manual account below and notify the admin with your payment proof.</p>
                </div>
            )}

            

             {/* Manual Transfer Card */}
            <div className="bg-green-700 rounded-4xl p-2 text-white shadow-xl relative overflow-hidden">
                <div className="absolute top-0 right-0 -mt-4 -mr-4 w-32 h-32 bg-blue-500 rounded-full opacity-50 blur-2xl"></div>
                <div className="relative z-10 text-center">
                    <p className="text-blue-100 mb-2 font-medium">Manual Transfer Details</p>
                    <p className="mx-auto mb-4 inline-flex rounded-full bg-white/20 px-4 py-1.5 text-sm font-bold text-white">0 fees on manual transfer</p>
                    <h2 className="text-3xl font-bold mb-1">{BANK_DETAILS.accountNumber}</h2>
                    <p className="text-blue-200 text-sm"> {BANK_DETAILS.bankName}</p>
                    <p className="text-blue-200 text-sm mb-6"> {BANK_DETAILS.accountName}</p>

                    {((BANK_DETAILS.accountNumber)) && (
                        <button
                            onClick={() => copyToClipboard(BANK_DETAILS.accountNumber)}
                            className="bg-white/20 hover:bg-white/30 backdrop-blur-sm border border-white/30 text-white px-6 py-2 rounded-full text-sm font-semibold flex items-center gap-2 mx-auto transition-all"
                        >
                            <Copy className="h-4 w-4" /> Copy Number
                        </button>
                    )}
                </div>
                <div className="p-4 text-xs ">
                    <p className='text-red-400 text-sm font-bold'>Tip: Bank transfers to the this account are manual and may take time. Please click the below button to notify the Admin.</p>

<a
                        href={`https://wa.me/${MANUAL_PAYMENT_WHATSAPP_NUMBER}?text=${encodeURIComponent(`Hi, I have made a manual transfer to ${BANK_DETAILS.accountNumber}. I am sending my payment screenshot for confirmation.`)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-3 inline-flex items-center gap-2 rounded-full bg-white/20 px-4 py-2 text-xs font-semibold text-red-300 hover:bg-white/30"
                    >
                        <MessageCircle className="h-4 w-4" />
                        Click Here to Notify the Admin on WhatsApp
                    </a>
                    <p className="mt-2 text-green-100">After payment, send a screenshot of your transfer to WhatsApp for confirmation.</p>
                    <a
                        href={`https://wa.me/${MANUAL_PAYMENT_WHATSAPP_NUMBER}?text=${encodeURIComponent(`Hi, I have made a manual transfer to ${BANK_DETAILS.accountNumber}. I am sending my payment screenshot for confirmation.`)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-3 inline-flex items-center gap-2 rounded-full bg-white/20 px-4 py-2 text-xs font-semibold text-white hover:bg-white/30"
                    >
                        <MessageCircle className="h-4 w-4" />
                        Send Screenshot on WhatsApp
                    </a>
                </div>
            </div>

            

        </div>
    );
}
