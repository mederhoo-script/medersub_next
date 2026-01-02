'use client';
import { useState, useEffect } from 'react';
import { Loader2, Wifi, Smartphone, Tv, Zap, CheckCircle, XCircle, Edit } from 'lucide-react';
import clsx from 'clsx';

export default function ServicesPage() {
    const [services, setServices] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [tempMarkup, setTempMarkup] = useState('');

    useEffect(() => {
        fetchServices();
    }, []);

    const fetchServices = async () => {
        const res = await fetch('/api/admin/services');
        const data = await res.json();
        if (Array.isArray(data)) setServices(data);
        setLoading(false);
    };

    const toggleService = async (id: string, currentState: boolean) => {
        // Optimistic update
        setServices(services.map(s => s.id === id ? { ...s, is_active: !currentState } : s));

        try {
            await fetch('/api/admin/services', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id, is_active: !currentState })
            });
        } catch (error) {
            console.error('Failed to toggle', error);
            fetchServices();
        }
    };

    const saveMarkup = async (id: string) => {
        try {
            const res = await fetch('/api/admin/services', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id, markup: Number(tempMarkup) })
            });
            if (res.ok) {
                setEditingId(null);
                fetchServices();
            }
        } catch (error) {
            console.error('Failed to save markup', error);
        }
    };

    const getIcon = (type: string) => {
        switch (type) {
            case 'DATA': return <Wifi className="h-6 w-6" />;
            case 'AIRTIME': return <Smartphone className="h-6 w-6" />;
            case 'CABLE': return <Tv className="h-6 w-6" />;
            case 'ELECTRICITY': return <Zap className="h-6 w-6" />;
            default: return <Smartphone className="h-6 w-6" />;
        }
    };

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-gray-900">Service Management</h1>
                <p className="text-gray-500">Configure availability and pricing markups.</p>
            </div>

            {loading ? (
                <div className="flex justify-center p-12"><Loader2 className="animate-spin text-blue-600" /></div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {services.map((service) => (
                        <div key={service.id} className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
                            <div className="flex justify-between items-start">
                                <div className={clsx("p-3 rounded-lg",
                                    service.type === 'DATA' ? 'bg-blue-100 text-blue-600' :
                                        service.type === 'AIRTIME' ? 'bg-orange-100 text-orange-600' : 'bg-gray-100'
                                )}>
                                    {getIcon(service.type)}
                                </div>
                                <button
                                    onClick={() => toggleService(service.id, service.is_active)}
                                    className={clsx("relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none",
                                        service.is_active ? 'bg-green-500' : 'bg-gray-200'
                                    )}
                                >
                                    <span className={clsx("pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out",
                                        service.is_active ? 'translate-x-5' : 'translate-x-0'
                                    )} />
                                </button>
                            </div>

                            <h3 className="mt-4 font-semibold text-gray-900">{service.name}</h3>
                            <div className="flex items-center gap-2 mt-1 mb-4">
                                <span className={clsx("text-xs px-2 py-1 rounded-full font-medium flex items-center", service.is_active ? "text-green-600 bg-green-50" : "text-red-600 bg-red-50")}>
                                    {service.is_active ? <CheckCircle className="h-3 w-3 mr-1" /> : <XCircle className="h-3 w-3 mr-1" />}
                                    {service.is_active ? 'Active' : 'Disabled'}
                                </span>
                                <span className="text-xs text-gray-400 font-mono uppercase">{service.id}</span>
                            </div>

                            <div className="pt-4 border-t border-gray-100">
                                <div className="flex justify-between items-center">
                                    <span className="text-sm text-gray-500">Markup:</span>
                                    {editingId === service.id ? (
                                        <div className="flex items-center gap-2">
                                            <span className="text-gray-400 text-sm">₦</span>
                                            <input
                                                type="number"
                                                className="w-16 border rounded px-1 py-0.5 text-sm"
                                                value={tempMarkup}
                                                onChange={(e) => setTempMarkup(e.target.value)}
                                                autoFocus
                                            />
                                            <button onClick={() => saveMarkup(service.id)} className="text-xs bg-blue-600 text-white px-2 py-1 rounded">Save</button>
                                        </div>
                                    ) : (
                                        <button
                                            onClick={() => { setEditingId(service.id); setTempMarkup(service.markup); }}
                                            className="flex items-center text-sm font-semibold text-gray-900 hover:text-blue-600"
                                        >
                                            ₦{service.markup || 0}
                                            <Edit className="h-3 w-3 ml-1 text-gray-400" />
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
