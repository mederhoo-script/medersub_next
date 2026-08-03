'use client';
import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Smartphone, Loader2, ArrowLeft, Fingerprint, AlertTriangle } from 'lucide-react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import SpendingBalances from '@/components/dashboard/spending-balances';
import { useDefaultPaymentSource } from '@/components/dashboard/use-default-payment-source';
import { useTransactionPin } from '@/components/dashboard/use-transaction-pin';

const NETWORKS = [
    { id: 'MTN', name: 'MTN', color: 'bg-yellow-400', serviceId: '1' },
    { id: 'AIRTEL', name: 'Airtel', color: 'bg-red-500', serviceId: '4' },
    { id: 'GLO', name: 'Glo', color: 'bg-green-500', serviceId: '2' },
    { id: '9MOBILE', name: '9mobile', color: 'bg-green-700', serviceId: '3' },
];

export default function AirtimePage() {
    const { requestPin, requestBiometricApproval, PinDialog, biometricSupported, biometricSupportMessage } = useTransactionPin();
    const router = useRouter();
    const [network, setNetwork] = useState(NETWORKS[0]);
    const [amount, setAmount] = useState('');
    const [phone, setPhone] = useState('');
    const { paymentSource, setPaymentSource } = useDefaultPaymentSource();
    const [loading, setLoading] = useState(false);
    const [status, setStatus] = useState<{ type: 'success' | 'error', msg: string } | null>(null);

    // Calculate discounted amount
    const getDiscountedAmount = (amt: string, netId: string) => {
        const val = Number(amt);
        if (!val) return 0;

        let discountPercent = 0;
        if (netId === 'MTN' || netId === 'AIRTEL') {
            discountPercent = 0.01; // 1%
        } else {
            discountPercent = 0.02; // 2%
        }

        return val - (val * discountPercent);
    };

    const toPay = getDiscountedAmount(amount, network.id);

    const submitPurchase = async (approvalType: 'pin' | 'biometric') => {
        setLoading(true);
        setStatus(null);

        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                router.push('/login');
                return;
            }

            const body: Record<string, unknown> = {
                userId: user.id,
                serviceType: 'AIRTIME',
                amount: Number(amount),
                mobileNumber: phone,
                serviceID: network.serviceId,
                network: network.id,
                paymentSource,
            };

            if (approvalType === 'biometric') {
                const biometricToken = await requestBiometricApproval();
                if (!biometricToken) {
                    setStatus({ type: 'error', msg: 'Fingerprint approval was cancelled.' });
                    return;
                }
                body.biometricToken = biometricToken;
            } else {
                const transactionPin = await requestPin();
                if (!transactionPin) {
                    setStatus({ type: 'error', msg: 'Transaction PIN is required.' });
                    return;
                }
                body.transactionPin = transactionPin;
            }

            const res = await fetch('/api/purchase', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });

            const data = await res.json();

            if (data.error) {
                setStatus({ type: 'error', msg: data.error });
            } else {
                setStatus({ type: 'success', msg: 'Airtime purchase successful!' });
                setAmount('');
                setPhone('');
                router.refresh();
            }

        } catch (error) {
            const message = error instanceof Error ? error.message : 'Something went wrong.';
            setStatus({ type: 'error', msg: message });
        } finally {
            setLoading(false);
        }
    };

    const handlePurchase = async (e: React.FormEvent) => {
        e.preventDefault();
        await submitPurchase('pin');
    };

    const handleBiometricPurchase = async (e: React.MouseEvent<HTMLButtonElement>) => {
        e.preventDefault();
        await submitPurchase('biometric');
    };

    return (
        <div className="max-w-md mx-auto">
            <div className="flex items-center gap-4 mb-6">
                <Link href="/dashboard" className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                    <ArrowLeft className="h-5 w-5 text-gray-600" />
                </Link>
                <h1 className="text-xl font-bold text-gray-900">Buy Airtime</h1>
                <h1 className="text-2xl  font-bold text-blue-600 tracking-tight">MEDERSUB</h1>
            </div>


            <div className="mb-4 flex gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
                <p>
                    Please, don&apos;t send Airtel Awoof and Gifting to any number owing Airtel. It will not deliver and you will not be refunded. Thank you for choosing MEDERSUB.
                </p>
            </div>

            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                <form onSubmit={handlePurchase} className="space-y-6">

                    {/* Network Selection */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Select Network</label>
                        <div className="grid grid-cols-4 gap-3">
                            {NETWORKS.map((net) => (
                                <button
                                    key={net.id}
                                    type="button"
                                    onClick={() => setNetwork(net)}
                                    className={`flex flex-col items-center p-3 rounded-xl border-2 transition-all ${network.id === net.id
                                        ? 'border-blue-600 bg-blue-50'
                                        : 'border-transparent bg-gray-50 hover:bg-gray-100'
                                        }`}
                                >
                                    <div className={`h-8 w-8 rounded-full ${net.color} mb-2`} />
                                    <span className="text-xs font-semibold">{net.name}</span>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Phone Number */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Phone Number</label>
                        <div className="relative">
                            <Smartphone className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                            <input
                                type="tel"
                                required
                                value={phone}
                                onChange={(e) => setPhone(e.target.value)}
                                className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                placeholder="08012345678"
                            />
                        </div>
                    </div>

                    {/* Amount */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Amount (₦)</label>
                        <input
                            type="number"
                            required
                            min="50"
                            value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                            className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 text-lg font-semibold"
                            placeholder="1000"
                        />
                        {amount && (
                            <div className="mt-2 text-right">
                                <span className="text-sm text-gray-500">You pay: </span>
                                <span className="text-lg font-bold text-green-600">₦{toPay.toFixed(2)}</span>
                            </div>
                        )}
                        <div className="flex gap-2 mt-2">
                            {['100', '200', '500', '1000'].map((amt) => (
                                <button
                                    type="button"
                                    key={amt}
                                    onClick={() => setAmount(amt)}
                                    className="px-3 py-1 text-xs font-medium bg-gray-100 hover:bg-gray-200 rounded-full text-gray-600 transition-colors"
                                >
                                    ₦{amt}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Payment Source</label>
                        <SpendingBalances paymentSource={paymentSource} />
                        <select
                            value={paymentSource}
                            onChange={(e) => setPaymentSource(e.target.value as 'wallet' | 'reward')}
                            className="w-full mt-2 px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                        >
                            <option value="wallet">Main Wallet</option>
                            <option value="reward">Reward Balance</option>
                        </select>
                    </div>

                    {status && (
                        <div className={`p-4 rounded-xl text-sm ${status.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                            {status.msg}
                        </div>
                    )}

                    <div className="flex gap-3">
                        <button
                            type="submit"
                            disabled={loading}
                            className="flex-1 py-4 bg-blue-600 text-white rounded-xl font-bold text-lg hover:bg-blue-700 transition-colors disabled:opacity-70 flex items-center justify-center gap-2"
                        >
                            {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : `Pay ₦${toPay > 0 ? toPay.toFixed(2) : '0.00'}`}
                        </button>
                        <button
                            type="button"
                            onClick={handleBiometricPurchase}
                            disabled={loading || !biometricSupported}
                            className={`shrink-0 inline-flex h-14 w-14 items-center justify-center rounded-xl border ${biometricSupported ? 'border-blue-200 bg-blue-50 text-blue-600 hover:bg-blue-100' : 'border-gray-200 bg-gray-100 text-gray-400'} transition-colors disabled:opacity-70`}
                            aria-label="Use fingerprint to pay"
                            title={biometricSupported ? 'Use fingerprint to pay' : biometricSupportMessage || 'Fingerprint not available'}
                        >
                            <Fingerprint className="h-5 w-5" />
                        </button>
                    </div>
                    {!biometricSupported && biometricSupportMessage && (
                        <p className="mt-2 text-xs text-gray-500">{biometricSupportMessage}</p>
                    )}
                </form>
            </div>
            {PinDialog}
        </div>
    );
}
