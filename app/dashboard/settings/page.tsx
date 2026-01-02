'use client';
import { supabase } from '@/lib/supabase';
import { LogOut } from 'lucide-react';

export default function SettingsPage() {
    return (
        <div className="max-w-2xl mx-auto space-y-6">
            <h1 className="text-2xl font-bold text-gray-900">Settings</h1>

            <div className="bg-white p-8 rounded-xl border border-gray-100 text-center">
                <p className="text-gray-500">Account settings and preferences coming soon.</p>
            </div>

            <button
                onClick={async () => {
                    await supabase.auth.signOut();
                    window.location.href = '/login';
                }}
                className="w-full bg-red-50 text-red-600 p-4 rounded-xl font-medium hover:bg-red-100 transition-colors flex items-center justify-center gap-2"
            >
                <LogOut className="h-5 w-5" />
                Log Out
            </button>
        </div>
    );
}
