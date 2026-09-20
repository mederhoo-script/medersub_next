'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Loader2, Save } from 'lucide-react';

export default function SettingsPage() {
    const [config, setConfig] = useState<any>({ markup: 0, maintenance: false });
    const [activeProvider, setActiveProvider] = useState<'monnify' | 'korapay' | 'none'>('monnify');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [profitData, setProfitData] = useState<any | null>(null);
    const [vtuConfig, setVtuConfig] = useState({
        globalProvider: 'inlomax',
        enabledProviders: ['inlomax'] as string[],
        routes: {} as Record<string, Record<string, string>>,
    });

    const networkProfitBuckets = [
        ['up_to_1gb', 'Up to 1GB'],
        ['up_to_3gb', '1GB - 3GB'],
        ['up_to_5gb', '3GB - 5GB'],
        ['up_to_10gb', '5GB - 10GB'],
        ['over_10gb', '10GB+'],
    ] as const;
    const networkProfitNetworks = ['MTN', 'AIRTEL', 'GLO', 'T2MOBILE'];

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
                    if (data.payment_provider) {
                        let savedProvider = String(data.payment_provider).toLowerCase();
                        try {
                            const parsed = JSON.parse(savedProvider);
                            if (typeof parsed === 'string') savedProvider = parsed.toLowerCase();
                        } catch { /* Stored value may already be plain text. */ }
                        setActiveProvider(savedProvider === 'korapay' ? 'korapay' : savedProvider === 'none' || savedProvider === 'manual' ? 'none' : 'monnify');
                    }
                    if (data.vtu_provider_config) setVtuConfig({
                        globalProvider: data.vtu_provider_config.globalProvider === 'smeapi' ? 'smeapi' : 'inlomax',
                        enabledProviders: Array.isArray(data.vtu_provider_config.enabledProviders) && data.vtu_provider_config.enabledProviders.includes('smeapi') ? ['inlomax', 'smeapi'] : ['inlomax'],
                        routes: data.vtu_provider_config.routes || {},
                    });
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
            const [generalRes, providerRes, vtuRes] = await Promise.all([
                fetch('/api/admin/settings', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ key: 'general', value: config })
                }),
                fetch('/api/admin/settings', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ key: 'payment_provider', value: activeProvider })
                })
                , fetch('/api/admin/settings', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ key: 'vtu_provider_config', value: vtuConfig })
                })
            ]);

            const failedGeneral = !generalRes.ok;
            const failedProvider = !providerRes.ok;
            const failedVtu = !vtuRes.ok;

            if (failedGeneral || failedProvider || failedVtu) {
                const text = await Promise.all([generalRes.text().catch(() => ''), providerRes.text().catch(() => ''), vtuRes.text().catch(() => '')]);
                console.error('Save settings failed', text);
                alert('Failed to save settings');
                return;
            }

            const res = generalRes;
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

    const changeGlobalVtuProvider = (provider: string) => {
        setVtuConfig((current) => {
            const routes = Object.fromEntries(Object.entries(current.routes).map(([type, networkRoutes]) => [
                type,
                Object.fromEntries(Object.entries(networkRoutes).map(([network, selectedProvider]) => [
                    network,
                    selectedProvider === current.globalProvider ? provider : selectedProvider,
                ])),
            ]));
            return { ...current, globalProvider: provider, routes };
        });
    };

    if (loading) return <div className="flex justify-center p-10"><Loader2 className="animate-spin" /></div>;

    const dailyList = Array.isArray(profitData?.days) ? profitData.days : [];
    const mondayToSundayList = Array.isArray(profitData?.mondayToSunday?.days) ? profitData.mondayToSunday.days : [];
    const maxMondayToSundayProfit = Math.max(...mondayToSundayList.map((entry: any) => Number(entry?.profit || 0)), 0) || 1;
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
                        <h3 className="text-lg font-medium text-gray-900 mb-2">Data plan profit (₦)</h3>
                        <p className="mb-4 text-sm text-gray-500">These amounts replace the previous hard-coded data-plan profits for website purchases.</p>
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                            {[
                                ['data_profit_up_to_1gb', 'Up to 1 GB', 10],
                                ['data_profit_up_to_3gb', 'Over 1 GB to 3 GB', 20],
                                ['data_profit_up_to_5gb', 'Over 3 GB to 5 GB', 30],
                                ['data_profit_up_to_10gb', 'Over 5 GB to 10 GB', 50],
                                ['data_profit_over_10gb', 'Over 10 GB', 100],
                            ].map(([key, label, fallback]) => (
                                <label key={key as string} className="block text-sm font-medium text-gray-700">
                                    {label}
                                    <input type="number" min="0" step="0.01" value={config[key as string] ?? fallback} onChange={(e) => setConfig({ ...config, [key]: Number(e.target.value) })} className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 focus:ring-2 focus:ring-blue-500" />
                                </label>
                            ))}
                        </div>
                    </div>

                    <div className="pt-6 border-t border-gray-100">
                        <h3 className="text-lg font-medium text-gray-900 mb-2">Network-specific data profit overrides</h3>
                        <p className="mb-4 text-sm text-gray-500">Set distinct profit values for each network and data size. Leave a field at 0 to inherit the global tier value.</p>
                        <div className="space-y-4">
                            {networkProfitNetworks.map((network) => (
                                <div key={network} className="rounded-xl border border-gray-200 bg-gray-50 p-3">
                                    <h4 className="mb-3 text-sm font-semibold text-gray-800">{network}</h4>
                                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                        {networkProfitBuckets.map(([bucket, label]) => (
                                            <label key={`${network}-${bucket}`} className="block text-xs font-medium text-gray-700">
                                                {label}
                                                <input
                                                    type="number"
                                                    min="0"
                                                    step="0.01"
                                                    value={Number(config.data_profit_by_network?.[network]?.[bucket] ?? 0)}
                                                    onChange={(e) => {
                                                        const value = e.target.value === '' ? 0 : Number(e.target.value);
                                                        const nextByNetwork = { ...(config.data_profit_by_network || {}) };
                                                        const networkSettings = { ...(nextByNetwork[network] || {}) };
                                                        if (value === 0) {
                                                            delete networkSettings[bucket];
                                                        } else {
                                                            networkSettings[bucket] = value;
                                                        }
                                                        if (Object.keys(networkSettings).length === 0) {
                                                            delete nextByNetwork[network];
                                                        } else {
                                                            nextByNetwork[network] = networkSettings;
                                                        }
                                                        setConfig({ ...config, data_profit_by_network: nextByNetwork });
                                                    }}
                                                    className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 focus:ring-2 focus:ring-blue-500"
                                                />
                                            </label>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="pt-6 border-t border-gray-100">
                        <h3 className="text-lg font-medium text-gray-900 mb-2">Education profit (₦)</h3>
                        <label className="block text-sm font-medium text-gray-700">Profit per exam PIN
                            <input type="number" min="0" step="0.01" value={config.education_profit_per_pin ?? 20} onChange={(e) => setConfig({ ...config, education_profit_per_pin: Number(e.target.value) })} className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 focus:ring-2 focus:ring-blue-500" />
                        </label>
                    </div>

                    <div className="pt-6 border-t border-gray-100">
                        <h3 className="text-lg font-medium text-gray-900 mb-4">Public API pricing</h3>
                        <p className="mb-4 text-sm text-gray-500">These independent profits are added to data and education prices returned by <code>/api/v1/services</code>.</p>
                        <h4 className="mb-2 text-sm font-medium text-gray-700">Data plan profit (₦)</h4>
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                            {[
                                ['public_api_data_profit_up_to_1gb', 'Up to 1 GB', 10],
                                ['public_api_data_profit_up_to_3gb', 'Over 1 GB to 3 GB', 20],
                                ['public_api_data_profit_up_to_5gb', 'Over 3 GB to 5 GB', 30],
                                ['public_api_data_profit_up_to_10gb', 'Over 5 GB to 10 GB', 50],
                                ['public_api_data_profit_over_10gb', 'Over 10 GB', 100],
                            ].map(([key, label, fallback]) => (
                                <label key={key as string} className="block text-sm font-medium text-gray-700">
                                    {label}
                                    <input type="number" min="0" step="0.01" value={config[key as string] ?? fallback} onChange={(e) => setConfig({ ...config, [key]: Number(e.target.value) })} className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 focus:ring-2 focus:ring-blue-500" />
                                </label>
                            ))}
                        </div>
                        <label className="mt-4 block text-sm font-medium text-gray-700">Education profit per exam PIN (₦)
                            <input type="number" min="0" step="0.01" value={config.public_api_education_profit_per_pin ?? 20} onChange={(e) => setConfig({ ...config, public_api_education_profit_per_pin: Number(e.target.value) })} className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 focus:ring-2 focus:ring-blue-500" />
                        </label>
                    </div>

                    <div className="pt-6 border-t border-gray-100">
                        <h3 className="text-lg font-medium text-gray-900 mb-2">VTU Provider Routing</h3>
                        <p className="mb-4 text-sm text-gray-500">Choose the default provider and override it for specific Airtime or Data networks. SMEAPI must be configured with the server-side SMEAPI_API_KEY.</p>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Global provider</label>
                        <select value={vtuConfig.globalProvider} onChange={(e) => changeGlobalVtuProvider(e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2">
                            <option value="inlomax">Inlomax</option>
                            {vtuConfig.enabledProviders.includes('smeapi') && <option value="smeapi">SMEAPI</option>}
                        </select>
                        <div className="mt-4 flex gap-5 text-sm">
                            {['inlomax', 'smeapi'].map((provider) => (
                                <label key={provider} className="flex items-center gap-2">
                                    <input type="checkbox" checked={vtuConfig.enabledProviders.includes(provider)} disabled={provider === 'inlomax'} onChange={(e) => setVtuConfig({ ...vtuConfig, enabledProviders: e.target.checked ? [...new Set([...vtuConfig.enabledProviders, provider])] : vtuConfig.enabledProviders.filter((item) => item !== provider), globalProvider: provider === 'smeapi' && !e.target.checked ? 'inlomax' : vtuConfig.globalProvider })} />
                                    {provider === 'inlomax' ? 'Enable Inlomax' : 'Enable SMEAPI'}
                                </label>
                            ))}
                        </div>
                        <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
                            {['AIRTIME', 'DATA'].map((type) => ['MTN', 'GLO', 'AIRTEL', 'T2MOBILE'].map((network) => (
                                <label key={`${type}-${network}`} className="flex items-center justify-between rounded-lg border border-gray-200 px-3 py-2 text-sm">
                                    <span>{network} {type.toLowerCase()}</span>
                                    <select value={vtuConfig.routes[type]?.[network] || vtuConfig.globalProvider} onChange={(e) => setVtuConfig({ ...vtuConfig, routes: { ...vtuConfig.routes, [type]: { ...(vtuConfig.routes[type] || {}), [network]: e.target.value } } })} className="rounded border border-gray-200 px-2 py-1 text-xs">
                                        {vtuConfig.enabledProviders.map((provider) => <option key={provider} value={provider}>{provider}</option>)}
                                    </select>
                                </label>
                            ))) }
                        </div>
                    </div>

                    <div className="pt-6 border-t border-gray-100">
                        <h3 className="text-lg font-medium text-gray-900 mb-4">Payment Provider</h3>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Active Wallet Funding Provider</label>
                        <select
                            value={activeProvider}
                            onChange={(e) => setActiveProvider(e.target.value as 'monnify' | 'korapay' | 'none')}
                            className="w-full border border-gray-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
                        >
                            <option value="monnify">Monnify Virtual Account</option>
                            <option value="korapay">KoraPay Virtual Account</option>
                            <option value="none">Manual funding only</option>
                        </select>
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

            <div className="mt-6 bg-white p-4 rounded-lg shadow-sm border border-gray-200">
                <div className="flex items-center justify-between mb-4">
                    <div>
                        <h4 className="text-sm font-medium text-gray-700">This Week (Monday to Sunday)</h4>
                        <p className="mt-1 text-lg font-semibold text-gray-900">
                            {profitData ? Number(profitData.mondayToSunday?.profit || 0).toLocaleString('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 }) : '—'}
                        </p>
                    </div>
                    <span className="text-xs text-gray-500">{profitData?.mondayToSunday?.count ?? 0} transactions</span>
                </div>
                <div className="space-y-3">
                    {mondayToSundayList.map((entry: any) => (
                        <div key={entry.label} className="space-y-1">
                            <div className="flex items-center justify-between text-xs text-gray-600">
                                <span>{entry.label}</span>
                                <span>{Number(entry.profit || 0).toLocaleString('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 })}</span>
                            </div>
                            <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100">
                                <div className="h-full rounded-full bg-linear-to-r from-emerald-500 to-cyan-500" style={{ width: `${Math.max((Number(entry.profit || 0) / maxMondayToSundayProfit) * 100, 8)}%` }} />
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
