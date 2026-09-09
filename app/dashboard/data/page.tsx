'use client';
import { useRef, useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Contact, Loader2, ArrowLeft, ChevronLeft, ChevronRight, Fingerprint, UserRound } from 'lucide-react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import SpendingBalances from '@/components/dashboard/spending-balances';
import { useDefaultPaymentSource } from '@/components/dashboard/use-default-payment-source';
import { useTransactionPin } from '@/components/dashboard/use-transaction-pin';
import { calculateDataProfit, type PricingSettings } from '@/utils/pricing';

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
    const [pricing, setPricing] = useState<PricingSettings>({});
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
    const categoryScrollerRef = useRef<HTMLDivElement>(null);
    const [categoryScrollState, setCategoryScrollState] = useState({ canScrollLeft: false, canScrollRight: false });

    useEffect(() => {
        const scroller = categoryScrollerRef.current;
        if (!scroller) return;

        const updateCategoryScrollState = () => {
            const maxScrollLeft = scroller.scrollWidth - scroller.clientWidth;
            setCategoryScrollState({
                canScrollLeft: scroller.scrollLeft > 2,
                canScrollRight: maxScrollLeft - scroller.scrollLeft > 2,
            });
        };

        updateCategoryScrollState();
        scroller.addEventListener('scroll', updateCategoryScrollState, { passive: true });
        const resizeObserver = new ResizeObserver(updateCategoryScrollState);
        resizeObserver.observe(scroller);
        window.addEventListener('resize', updateCategoryScrollState);

        return () => {
            scroller.removeEventListener('scroll', updateCategoryScrollState);
            resizeObserver.disconnect();
            window.removeEventListener('resize', updateCategoryScrollState);
        };
    }, [categories.length]);

    const scrollCategories = (direction: 'left' | 'right') => {
        categoryScrollerRef.current?.scrollBy({ left: direction === 'left' ? -180 : 180, behavior: 'smooth' });
    };

    useEffect(() => {
        fetchServices();
        fetch('/api/pricing')
            .then((response) => response.ok ? response.json() : null)
            .then((response) => { if (response?.status === 'success') setPricing(response.data); })
            .catch(() => undefined);
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
        <div className="mx-auto min-h-screen max-w-md bg-[#f6f7f9] px-3 pb-3 sm:px-4 sm:pb-4">
            {/* ... (header and network selection) */}
            <div className="mb-5 flex items-center gap-3 sm:mb-6 sm:gap-4">
                <Link href="/dashboard" className="rounded-full p-1.5 transition-colors hover:bg-gray-100 sm:p-2">
                    <ArrowLeft className="h-5 w-5 text-gray-600 sm:h-6 sm:w-6" />
                </Link>
                <h1 className="flex-1 text-center text-1xl font-bold text-[#111827] sm:text-[28px]">Data</h1>
            </div>

            <form onSubmit={handlePurchase} className="space-y-5 sm:space-y-7">

                    <div>
                        <label className="mb-2 block text-sm font-medium text-[#687181] sm:mb-3 sm:text-[18px]">Phone Number</label>
                        <div className="relative flex items-center rounded-2xl border border-[#dfe2e7] bg-white px-4 shadow-[0_2px_5px_rgba(23,31,48,0.03)] focus-within:border-blue-600 sm:rounded-[22px] sm:px-5">
                            <input type="tel" required value={phone} onChange={(e) => setPhone(e.target.value)} className="min-w-0 flex-1 py-4 text-sm text-[#18202e] outline-none placeholder:text-[#a2a8b2] sm:py-5 sm:text-[22px]" placeholder="080 1234 5678" />
                            <Contact className="h-7 w-7 text-[#0965df] sm:h-8 sm:w-8" />
                        </div>
                    </div>

                    <button type="button" onClick={() => setBeneficiaryOpen((open) => !open)} className="flex w-full items-center gap-3 rounded-2xl bg-[#f4f5f7] px-5 py-4 text-left text-sm text-[#171d2a] sm:gap-4 sm:rounded-[22px] sm:px-7 sm:py-5 sm:text-[18px]">
                        <UserRound className="h-6 w-6 text-[#0965df] sm:h-7 sm:w-7" />
                        <span className="flex-1">{phone && beneficiaries.includes(phone) ? phone : 'Select Beneficiary'}</span>
                        <ChevronRight className={`h-5 w-5 text-[#687181] transition-transform sm:h-6 sm:w-6 ${beneficiaryOpen ? 'rotate-90' : ''}`} />
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
                        <label className="mb-2 block text-sm font-medium text-[#687181] sm:mb-3 sm:text-[18px]">Select Network</label>
                        <div className="grid grid-cols-4 gap-2 sm:gap-3">
                            {networks.map((net) => {
                                const id = net.toUpperCase();
                                return (
                                <button
                                    key={net}
                                    type="button"
                                    onClick={() => { setNetwork(id); setPlan(null); }}
                                    className={`flex min-w-0 flex-col items-center rounded-2xl border-2 bg-white px-1 py-3 transition-all sm:rounded-[21px] sm:py-4 ${network === id ? 'border-[#0965df]' : 'border-transparent'}`}
                                >
                                    <div className={`relative mb-1.5 flex h-10 w-10 items-center justify-center overflow-hidden rounded-full text-[9px] font-bold text-white sm:mb-2 sm:h-12 sm:w-12 ${networkStyles[id] || 'bg-[#64748b]'}`}>
                                        {networkLogos[id] ? <Image src={networkLogos[id]} alt={`${displayName(net)} logo`} fill sizes="48px" className="object-contain" /> : id.slice(0, 3)}
                                    </div>
                                    <span className="truncate text-[11px] font-semibold text-[#17202e] sm:text-xs">{displayName(net)}</span>
                                </button>
                                );
                            })}
                        </div>
                    </div>
                    <div>
                        <div className="flex min-w-0 items-center gap-1">
                            {categoryScrollState.canScrollLeft && <button type="button" onClick={() => scrollCategories('left')} className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-500 text-white shadow-sm hover:text-[#0965df]" aria-label="Previous plan categories">
                                <ChevronLeft className="h-4 w-4" />
                            </button>}
                            <div ref={categoryScrollerRef} className="scrollbar-none flex min-w-0 flex-1 gap-2 overflow-x-auto pb-0">
                                {categories.map((item) => <button key={item} type="button" onClick={() => { setCategory(item); setPlan(null); }} className={`shrink-0 rounded-full px-3 py-2 text-xs font-medium sm:px-7 sm:py-3 sm:text-[16px] ${category === item ? 'bg-[#0965df] text-white' : 'bg-white text-[#454c58]'}`}>{displayName(item)}</button>)}
                            </div>
                            {categoryScrollState.canScrollRight && <button type="button" onClick={() => scrollCategories('right')} className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-500 text-white shadow-sm hover:text-[#0965df]" aria-label="Next plan categories">
                                <ChevronRight className="h-4 w-4" />
                            </button>}
                        </div>
                        <div className="h-5"></div>
                        {loadingPlans ? <div className="flex justify-center py-10"><Loader2 className="h-7 w-7 animate-spin text-blue-600" /></div> : <div className="grid grid-cols-2 gap-3 sm:gap-4">
                            {visiblePlans.map((item) => {
                                const amount = Number(item.amount.toString().replace(/,/g, '')) + calculateDataProfit(item.dataPlan, pricing);
                                const selected = plan?.serviceID === item.serviceID;
                                return <button key={item.serviceID} type="button" onClick={() => setPlan(item)} className={`min-h-[135px] rounded-2xl bg-blue-100 p-3 text-left transition-all sm:min-h-[165px] sm:rounded-[21px] ${selected ? 'border-2 border-[#0965df] bg-cyan-300' : 'border-2.5 border-transparent bg-white'}`}>
                                    <span className="block text-sm text-[#202632] sm:text-[17px]">{item.validity || 'Flexible'}</span>
                                    <strong className="mt-5 block text-center text-lg font-medium text-[#171d2a] sm:mt-7 sm:text-[20px]">{item.dataPlan}</strong>
                                    <span className="mt-4 block text-right text-sm font-bold text-[#202632] sm:mt-6 sm:text-[17px]">₦{amount.toLocaleString('en-NG', { minimumFractionDigits: 2 })}</span>
                                </button>;
                            })}
                        </div>}
                        {!loadingPlans && visiblePlans.length === 0 && <p className="py-8 text-center text-sm text-[#687181]">No plans available for this selection.</p>}
                    </div>

                    <div>
                        <label className="mb-2 block text-sm font-medium text-gray-700">Payment Source</label>
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

                    <div className="sticky bottom-0 z-10 -mx-3 flex gap-2 bg-[#f6f7f9]/95 px-3 pb-2 pt-2 backdrop-blur-sm sm:-mx-4 sm:gap-3 sm:px-4 sm:pb-3">
                        <button
                            type="submit"
                            disabled={loading || !plan}
                            className="flex-1 rounded-2xl bg-[#8fb2f4] py-3 text-base font-bold text-white transition-colors hover:bg-[#78a1ed] disabled:opacity-70 flex items-center justify-center gap-2 sm:rounded-[22px] sm:py-4 sm:text-lg"
                        >
                            {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Buy Now'}
                        </button>
                        <button
                            type="button"
                            onClick={handleBiometricPurchase}
                            disabled={loading || !plan || !biometricSupported}
                            className={`inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border ${biometricSupported ? 'border-blue-200 bg-blue-50 text-blue-600 hover:bg-blue-100' : 'border-gray-200 bg-gray-100 text-gray-400'} transition-colors disabled:opacity-70 sm:h-14 sm:w-14`}
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
