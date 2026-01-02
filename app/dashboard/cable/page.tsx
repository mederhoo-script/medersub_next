'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Tv, Loader2, ArrowLeft, CheckCircle2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

// Provider Data based on user inputs/standard IDs
const PROVIDERS = [
    { id: 'GOTV', name: 'GOtv', color: 'bg-green-500', serviceIdPrefix: 'GOTV' },
    { id: 'DSTV', name: 'DStv', color: 'bg-blue-500', serviceIdPrefix: 'DSTV' },
    { id: 'STARTIMES', name: 'StarTimes', color: 'bg-orange-500', serviceIdPrefix: 'STARTIMES' }
];

// Plans fetched from API
// const ALL_PLANS = []; // Removed hardcoded plans

export default function CablePage() {
    const router = useRouter();
    const [provider, setProvider] = useState(PROVIDERS[0]);
    const [iuc, setIuc] = useState('');
    const [validating, setValidating] = useState(false);
    const [customerName, setCustomerName] = useState<string | null>(null);
    const [selectedPlan, setSelectedPlan] = useState<any>(null);
    const [loading, setLoading] = useState(false);
    const [status, setStatus] = useState<{ type: 'success' | 'error', msg: string } | null>(null);

    const [allPlans, setAllPlans] = useState<any[]>([]);
    const [loadingPlans, setLoadingPlans] = useState(true);

    useEffect(() => {
        fetchServices();
    }, []);

    const fetchServices = async () => {
        setLoadingPlans(true);
        try {
            const res = await fetch('/api/services');
            const response = await res.json();
            if (response.status === 'success' && response.data && response.data.cablePlans) {
                setAllPlans(response.data.cablePlans);
            }
        } catch (error) {
            console.error("Failed to fetch services", error);
        } finally {
            setLoadingPlans(false);
        }
    };

    // Filter plans for selected provider
    const availablePlans = allPlans.filter(p => p.cable === provider.id);

    const handleValidate = async () => {
        if (!iuc) return;
        setValidating(true);
        setCustomerName(null);
        setStatus(null);

        // For validation, we need a serviceID. 
        // Usually providers have a generic validation endpoint or we use one of their plan IDs? 
        // Inlomax documentation usually says pass serviceID. Let's use the first available plan's ID or a known master ID.
        // Or sometimes just the provider generic ID. 
        // Based on user prompt: "serviceID" : "1" for cable validaton. Let's try "1" or maybe just pass the plan ID if user selected one?
        // But user validates BEFORE picking plan usually.
        // Let's assume there is a generic ID per provider or we pick the first plan ID just to trigger provider lookup.
        // Re-reading prompt: User sent `serviceID: "1"` in sample request. "1" often means MTN in airtime, but maybe "1" is generic for "Cable" or "DSTV"? 
        // Actually, prompt says: `curl --request POST 'https://inlomax.com/api/validatecable' ... "serviceID" : "1"`
        // This suggests "1" might be the ID for "DSTV" or just "Cable".
        // Let's use the first Plan's serviceID for now as a proxy, or try to infer. 
        // If "1" worked for the user's sample "7027914329", let's try to map dynamically.
        // Let's use the first plan ID of the selected provider.

        const validationServiceId = availablePlans[0]?.serviceID || '1';

        try {
            const res = await fetch('/api/cable/verify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    serviceID: validationServiceId,
                    iucNum: iuc
                })
            });
            const data = await res.json();

            if (data.success) {
                setCustomerName(data.data.customerName || 'Customer');
                setStatus({ type: 'success', msg: `Verified: ${data.data.customerName}` });
            } else {
                setStatus({ type: 'error', msg: data.error || 'Could not verify IUC number' });
            }
        } catch (err) {
            setStatus({ type: 'error', msg: 'Validation failed' });
        } finally {
            setValidating(false);
        }
    };

    const handlePurchase = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedPlan || !customerName) {
            setStatus({ type: 'error', msg: 'Please validate IUC and select a plan' });
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
                    serviceType: 'CABLE',
                    amount: Number(selectedPlan.amount.toString().replace(/,/g, '')),
                    mobileNumber: iuc, // Using mobileNumber field for IUC
                    serviceID: selectedPlan.serviceID,
                    network: provider.id, // For tracking
                    planName: selectedPlan.cablePlan
                })
            });

            const data = await res.json();

            if (data.error) {
                setStatus({ type: 'error', msg: data.error });
            } else {
                setStatus({ type: 'success', msg: 'Subscription successful!' });
                setIuc('');
                setCustomerName(null);
                setSelectedPlan(null);
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
            <div className="flex items-center gap-4 mb-6">
                <Link href="/dashboard" className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                    <ArrowLeft className="h-5 w-5 text-gray-600" />
                </Link>
                <h1 className="text-xl font-bold text-gray-900">Cable TV</h1>
            </div>

            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                <div className="space-y-6">

                    {/* Provider Selection */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Select Provider</label>
                        <div className="grid grid-cols-3 gap-3">
                            {PROVIDERS.map((prov) => (
                                <button
                                    key={prov.id}
                                    type="button"
                                    onClick={() => {
                                        setProvider(prov);
                                        setCustomerName(null);
                                        setSelectedPlan(null);
                                        setStatus(null);
                                    }}
                                    className={`flex flex-col items-center p-3 rounded-xl border-2 transition-all ${provider.id === prov.id
                                        ? 'border-blue-600 bg-blue-50'
                                        : 'border-transparent bg-gray-50 hover:bg-gray-100'
                                        }`}
                                >
                                    <div className={`h-8 w-8 rounded-full ${prov.color} mb-2`} />
                                    <span className="text-xs font-semibold">{prov.name}</span>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* IUC Entry & Validation */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Smart Card / IUC Number</label>
                        <div className="flex gap-2">
                            <div className="relative flex-1">
                                <Tv className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                                <input
                                    type="text"
                                    value={iuc}
                                    onChange={(e) => {
                                        setIuc(e.target.value);
                                        setCustomerName(null);
                                    }}
                                    className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    placeholder="Enter number"
                                />
                            </div>
                            <button
                                type="button"
                                onClick={handleValidate}
                                disabled={validating || !iuc}
                                className="px-4 py-2 bg-gray-900 text-white rounded-xl text-sm font-medium hover:bg-gray-800 disabled:opacity-50"
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

                    {/* Plan Selection (Only visible after validation for UX, or always visible but disabled?) 
                        Let's keep it visible but maybe highlight user needs to verify first.
                    */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Select Plan</label>
                        <select
                            value={selectedPlan ? JSON.stringify(selectedPlan) : ''}
                            onChange={(e) => setSelectedPlan(e.target.value ? JSON.parse(e.target.value) : null)}
                            disabled={loadingPlans}
                            className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                        >
                            <option value="">
                                {loadingPlans ? 'Loading plans...' : '-- Choose Package --'}
                            </option>
                            {availablePlans.map((plan) => (
                                <option key={plan.serviceID} value={JSON.stringify(plan)}>
                                    {plan.cablePlan} - ₦{Number(plan.amount.toString().replace(/,/g, '')).toLocaleString()}
                                </option>
                            ))}
                        </select>
                    </div>

                    {status && (
                        <div className={`p-4 rounded-xl text-sm ${status.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                            {status.msg}
                        </div>
                    )}

                    <button
                        type="button"
                        onClick={handlePurchase}
                        disabled={loading || !selectedPlan || !customerName}
                        className="w-full py-4 bg-blue-600 text-white rounded-xl font-bold text-lg hover:bg-blue-700 transition-colors disabled:opacity-70 flex items-center justify-center gap-2"
                    >
                        {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Pay Now'}
                    </button>
                </div>
            </div>
        </div>
    );
}
