'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { GraduationCap, Loader2, ArrowLeft, CheckCircle2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface EducationService {
    serviceID: string;
    type: string;
    amount: string;
}

interface PurchasedPin {
    pin: string;
    serialNo: string;
}

export default function EducationPage() {
    const router = useRouter();
    const [educationServices, setEducationServices] = useState<EducationService[]>([]);
    const [loadingServices, setLoadingServices] = useState(true);
    const [selectedService, setSelectedService] = useState<EducationService | null>(null);
    const [quantity, setQuantity] = useState(1);
    const [loading, setLoading] = useState(false);
    const [status, setStatus] = useState<{ type: 'success' | 'error', msg: string } | null>(null);
    const [purchasedPins, setPurchasedPins] = useState<PurchasedPin[]>([]);

    useEffect(() => {
        fetchServices();
    }, []);

    const fetchServices = async () => {
        setLoadingServices(true);
        try {
            const res = await fetch('/api/services');
            const response = await res.json();
            console.log(response);
            if (response.status === 'success' && response.data && response.data.education) {
                setEducationServices(response.data.education);
            }
        } catch (error) {
            console.error("Failed to fetch services", error);
        } finally {
            setLoadingServices(false);
        }
    };

    const calculateTotal = () => {
        if (!selectedService) return 0;
        const baseAmount = Number(selectedService.amount.replace(/,/g, ''));
        const profitPerPin = 20;
        return (baseAmount + profitPerPin) * quantity;
    };

    const handlePurchase = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedService) return;
        setLoading(true);
        setStatus(null);
        setPurchasedPins([]);

        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                router.push('/login');
                return;
            }

            const baseAmount = Number(selectedService.amount.replace(/,/g, ''));
            const totalAmount = baseAmount * quantity;

            const res = await fetch('/api/purchase', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId: user.id,
                    serviceType: 'EDUCATION',
                    amount: totalAmount,
                    mobileNumber: '', // Not needed for education
                    serviceID: selectedService.serviceID,
                    quantity: quantity
                })
            });

            const data = await res.json();

            if (data.error) {
                setStatus({ type: 'error', msg: data.error });
            } else {
                setStatus({ type: 'success', msg: `Successfully purchased ${quantity} ${selectedService.type} pin(s)!` });
                if (data.pins && Array.isArray(data.pins)) {
                    setPurchasedPins(data.pins);
                }
                setSelectedService(null);
                setQuantity(1);
                router.refresh();
            }

        } catch (error) {
            setStatus({ type: 'error', msg: 'Something went wrong.' });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="max-w-2xl mx-auto">
            <div className="flex items-center gap-4 mb-6">
                <Link href="/dashboard" className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                    <ArrowLeft className="h-5 w-5 text-gray-600" />
                </Link>
                <h1 className="text-xl font-bold text-gray-900">Buy Exam Pins</h1>
                <h1 className="text-2xl items-right font-bold text-blue-600 tracking-tight">MEDERSUB</h1>
            </div>

            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                <form onSubmit={handlePurchase} className="space-y-6">

                    {/* Education Type Selection */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-3">Select Exam Type</label>
                        {loadingServices ? (
                            <div className="flex items-center justify-center py-8">
                                <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                {educationServices.map((service) => {
                                    const baseAmount = Number(service.amount.replace(/,/g, ''));
                                    const profitPerPin = 20;
                                    const pricePerPin = baseAmount + profitPerPin;

                                    return (
                                        <button
                                            key={service.serviceID}
                                            type="button"
                                            onClick={() => setSelectedService(service)}
                                            className={`flex flex-col items-center p-4 rounded-xl border-2 transition-all ${selectedService?.serviceID === service.serviceID
                                                    ? 'border-green-600 bg-green-50'
                                                    : 'border-gray-200 bg-white hover:bg-gray-50'
                                                }`}
                                        >
                                            <GraduationCap className={`h-10 w-10 mb-2 ${selectedService?.serviceID === service.serviceID
                                                    ? 'text-green-600'
                                                    : 'text-gray-400'
                                                }`} />
                                            <span className="font-bold text-lg">{service.type}</span>
                                            <span className="text-sm text-gray-600">₦{pricePerPin.toLocaleString()}/pin</span>
                                        </button>
                                    );
                                })}
                            </div>
                        )}
                        {educationServices.length === 0 && !loadingServices && (
                            <p className="text-xs text-red-500 mt-1">No education services available.</p>
                        )}
                    </div>

                    {/* Quantity Selection */}
                    {selectedService && (
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Quantity (1-10 pins)</label>
                            <input
                                type="number"
                                min="1"
                                max="10"
                                required
                                value={quantity}
                                onChange={(e) => setQuantity(Number(e.target.value))}
                                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-green-500"
                                placeholder="Enter quantity"
                            />
                        </div>
                    )}

                    {/* Total Amount Display */}
                    {selectedService && (
                        <div className="bg-blue-50 p-4 rounded-xl">
                            <div className="flex justify-between items-center">
                                <span className="text-sm font-medium text-gray-700">Total Amount:</span>
                                <span className="text-2xl font-bold text-blue-600">₦{calculateTotal().toLocaleString()}</span>
                            </div>
                            <p className="text-xs text-gray-500 mt-1">
                                {quantity} × {selectedService.type} pin(s)
                            </p>
                        </div>
                    )}

                    {/* Status Messages */}
                    {status && (
                        <div className={`p-4 rounded-xl text-sm ${status.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
                            }`}>
                            {status.msg}
                        </div>
                    )}

                    {/* Purchased Pins Display */}
                    {purchasedPins.length > 0 && (
                        <div className="bg-green-50 p-4 rounded-xl border border-green-200">
                            <div className="flex items-center gap-2 mb-3">
                                <CheckCircle2 className="h-5 w-5 text-green-600" />
                                <h3 className="font-bold text-green-900">Your Exam Pins</h3>
                            </div>
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="border-b border-green-200">
                                            <th className="text-left py-2 px-3 font-semibold text-green-900">#</th>
                                            <th className="text-left py-2 px-3 font-semibold text-green-900">PIN</th>
                                            <th className="text-left py-2 px-3 font-semibold text-green-900">Serial Number</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {purchasedPins.map((pin, index) => (
                                            <tr key={index} className="border-b border-green-100">
                                                <td className="py-2 px-3 text-green-800">{index + 1}</td>
                                                <td className="py-2 px-3 font-mono text-green-900 font-semibold">{pin.pin.trim()}</td>
                                                <td className="py-2 px-3 font-mono text-green-900">{pin.serialNo.trim()}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                            <p className="text-xs text-green-700 mt-3">
                                💡 Please save these details. You can also find them in your transaction history.
                            </p>
                        </div>
                    )}

                    {/* Submit Button */}
                    <button
                        type="submit"
                        disabled={loading || !selectedService}
                        className="w-full py-4 bg-green-600 text-white rounded-xl font-bold text-lg hover:bg-green-700 transition-colors disabled:opacity-70 flex items-center justify-center gap-2"
                    >
                        {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Buy Now'}
                    </button>

                </form>
            </div>
        </div>
    );
}
