'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Wifi, Loader2, ArrowLeft, RefreshCw } from 'lucide-react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

// Static Network Defs (Inlomax usually returns these or we map them)
const NETWORKS = [
    { id: 'MTN', name: 'MTN', color: 'bg-yellow-400' },
    { id: 'AIRTEL', name: 'Airtel', color: 'bg-red-500' },
    { id: 'GLO', name: 'Glo', color: 'bg-green-500' },
    { id: '9MOBILE', name: '9mobile', color: 'bg-green-700' },
];

import { calculateDataProfit } from '@/utils/pricing';

export default function DataPage() {
    // ... (rest of imports and state)
    const router = useRouter();
    const [network, setNetwork] = useState(NETWORKS[0]);
    const [plans, setPlans] = useState<any[]>([]);
    const [loadingPlans, setLoadingPlans] = useState(true);
    const [plan, setPlan] = useState<any>(null);
    const [phone, setPhone] = useState('');
    const [loading, setLoading] = useState(false);
    const [status, setStatus] = useState<{ type: 'success' | 'error', msg: string } | null>(null);
    const [allDataPlans, setAllDataPlans] = useState<any[]>([]);

    useEffect(() => {
        fetchServices();
    }, []);

    const fetchServices = async () => {
        // ... (existing fetch logic)
        setLoadingPlans(true);
        try {
            const res = await fetch('/api/services');
            const response = await res.json();
            console.log(response);
            if (response.status === 'success' && response.data && response.data.dataPlans) {
                setAllDataPlans(response.data.dataPlans);
            }
        } catch (error) {
            console.error("Failed to fetch services", error);
        } finally {
            setLoadingPlans(false);
        }
    };

    // Filter plans
    useEffect(() => {
        if (allDataPlans.length > 0) {
            const filtered = allDataPlans.filter((p: any) =>
                p.network.toUpperCase() === network.id
            );
            setPlans(filtered);
        }
    }, [network, allDataPlans]);

    const handlePurchase = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!plan) return;
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
                    serviceType: 'DATA',
                    amount: Number(plan.amount.toString().replace(/,/g, '')),
                    mobileNumber: phone,
                    serviceID: plan.serviceID,
                    network: network.id,
                    planName: plan.dataPlan // Send planName for markup calculation
                })
            });

            // ... (rest of handle logic)
            const data = await res.json();

            if (data.error) {
                setStatus({ type: 'error', msg: data.error });
            } else {
                setStatus({ type: 'success', msg: `Successfully purchased ${plan.dataPlan}!` });
                setPhone('');
                setPlan(null);
                router.refresh();
            }

        } catch (error) {
            setStatus({ type: 'error', msg: 'Something went wrong.' });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="max-w-md mx-auto">
            {/* ... (header and network selection) */}
            <div className="flex items-center gap-4 mb-6">
                <Link href="/dashboard" className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                    <ArrowLeft className="h-5 w-5 text-gray-600" />
                </Link>
                <h1 className="text-xl font-bold text-gray-900">Buy Data Bundle</h1>
                <h1 className="text-2xl items-right font-bold text-blue-600 tracking-tight">MEDERSUB</h1>
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
                                    onClick={() => { setNetwork(net); setPlan(null); }}
                                    className={`flex flex-col items-center p-3 rounded-xl border-2 transition-all ${network.id === net.id
                                        ? 'border-green-600 bg-green-50'
                                        : 'border-transparent bg-gray-50 hover:bg-gray-100'
                                        }`}
                                >
                                    <div className={`h-8 w-8 rounded-full ${net.color} mb-2`} />
                                    <span className="text-xs font-semibold">{net.name}</span>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Plan Selection */}
                    <div>
                        <div className="flex justify-between items-center mb-2">
                            <label className="block text-sm font-medium text-gray-700">Select Plan</label>
                            {loadingPlans && <Loader2 className="h-3 w-3 animate-spin text-gray-400" />}
                        </div>

                        <select
                            required
                            value={plan?.serviceID || ''}
                            onChange={(e) => {
                                const selected = plans.find(p => p.serviceID === e.target.value);
                                setPlan(selected || null);
                            }}
                            disabled={loadingPlans}
                            className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-green-500 bg-white"
                        >
                            <option value="">
                                {loadingPlans ? 'Loading plans...' : '-- Choose Plan --'}
                            </option>
                            {plans.map((p, index) => {
                                const profit = calculateDataProfit(p.dataPlan);
                                const totalAmount = Number(p.amount.toString().replace(/,/g, '')) + profit;
                                return (
                                    <option key={`${p.serviceID}-${index}`} value={p.serviceID}>
                                        {p.dataPlan} - ₦{totalAmount} - {p.validity} - {p.dataType}
                                    </option>
                                );
                            })}
                        </select>
                        {plans.length === 0 && !loadingPlans && (
                            <p className="text-xs text-red-500 mt-1">No plans available for {network.name}.</p>
                        )}
                    </div>

                    {/* Phone and Status ... */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Phone Number</label>
                        <div className="relative">
                            <Wifi className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                            <input
                                type="tel"
                                required
                                value={phone}
                                onChange={(e) => setPhone(e.target.value)}
                                className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-green-500"
                                placeholder="08012345678"
                            />
                        </div>
                    </div>

                    {status && (
                        <div className={`p-4 rounded-xl text-sm ${status.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                            {status.msg}
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={loading || !plan}
                        className="w-full py-4 bg-green-600 text-white rounded-xl font-bold text-lg hover:bg-green-700 transition-colors disabled:opacity-70 flex items-center justify-center gap-2"
                    >
                        {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Buy Now'}
                    </button>

                </form>
            </div>
        </div>
    );
}
