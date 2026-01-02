'use client';
import { useState } from 'react';
import { Copy, CreditCard, ArrowLeft, ShieldCheck, HelpCircle } from 'lucide-react';
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

    // Config - Should be in ENV used by component or public constant
    const MONNIFY_API_KEY = process.env.NEXT_PUBLIC_MONNIFY_API_KEY || 'MK_TEST_PLACEHOLDER';
    const CONTRACT_CODE = process.env.NEXT_PUBLIC_MONNIFY_CONTRACT_CODE || '0000000000';


    const BANK_DETAILS = {
        bankName: 'OPAY',
        accountName: 'HAMMED AMUSAT ORIYOMI',
        accountNumber: '8034295030'
    };

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
        alert('Account number copied!');
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

            {/* Manual Transfer Card */}
            <div className="bg-blue-600 rounded-2xl p-6 text-white shadow-xl relative overflow-hidden">
                <div className="absolute top-0 right-0 -mt-4 -mr-4 w-32 h-32 bg-blue-500 rounded-full opacity-50 blur-2xl"></div>
                <div className="relative z-10 text-center">
                    <p className="text-blue-100 mb-2 font-medium">Alternative: Bank Transfer</p>
                    <h2 className="text-3xl font-bold mb-1">{BANK_DETAILS.accountNumber}</h2>
                    <p className="text-blue-200 text-sm">{BANK_DETAILS.bankName}</p>
                    <p className="text-blue-200 text-sm mb-6">{BANK_DETAILS.accountName}</p>

                    <button
                        onClick={() => copyToClipboard(BANK_DETAILS.accountNumber)}
                        className="bg-white/20 hover:bg-white/30 backdrop-blur-sm border border-white/30 text-white px-6 py-2 rounded-full text-sm font-semibold flex items-center gap-2 mx-auto transition-all"
                    >
                        <Copy className="h-4 w-4" /> Copy Number
                    </button>
                </div>
            </div>

            <div className="p-4 bg-gray-50 rounded-lg text-xs text-gray-500">
                Tip: Bank transfers to the above account are manual and may take time. Use the "Instant Funding" option for immediate credit.
            </div>

        </div>
    );
}
