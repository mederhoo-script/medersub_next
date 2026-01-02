'use client';
import { useState, useEffect } from 'react';
import { Loader2, Save } from 'lucide-react';

export default function SettingsPage() {
    const [config, setConfig] = useState<any>({ markup: 0, maintenance: false });
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        const fetchSettings = async () => {
            const res = await fetch('/api/admin/settings');
            const data = await res.json();
            if (data.general) {
                setConfig(data.general);
            }
            setLoading(false);
        };
        fetchSettings();
    }, []);

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        try {
            await fetch('/api/admin/settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ key: 'general', value: config })
            });
            alert('Settings Saved!');
        } catch (error) {
            alert('Failed to save settings');
        } finally {
            setSaving(false);
        }
    };

    if (loading) return <div className="flex justify-center p-10"><Loader2 className="animate-spin" /></div>;

    return (
        <div className="max-w-2xl">
            <h1 className="text-2xl font-bold text-gray-900 mb-6">System Settings</h1>

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
        </div>
    );
}
