'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Loader2, Save } from 'lucide-react';

export default function SettingsPage() {
    const [config, setConfig] = useState<any>({ markup: 0, maintenance: false });
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [profitData, setProfitData] = useState<any | null>(null);

    useEffect(() => {
        const fetchSettings = async () => {
            try {
                const res = await fetch('/api/admin/settings');
                const ct = res.headers.get('content-type') || '';
                if (!res.ok) {
                    const text = await res.text();
                    console.error('Settings fetch failed', res.status, text);
                } else if (ct.includes('application/json')) {
                    const data = await res.json();
                    if (data.general) setConfig(data.general);
                } else {
                    const text = await res.text();
                    console.error('Settings returned non-JSON response', text);
                }
            } catch (err) {
                console.error('Failed to fetch settings', err);
            } finally {
                setLoading(false);
            }
        };
        fetchSettings();

        const fetchProfits = async () => {
            try {
                const r = await fetch('/api/admin/profit');
                const ct = r.headers.get('content-type') || '';
                if (!r.ok) {
                    const text = await r.text();
                    console.error('Profit fetch failed', r.status, text);
                    return;
                }
                if (ct.includes('application/json')) {
                    const j = await r.json();
                    setProfitData(j);
                } else {
                    const text = await r.text();
                    console.error('Profit returned non-JSON response', text);
                }
            } catch (e) {
                console.error('Failed to load profits', e);
            }
        };
        fetchProfits();
    }, []);

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        try {
            const res = await fetch('/api/admin/settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ key: 'general', value: config })
            });
            if (!res.ok) {
                const text = await res.text();
                console.error('Save settings failed', res.status, text);
                alert('Failed to save settings');
            } else {
                const ct = res.headers.get('content-type') || '';
                if (ct.includes('application/json')) {
                    const json = await res.json();
                    if (json?.success) alert('Settings Saved!');
                    else alert('Settings Saved (unexpected response)');
                } else {
                    alert('Settings Saved');
                }
            }
        } catch (error) {
            alert('Failed to save settings');
        } finally {
            setSaving(false);
        }
    };

    if (loading) return <div className="flex justify-center p-10"><Loader2 className="animate-spin" /></div>;

    const dailyList = Array.isArray(profitData?.days) ? profitData.days : [];
    const maxDailyProfit = Math.max(...dailyList.map((entry: any) => Number(entry?.profit || 0)), 0) || 1;

    return (
        <div className="max-w-2xl">
            <h1 className="text-2xl font-bold text-gray-900 mb-6">System Settings</h1>

                         <Link
                                                    href="/dashboard"
                          className="inline-flex items-center justify-center rounded-lg bg-purple-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-purple-700"
                        >
                          Open User Panel
                        </Link>

            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                <form onSubmit={handleSave} className="space-y-6">

                    <div>
                        <h3 className="text-lg font-medium text-gray-900 mb-4">Pricing Configuration</h3>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Global Profit Markup (₦)
                            <span className="text-gray-400 font-normal ml-2">Added to every airtime/data purchase cost</span>
                        </label>
                        <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">₦</span>
                            <input
                                type="number"
                                value={config.markup || 0}
                                onChange={(e) => setConfig({ ...config, markup: Number(e.target.value) })}
                                className="pl-8 pr-4 py-2 border border-gray-200 rounded-lg w-full focus:ring-2 focus:ring-blue-500"
                            />
                        </div>
                    </div>

                    <div className="pt-6 border-t border-gray-100">
                        <h3 className="text-lg font-medium text-gray-900 mb-4">Maintenance</h3>
                        <div className="flex items-center">
                            <input
                                id="maintenance"
                                type="checkbox"
                                checked={config.maintenance || false}
                                onChange={(e) => setConfig({ ...config, maintenance: e.target.checked })}
                                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                            />
                            <label htmlFor="maintenance" className="ml-2 block text-sm text-gray-700">
                                Enable Maintenance Mode (Disable all user purchases)
                            </label>
                        </div>
                    </div>

                    <div className="pt-4">
                        <button
                            type="submit"
                            disabled={saving}
                            className="flex items-center px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-70"
                        >
                            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                            Save Changes
                        </button>
                    </div>

                </form>
            </div>

            <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
                    <h4 className="text-sm font-medium text-gray-700">Profit This Week</h4>
                    <p className="text-2xl font-semibold text-gray-900 mt-2">{profitData ? (profitData.week?.profit || 0).toLocaleString('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 }) : '—'}</p>
                    <p className="text-xs text-gray-500">Transactions: {profitData ? profitData.week?.count ?? 0 : '—'}</p>
                </div>

                <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
                    <h4 className="text-sm font-medium text-gray-700">Profit This Month</h4>
                    <p className="text-2xl font-semibold text-gray-900 mt-2">{profitData ? (profitData.month?.profit || 0).toLocaleString('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 }) : '—'}</p>
                    <p className="text-xs text-gray-500">Transactions: {profitData ? profitData.month?.count ?? 0 : '—'}</p>
                </div>

                <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
                    <h4 className="text-sm font-medium text-gray-700">Profit This Year</h4>
                    <p className="text-2xl font-semibold text-gray-900 mt-2">{profitData ? (profitData.year?.profit || 0).toLocaleString('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 }) : '—'}</p>
                    <p className="text-xs text-gray-500">Transactions: {profitData ? profitData.year?.count ?? 0 : '—'}</p>
                </div>

                <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
                    <h4 className="text-sm font-medium text-gray-700">Profit So Far</h4>
                    <p className="text-2xl font-semibold text-gray-900 mt-2">{profitData ? (profitData.all?.profit || 0).toLocaleString('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 }) : '—'}</p>
                    <p className="text-xs text-gray-500">Transactions: {profitData ? profitData.all?.count ?? 0 : '—'}</p>
                </div>
            </div>

            <div className="mt-6 bg-white p-4 rounded-lg shadow-sm border border-gray-200">
                <div className="flex items-center justify-between mb-4">
                    <h4 className="text-sm font-medium text-gray-700">Daily Profit (Last 7 Days)</h4>
                    <span className="text-xs text-gray-500">{dailyList.length} days</span>
                </div>

                <div className="space-y-3">
                    {dailyList.length ? dailyList.map((entry: any) => (
                        <div key={entry.label} className="space-y-1">
                            <div className="flex items-center justify-between text-xs text-gray-600">
                                <span>{entry.label}</span>
                                <span>{Number(entry.profit || 0).toLocaleString('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 })}</span>
                            </div>
                            <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100">
                                <div
                                    className="h-full rounded-full bg-linear-to-r from-blue-500 to-purple-600"
                                    style={{ width: `${Math.max((Number(entry.profit || 0) / maxDailyProfit) * 100, 8)}%` }}
                                />
                            </div>
                        </div>
                    )) : (
                        <p className="text-sm text-gray-500">No daily profit data yet.</p>
                    )}
                </div>
            </div>
        </div>
    );
}
