'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Contact, Loader2, ArrowLeft, ChevronRight, Fingerprint, UserRound } from 'lucide-react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import SpendingBalances from '@/components/dashboard/spending-balances';
import { useDefaultPaymentSource } from '@/components/dashboard/use-default-payment-source';
import { useTransactionPin } from '@/components/dashboard/use-transaction-pin';
import { calculateDataProfit } from '@/utils/pricing';

type DataPlan = {
    serviceID: string;
    network: string;
    dataPlan: string;
    amount: number | string;
    validity?: string;
    dataType?: string;
};

type DataTransaction = {
    type?: string | null;
    service_type?: string | null;
    status?: string | null;
    meta?: {
        mobile?: string | null;
        mobileNumber?: string | null;
        mobile_number?: string | null;
        phone?: string | null;
        recipient?: string | null;
        service_type?: string | null;
    } | null;
};

const networkStyles: Record<string, string> = {
    MTN: 'bg-[#ffc900]',
    AIRTEL: 'bg-[#e51b2b]',
    GLO: 'bg-[#138b43]',
};

const networkLogos: Record<string, string> = {
    MTN: '/assets/mtn.jpeg',
    AIRTEL: '/assets/airtel-mobile.png',
    GLO: '/assets/glo.png',
    '9MOBILE': '/assets/9mobile.png',
};

const displayName = (value: string) => value.replace(/[-_]/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());

