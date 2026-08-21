'use client';
import { useState, useEffect } from 'react';
import { Copy, CreditCard, ArrowLeft, ShieldCheck, HelpCircle, Loader2 } from 'lucide-react';
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
    const [provider, setProvider] = useState<'monnify' | 'korapay'>('korapay');
    const [virtualAccount, setVirtualAccount] = useState<any>(null);
    const [accountLoading, setAccountLoading] = useState(false);
    const [koraError, setKoraError] = useState<string>('');
    const [hasBvn, setHasBvn] = useState(true);

    // Config - Should be in ENV used by component or public constant
    const MONNIFY_API_KEY = process.env.NEXT_PUBLIC_MONNIFY_API_KEY || 'MK_TEST_PLACEHOLDER';
    const CONTRACT_CODE = process.env.NEXT_PUBLIC_MONNIFY_CONTRACT_CODE || '0000000000';

    useEffect(() => {
        const loadProvider = async () => {
            try {
                const res = await fetch('/api/admin/settings');
                if (res.ok) await res.json();
                setProvider('korapay');
            } catch (err) {
                console.error('Failed to load payment provider', err);
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
                const res = await fetch('/api/payments/korapay/account');
                const data = await res.json();
                if (res.ok) {
                    setVirtualAccount(data.virtualAccount || null);
                    setHasBvn(Boolean(data.hasBvn));
                    if (!data.virtualAccount) {
                        const accountRes = await fetch('/api/payments/korapay/account', { method: 'POST' });
                        const accountData = await accountRes.json();

                        if (!accountRes.ok) {
                            const message = accountData?.error || 'Failed to auto-create your KoraPay account.';
                            console.error('[fund-page] Auto create KoraPay account failed:', message);
                            setKoraError(message);
                        } else {
                            setVirtualAccount(accountData.virtualAccount || null);
                        }
                    }
                } else {
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

    const BANK_DETAILS = {
        bankName: 'OPAY',
        accountName: 'HAMMED AMUSAT ORIYOMI',
        accountNumber: '8034295030'
    };

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

    return (
        <div className="max-w-xl mx-auto space-y-8">
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
            ) : (
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
            )}

            
            <div className="bg-blue-700 rounded-4xl p-2 text-white shadow-xl relative overflow-hidden">
                <div className="absolute top-0 right-0 -mt-4 -mr-4 w-32 h-32 bg-blue-500 rounded-full opacity-50 blur-2xl"></div>
                <div className="relative z-10 text-center">
                    <p className="text-blue-100 mb-2 font-medium">{provider === 'korapay' ? 'Instant Transfer Details' : 'Alternative: Bank Transfer'}</p>
                    <h2 className="text-3xl font-bold mb-1">{(provider === 'korapay' ? koraBankDetails?.accountNumber : BANK_DETAILS.accountNumber) || 'Loading...'}</h2>
                    <p className="text-blue-200 text-sm">{provider === 'korapay' ? koraBankDetails?.bankName : BANK_DETAILS.bankName}</p>
                    <p className="text-blue-200 text-sm mb-6">{provider === 'korapay' ? koraBankDetails?.accountName : BANK_DETAILS.accountName}</p>

                    {((provider === 'korapay' ? koraBankDetails?.accountNumber : BANK_DETAILS.accountNumber)) && (
                        <button
                            onClick={() => copyToClipboard(provider === 'korapay' && koraBankDetails ? koraBankDetails.accountNumber : BANK_DETAILS.accountNumber)}
                            className="bg-white/20 hover:bg-white/30 backdrop-blur-sm border border-white/30 text-white px-6 py-2 rounded-full text-sm font-semibold flex items-center gap-2 mx-auto transition-all"
                        >
                            <Copy className="h-4 w-4" /> Copy Number
                        </button>
                    )}
                </div>
            </div>

             {/* Manual Transfer Card */}
            <div className="bg-green-700 rounded-4xl p-2 text-white shadow-xl relative overflow-hidden">
                <div className="absolute top-0 right-0 -mt-4 -mr-4 w-32 h-32 bg-blue-500 rounded-full opacity-50 blur-2xl"></div>
                <div className="relative z-10 text-center">
                    <p className="text-blue-100 mb-2 font-medium">Manual Transfer Details</p>
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
                Tip: Bank transfers to the above account are manual and may take time. Use the "Instant Funding" option for immediate credit.
            </div>
            </div>

            

        </div>
    );
}
