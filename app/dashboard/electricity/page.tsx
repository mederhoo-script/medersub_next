'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Zap, Loader2, ArrowLeft, CheckCircle2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

// Static fallbacks just in case, or initial state structure
// Real app fetches from /api/services
const METER_TYPES = [
    { id: 1, name: 'Prepaid' },
    { id: 2, name: 'Postpaid' }
];

export default function ElectricityPage() {
    const router = useRouter();
    const [discos, setDiscos] = useState<any[]>([]);
    const [loadingDiscos, setLoadingDiscos] = useState(true);

    const [selectedDisco, setSelectedDisco] = useState<any>(null);
    const [meterType, setMeterType] = useState(METER_TYPES[0]);
    const [meterNum, setMeterNum] = useState('');
    const [amount, setAmount] = useState('');

    const [validating, setValidating] = useState(false);
    const [customerName, setCustomerName] = useState<string | null>(null);

    const [loading, setLoading] = useState(false);
    const [status, setStatus] = useState<{ type: 'success' | 'error', msg: string } | null>(null);

    useEffect(() => {
        fetchDiscos();
    }, []);

    const fetchDiscos = async () => {
        setLoadingDiscos(true);
        try {
            const res = await fetch('/api/services');
            const response = await res.json();
            if (response.status === 'success' && response.data && response.data.electricity) {
                setDiscos(response.data.electricity);
                if (response.data.electricity.length > 0) {
                    setSelectedDisco(response.data.electricity[0]);
                }
            }
        } catch (error) {
            console.error("Failed to fetch services", error);
        } finally {
            setLoadingDiscos(false);
        }
    };

    const handleValidate = async () => {
        if (!meterNum || !selectedDisco) return;
        setValidating(true);
        setCustomerName(null);
        setStatus(null);

        try {
            // Validate Meter Endpoint
            const res = await fetch('/api/electricity/verify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    serviceID: selectedDisco.serviceID,
                    meterNum: meterNum,
                    meterType: meterType.id
                })
            });
            const data = await res.json();

            if (data.success) {
                setCustomerName(data.data.customerName || 'Customer');
                setStatus({ type: 'success', msg: `Verified: ${data.data.customerName}` });
            } else {
                setStatus({ type: 'error', msg: data.error || 'Could not verify Meter number' });
            }
        } catch (err) {
            setStatus({ type: 'error', msg: 'Validation failed' });
        } finally {
            setValidating(false);
        }
    };

    const handlePurchase = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!customerName) {
            setStatus({ type: 'error', msg: 'Please validate Meter Number first' });
            return;
        }

        setLoading(true);
        setStatus(null);

        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                router.push('/login');
                return;
            }

            const res = await fetch('/api/purchase', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId: user.id,
                    serviceType: 'ELECTRICITY',
                    amount: Number(amount.replace(/,/g, '')),
                    mobileNumber: meterNum, // meterNum acts as mobileNumber
                    serviceID: selectedDisco.serviceID,
                    network: selectedDisco.disco, // For tracking name
                    meterType: meterType.id
                })
            });

            const data = await res.json();

            if (data.error) {
                setStatus({ type: 'error', msg: data.error });
            } else {
                setStatus({ type: 'success', msg: 'Electricity Payment successful!' });
                setMeterNum('');
                setAmount('');
                setCustomerName(null);
                router.refresh();
            }

        } catch (error) {
            setStatus({ type: 'error', msg: 'Something went wrong.' });
        } finally {
            setLoading(false);
        }
    };

    // Calculate User Cost (Discount applied)
    // Discount is 0.2% => 0.002. User pays 99.8%
    const getToPay = () => {
        const val = Number(amount.replace(/,/g, ''));
        if (!val) return 0;
        return val - (val * 0.002);
    };

    return (
        <div className="max-w-md mx-auto">
            <div className="flex items-center gap-4 mb-6">
                <Link href="/dashboard" className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                    <ArrowLeft className="h-5 w-5 text-gray-600" />
                </Link>
                <h1 className="text-xl font-bold text-gray-900">Pay Electricity</h1>
            </div>

            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                <form onSubmit={handlePurchase} className="space-y-6">

                    {/* Disco Selection */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Select Distribution Company</label>
                        {loadingDiscos ? (
                            <div className="w-full text-center py-4 text-gray-500 text-sm">Loading Discos...</div>
                        ) : (
                            <select
                                value={selectedDisco?.serviceID || ''}
                                onChange={(e) => {
                                    const d = discos.find(item => item.serviceID === e.target.value);
                                    setSelectedDisco(d);
                                    setCustomerName(null);
                                }}
                                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-yellow-500 bg-white"
                            >
                                {discos.map((d) => (
                                    <option key={d.serviceID} value={d.serviceID}>
                                        {d.disco}
                                    </option>
                                ))}
                            </select>
                        )}
                    </div>

                    {/* Meter Type */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Meter Type</label>
                        <div className="flex p-1 bg-gray-100 rounded-xl">
                            {METER_TYPES.map((type) => (
                                <button
                                    key={type.id}
                                    type="button"
                                    onClick={() => { setMeterType(type); setCustomerName(null); }}
                                    className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${meterType.id === type.id
                                        ? 'bg-blue-500 text-gray-900 shadow-sm'
                                        : 'text-gray-500 hover:text-gray-700'
                                        }`}
                                >
                                    {type.name}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Meter Number Validation */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Meter Number</label>
                        <div className="flex gap-2">
                            <div className="relative flex-1">
                                <Zap className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                                <input
                                    type="text"
                                    value={meterNum}
                                    onChange={(e) => {
                                        setMeterNum(e.target.value);
                                        setCustomerName(null);
                                    }}
                                    className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-yellow-500"
                                    placeholder="Enter Meter Number"
                                />
                            </div>
                            <button
                                type="button"
                                onClick={handleValidate}
                                disabled={validating || !meterNum || !selectedDisco}
                                className="px-4 py-2 bg-green-400 text-white rounded-xl text-sm font-medium hover:bg-gray-800 disabled:opacity-50"
                            >
                                {validating ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Verify'}
                            </button>
                        </div>
                        {customerName && (
                            <div className="mt-2 flex items-center gap-2 text-sm text-green-600 bg-green-50 p-2 rounded-lg">
                                <CheckCircle2 className="h-4 w-4" />
                                <span className="font-medium">{customerName}</span>
                            </div>
                        )}
                    </div>

                    {/* Amount */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Amount (₦)</label>
                        <input
                            type="number"
                            required
                            min="100"
                            value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                            className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-yellow-500 text-lg font-semibold"
                            placeholder="1000"
                        />
                        {amount && (
                            <div className="mt-2 text-right">
                                <span className="text-sm text-gray-500">You pay: </span>
                                <span className="text-lg font-bold text-green-600">₦{getToPay().toLocaleString()}</span>
                            </div>
                        )}
                    </div>

                    {status && (
                        <div className={`p-4 rounded-xl text-sm ${status.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                            {status.msg}
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={loading || !customerName}
                        className="w-full py-4 bg-yellow-500 text-black rounded-xl font-bold text-lg hover:bg-yellow-400 transition-colors disabled:opacity-70 flex items-center justify-center gap-2"
                    >
                        {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Pay Bill'}
                    </button>
                </form>
            </div>
        </div>
    );
}