export default function DataPage() {
    const { requestPin, requestBiometricApproval, PinDialog, biometricSupported, biometricSupportMessage } = useTransactionPin();
    // ... (rest of imports and state)
    const router = useRouter();
    const [network, setNetwork] = useState('MTN');
    const [plans, setPlans] = useState<DataPlan[]>([]);
    const [loadingPlans, setLoadingPlans] = useState(true);
    const [plan, setPlan] = useState<DataPlan | null>(null);
    const [phone, setPhone] = useState('');
    const { paymentSource, setPaymentSource } = useDefaultPaymentSource();
    const [loading, setLoading] = useState(false);
    const [status, setStatus] = useState<{ type: 'success' | 'error', msg: string } | null>(null);
    const [allDataPlans, setAllDataPlans] = useState<DataPlan[]>([]);
    const networks = Array.from(new Set(allDataPlans.map((item) => item.network?.trim()).filter(Boolean)))
        .sort((first, second) => {
            const firstIndex = Object.keys(networkLogos).indexOf(first.toUpperCase());
            const secondIndex = Object.keys(networkLogos).indexOf(second.toUpperCase());
            if (firstIndex === -1 && secondIndex === -1) return first.localeCompare(second);
            if (firstIndex === -1) return 1;
            if (secondIndex === -1) return -1;
            return firstIndex - secondIndex;
        });
    const categories = Array.from(new Set(plans.map((item) => item.dataType?.trim()).filter(Boolean))) as string[];
    const [category, setCategory] = useState('');
    const [beneficiaries, setBeneficiaries] = useState<string[]>([]);
    const [beneficiaryOpen, setBeneficiaryOpen] = useState(false);

    useEffect(() => {
        fetchServices();
        fetchBeneficiaries();
    }, []);

    const fetchBeneficiaries = async (): Promise<void> => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data, error } = await supabase
            .from('transactions')
            .select('*')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Failed to fetch data beneficiaries:', error.message);
            return;
        }

        const numbers = (data as DataTransaction[] | null || [])
            .filter((transaction) => {
                const service = transaction.meta?.service_type || transaction.service_type;
                const status = transaction.status?.toLowerCase();
                return service?.toUpperCase().includes('DATA') && status !== 'failed';
            })
            .map((transaction) => {
                return transaction.meta?.mobile?.trim();
            })
            .filter((mobile): mobile is string => Boolean(mobile));

        setBeneficiaries(Array.from(new Set(numbers)));
    };

    const fetchServices = async () => {
        // ... (existing fetch logic)
        setLoadingPlans(true);
        try {
            const res = await fetch('/api/services');
            const response = await res.json();
            console.log(response);
            if (response.status === 'success' && response.data && response.data.dataPlans) {
                const fetchedPlans = response.data.dataPlans as DataPlan[];
                setAllDataPlans(fetchedPlans);
                setNetwork((current) => current || fetchedPlans[0]?.network?.trim().toUpperCase() || '');
            }
        } catch (error) {
            console.error("Failed to fetch services", error);
        } finally {
            setLoadingPlans(false);
        }
    };

    // Filter plans
    useEffect(() => {
        if (allDataPlans.length > 0 && network) {
            const filtered = allDataPlans.filter((p) => p.network?.trim().toUpperCase() === network);
            setPlans(filtered);
            setCategory((current) => current && filtered.some((item) => item.dataType?.trim() === current) ? current : filtered[0]?.dataType?.trim() || '');
        }
    }, [network, allDataPlans]);

    const visiblePlans = category ? plans.filter((item) => item.dataType?.trim() === category) : plans;

    const submitPurchase = async (approvalType: 'pin' | 'biometric') => {
        if (!plan) return;
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
                serviceType: 'DATA',
                amount: Number(plan.amount.toString().replace(/,/g, '')),
                mobileNumber: phone,
                serviceID: plan.serviceID,
                network,
                planName: plan.dataPlan,
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
                setStatus({ type: 'success', msg: `Successfully purchased ${plan.dataPlan}!` });
                setPhone('');
                setPlan(null);
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
        <div className="mx-auto min-h-screen max-w-md bg-[#f6f7f9] px-4 pb-4">
            {/* ... (header and network selection) */}
            <div className="flex items-center gap-4 mb-6">
                <Link href="/dashboard" className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                    <ArrowLeft className="h-5 w-5 text-gray-600" />
                </Link>
                <h1 className="flex-1 text-center text-[28px] font-bold tracking-[-0.04em] text-[#111827]">Data</h1>
            </div>

            <form onSubmit={handlePurchase} className="space-y-7">

                    <div>
                        <label className="mb-3 block text-[18px] font-medium text-[#687181]">Phone Number</label>
                        <div className="relative flex items-center rounded-[22px] border border-[#dfe2e7] bg-white px-5 shadow-[0_2px_5px_rgba(23,31,48,0.03)] focus-within:border-blue-600">
                            <input type="tel" required value={phone} onChange={(e) => setPhone(e.target.value)} className="min-w-0 flex-1 py-5 text-[22px] text-[#18202e] outline-none placeholder:text-[#a2a8b2]" placeholder="080 1234 5678" />
                            <Contact className="h-8 w-8 text-[#0965df]" />
                        </div>
                    </div>

                    <button type="button" onClick={() => setBeneficiaryOpen((open) => !open)} className="flex w-full items-center gap-4 rounded-[22px] bg-[#f4f5f7] px-7 py-5 text-left text-[18px] text-[#171d2a]">
                        <UserRound className="h-7 w-7 text-[#0965df]" />
                        <span className="flex-1">{phone && beneficiaries.includes(phone) ? phone : 'Select Beneficiary'}</span>
                        <ChevronRight className={`h-6 w-6 text-[#687181] transition-transform ${beneficiaryOpen ? 'rotate-90' : ''}`} />
                    </button>
                    {beneficiaryOpen && (
                        <div className="-mt-4 overflow-hidden rounded-b-[22px] bg-white shadow-sm">
                            {beneficiaries.length > 0 ? beneficiaries.map((mobile) => (
                                <button key={mobile} type="button" onClick={() => { setPhone(mobile); setBeneficiaryOpen(false); }} className="block w-full border-b border-[#eef0f3] px-7 py-4 text-left text-[17px] text-[#202632] last:border-0 hover:bg-[#f5f8ff]">
                                    {mobile}
                                </button>
                            )) : <p className="px-7 py-4 text-sm text-[#687181]">No previous data recipients yet.</p>}
                        </div>
                    )}

                    <div>
                        <label className="mb-3 block text-[18px] font-medium text-[#687181]">Select Network</label>
                        <div className="grid grid-cols-4 gap-3">
                            {networks.map((net) => {
                                const id = net.toUpperCase();
                                return (
                                <button
                                    key={net}
                                    type="button"
                                    onClick={() => { setNetwork(id); setPlan(null); }}
                                    className={`flex min-w-0 flex-col items-center rounded-[21px] border-2 bg-white px-1 py-4 transition-all ${network === id ? 'border-[#0965df]' : 'border-transparent'}`}
                                >
                                    <div className={`relative mb-2 flex h-12 w-12 items-center justify-center overflow-hidden rounded-full text-[10px] font-bold text-white ${networkStyles[id] || 'bg-[#64748b]'}`}>
                                        {networkLogos[id] ? <Image src={networkLogos[id]} alt={`${displayName(net)} logo`} fill sizes="48px" className="object-contain" /> : id.slice(0, 3)}
                                    </div>
                                    <span className="truncate text-xs font-semibold text-[#17202e]">{displayName(net)}</span>
                                </button>
                                );
                            })}
                        </div>
                    </div>
                    <div>
                        <div className="scrollbar-none flex gap-3 overflow-x-auto pb-2">
                            {categories.map((item) => <button key={item} type="button" onClick={() => { setCategory(item); setPlan(null); }} className={`shrink-0 rounded-full px-7 py-3 text-[16px] font-medium ${category === item ? 'bg-[#0965df] text-white' : 'bg-white text-[#454c58]'}`}>{displayName(item)}</button>)}
                        </div>
                        {loadingPlans ? <div className="flex justify-center py-12"><Loader2 className="h-7 w-7 animate-spin text-blue-600" /></div> : <div className="grid grid-cols-2 gap-4">
                            {visiblePlans.map((item) => {
                                const amount = Number(item.amount.toString().replace(/,/g, '')) + calculateDataProfit(item.dataPlan);
                                const selected = plan?.serviceID === item.serviceID;
                                return <button key={item.serviceID} type="button" onClick={() => setPlan(item)} className={`min-h-[165px] rounded-[21px] bg-blue-100 p-3 text-left transition-all ${selected ? 'border-2 border-[#0965df] rounded-[40px] bg-cyan-300' : 'border-2.5 bg-white border-transparent'}`}>
                                    <span className="block text-[17px] text-[#202632]">{item.validity || 'Flexible'}</span>
                                    <strong className="mt-7 block text-center text-[20px] font-medium text-[#171d2a]">{item.dataPlan}</strong>
                                    <span className="mt-6 block text-right text-[17px] font-bold text-[#202632]">₦{amount.toLocaleString('en-NG', { minimumFractionDigits: 2 })}</span>
                                </button>;
                            })}
                        </div>}
                        {!loadingPlans && visiblePlans.length === 0 && <p className="py-8 text-center text-sm text-[#687181]">No plans available for this selection.</p>}
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Payment Source</label>
                        <SpendingBalances paymentSource={paymentSource} />
                        <select
                            value={paymentSource}
                            onChange={(e) => setPaymentSource(e.target.value as 'wallet' | 'reward')}
                            className="w-full mt-2 px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-green-500 bg-white"
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

                    <div className="sticky bottom-0 z-10 -mx-4 flex gap-3 bg-[#f6f7f9]/95 px-4 pb-3 pt-2 backdrop-blur-sm">
                        <button
                            type="submit"
                            disabled={loading || !plan}
                            className="flex-1 rounded-[22px] bg-[#8fb2f4] py-4 text-lg font-bold text-white transition-colors hover:bg-[#78a1ed] disabled:opacity-70 flex items-center justify-center gap-2"
                        >
                            {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Buy Now'}
                        </button>
                        <button
                            type="button"
                            onClick={handleBiometricPurchase}
                            disabled={loading || !plan || !biometricSupported}
                            className={`shrink-0 inline-flex h-14 w-14 items-center justify-center rounded-xl border ${biometricSupported ? 'border-blue-200 bg-blue-50 text-blue-600 hover:bg-blue-100' : 'border-gray-200 bg-gray-100 text-gray-400'} transition-colors disabled:opacity-70`}
                            aria-label="Use fingerprint to buy"
                            title={biometricSupported ? 'Use fingerprint to buy' : biometricSupportMessage || 'Fingerprint not available'}
                        >
                            <Fingerprint className="h-5 w-5" />
                        </button>
                    </div>
                    {!biometricSupported && biometricSupportMessage && (
                        <p className="mt-2 text-xs text-gray-500">{biometricSupportMessage}</p>
                    )}

            </form>
            {PinDialog}
        </div>
    );
}
