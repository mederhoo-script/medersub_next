'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { User, Mail, Phone, Shield } from 'lucide-react';

export default function ProfilePage() {
    const [profile, setProfile] = useState<any>(null);
    const [email, setEmail] = useState<string>('');

    useEffect(() => {
        const fetchProfile = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                setEmail(user.email || '');
                const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single();
                setProfile(data);
            }
        };
        fetchProfile();
    }, []);

    if (!profile) return <div className="p-8">Loading...</div>;

    return (
        <div className="max-w-2xl mx-auto space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-2xl font-bold text-gray-900">My Profile</h1>
            </div>

            <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm flex items-center gap-6">
                <div className="h-20 w-20 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 text-2xl font-bold">
                    {profile.full_name?.charAt(0)}
                </div>
                <div>
                    <h2 className="text-xl font-bold text-gray-900">{profile.full_name}</h2>
                    <p className="text-gray-500">{email}</p>
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 mt-2">
                        Active Account
                    </span>
                </div>
            </div>

            <div className="bg-white rounded-xl border border-gray-100 shadow-sm divide-y divide-gray-100">
                <div className="p-4 flex items-center gap-4">
                    <User className="text-gray-400 h-5 w-5" />
                    <div>
                        <p className="text-xs text-gray-500">Full Name</p>
                        <p className="font-medium text-gray-900">{profile.full_name}</p>
                    </div>
                </div>
                <div className="p-4 flex items-center gap-4">
                    <Mail className="text-gray-400 h-5 w-5" />
                    <div>
                        <p className="text-xs text-gray-500">Email Address</p>
                        <p className="font-medium text-gray-900">{email}</p>
                    </div>
                </div>
                <div className="p-4 flex items-center gap-4">
                    <Shield className="text-gray-400 h-5 w-5" />
                    <div>
                        <p className="text-xs text-gray-500">Account Role</p>
                        <p className="font-medium text-gray-900">{profile.role}</p>
                    </div>
                </div>
            </div>

            <button
                onClick={async () => {
                    await supabase.auth.signOut();
                    window.location.href = '/login';
                }}
                className="w-full bg-red-50 text-red-600 p-4 rounded-xl font-medium hover:bg-red-100 transition-colors flex items-center justify-center gap-2"
            >
                Log Out
            </button>
        </div>
    );
}
