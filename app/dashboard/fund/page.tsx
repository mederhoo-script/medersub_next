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
    const [provider, setProvider] = useState<'monnify' | 'korapay' | 'none' | null>(null);
    const [providerLoading, setProviderLoading] = useState(true);
    const [virtualAccount, setVirtualAccount] = useState<any>(null);
    const [accountLoading, setAccountLoading] = useState(false);
    const [koraError, setKoraError] = useState<string>('');
    const [hasBvn, setHasBvn] = useState(true);
    const [checkoutLoading, setCheckoutLoading] = useState(false);
    const [fundingResult, setFundingResult] = useState<{ type: 'success' | 'error'; title: string; message: string; grossAmount?: number; fee?: number; creditedAmount?: number } | null>(null);

    // Config - Should be in ENV used by component or public constant
    const MONNIFY_API_KEY = process.env.NEXT_PUBLIC_MONNIFY_API_KEY || 'MK_TEST_PLACEHOLDER';
    const CONTRACT_CODE = process.env.NEXT_PUBLIC_MONNIFY_CONTRACT_CODE || '0000000000';

    useEffect(() => {
        const loadProvider = async () => {
            try {
                const res = await fetch('/api/payments/provider', { cache: 'no-store' });
                if (res.ok) {
                    const settings = await res.json();
                    setProvider(settings.payment_provider === 'korapay' ? 'korapay' : settings.payment_provider === 'none' ? 'none' : 'monnify');
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
        if (provider !== 'korapay') return;

        const loadVirtualAccount = async () => {
            setAccountLoading(true);
            setKoraError('');
            try {
                const res = await fetch('/api/payments/korapay/account', { cache: 'no-store' });
                const data = await res.json();
                if (res.ok) {
                    setVirtualAccount(data.virtualAccount || null);
                    setHasBvn(Boolean(data.hasBvn));
                    if (!data.virtualAccount) {
                        const accountRes = await fetch('/api/payments/korapay/account', { method: 'POST', cache: 'no-store' });
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
        const params = new URLSearchParams(window.location.search);
        const reference = params.get('reference');
        if (params.get('payment') !== 'korapay' || !reference) return;

        const verifyCheckout = async () => {
            setCheckoutLoading(true);
            try {
                const response = await fetch('/api/payments/korapay/checkout/verify', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ reference }),
                });
                const data = await response.json();
                if (!response.ok) throw new Error(data.error || 'Payment verification failed.');
                if (data.status === 'credited' || data.status === 'duplicate' || data.creditedAmount) {
                    setFundingResult({ type: 'success', title: 'Wallet funded successfully', message: 'Your payment was verified securely.', grossAmount: Number(data.grossAmount), fee: Number(data.fee), creditedAmount: Number(data.creditedAmount) });
                } else {
                    setFundingResult({ type: 'error', title: 'Payment not completed', message: `Payment status: ${data.status || 'pending'}.` });
                }
            } catch (error) {
                setFundingResult({ type: 'error', title: 'Funding verification failed', message: error instanceof Error ? error.message : 'Payment verification failed.' });
            } finally {
                setCheckoutLoading(false);
            }
        };

        void verifyCheckout();
    }, [router]);

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

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
        alert('Account number copied!');
    };

    const retryCreateKoraAccount = async () => {
        setAccountLoading(true);
        setKoraError('');
        try {
            const accountRes = await fetch('/api/payments/korapay/account', { method: 'POST' });
            const accountData = await accountRes.json();

            if (!accountRes.ok) {
                const message = accountData?.error || 'Failed to create KoraPay account.';
                console.error('[fund-page] Manual create KoraPay account failed:', message);
                setKoraError(message);
                return;
            }

            setVirtualAccount(accountData.virtualAccount || null);
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
        bankName: virtualAccount.bank_name || 'KoraPay',
        accountName: virtualAccount.account_name || 'KoraPay Virtual Account',
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
                        <div className={`${fundingResult.type === 'success' ? 'bg-emerald-600' : 'bg-rose-600'} px-6 py-7 text-center text-white`}>
                            {fundingResult.type === 'success' ? <CheckCircle2 className="mx-auto h-14 w-14" /> : <XCircle className="mx-auto h-14 w-14" />}
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
            {provider === 'korapay' ? (
                <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
                    <h2 className="text-lg font-bold text-gray-900 mb-4">One-time funding</h2>
                    <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                        A 1.6% payment fee applies to one-time online funding and is deducted before the remaining amount is added to your wallet. For ₦ 0.00 fees, use the manual transfer option below.
                    </div>
                    <div className="mb-6 space-y-3">
                        <input type="number" min="100" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="Amount (₦)" className="w-full p-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 outline-none" />
                        <button type="button" onClick={startKoraPayCheckout} disabled={checkoutLoading} className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg disabled:opacity-60">
                            {checkoutLoading ? 'Opening checkout...' : 'Fund once with KoraPay'}
                        </button>
                    </div>
                    <h2 className="text-lg font-bold text-gray-900 mb-4">Virtual Account</h2>
                    {!hasBvn && (
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
                            <div><span className="text-gray-500">Bank:</span> <span className="font-semibold">{koraBankDetails.bankName}</span></div>
                            <div><span className="text-gray-500">Account Name:</span> <span className="font-semibold">{koraBankDetails.accountName}</span></div>
                            <div><span className="text-gray-500">Account Number:</span> <span className="font-semibold text-lg">{koraBankDetails.accountNumber}</span></div>
                            <div className="text-xs text-amber-700 bg-amber-50 p-3 rounded-lg">Fund this account from your bank app; and our system will credit your wallet once verified.</div>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            <div className="text-sm text-red-600">No KoraPay account is available yet.</div>
                            {koraError ? (
                                <div className="text-xs bg-red-50 border border-red-200 text-red-700 rounded-lg p-3">{koraError}</div>
                            ) : null}
                            <button
                                onClick={retryCreateKoraAccount}
                                disabled={accountLoading}
                                className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 disabled:opacity-60"
                            >
                                Retry Account Creation
                            </button>
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
