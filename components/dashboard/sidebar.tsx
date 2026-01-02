'use client';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { Home, History, CreditCard, User, Settings, LogOut, ShieldAlert } from 'lucide-react';
import clsx from 'clsx';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

const navItems = [
    { icon: Home, label: 'Dashboard', href: '/dashboard' },
    { icon: History, label: 'Transactions', href: '/dashboard/history' },
    { icon: CreditCard, label: 'Finance', href: '/dashboard/finance' },
    { icon: User, label: 'Profile', href: '/dashboard/profile' },
    { icon: Settings, label: 'Settings', href: '/dashboard/settings' },
];

export default function Sidebar() {
    const pathname = usePathname();
    const router = useRouter();
    const [isAdmin, setIsAdmin] = useState(false);

    useEffect(() => {
        const checkRole = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                const { data } = await supabase.from('profiles').select('role').eq('id', user.id).single();
                if (data?.role === 'ADMIN') {
                    setIsAdmin(true);
                }
            }
        };
        checkRole();
    }, []);

    const handleLogout = async () => {
        await supabase.auth.signOut();
        router.push('/login');
    };

    return (
        <div className="hidden md:flex flex-col w-64 bg-white border-r border-gray-100 h-screen sticky top-0">
            <div className="p-6">
                <Link href="/" className="block">
                    <Image
                        src="/assets/mlogo.png"
                        alt="MEDERSUB Logo"
                        width={140}
                        height={45}
                        className="h-12 w-auto object-contain"
                    />
                </Link>
            </div>

            <div className="flex-1 overflow-y-auto py-4">
                <nav className="px-3 space-y-1">
                    {navItems.map((item) => {
                        const isActive = pathname === item.href;
                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                className={clsx(
                                    "flex items-center px-4 py-3 text-sm font-medium rounded-xl transition-colors",
                                    isActive
                                        ? "bg-blue-50 text-blue-600"
                                        : "text-gray-500 hover:bg-gray-50 hover:text-gray-900"
                                )}
                            >
                                <item.icon className="mr-3 h-5 w-5" />
                                {item.label}
                            </Link>
                        );
                    })}

                    {/* Admin Link - Only visible to admins */}
                    {isAdmin && (
                        <div className="pt-4 mt-4 border-t border-gray-100">
                            <Link
                                href="/admin"
                                className="flex items-center px-4 py-3 text-sm font-medium rounded-xl text-purple-600 bg-purple-50 hover:bg-purple-100 transition-colors"
                            >
                                <ShieldAlert className="mr-3 h-5 w-5" />
                                Admin Panel
                            </Link>
                        </div>
                    )}
                </nav>
            </div>

            <div className="p-4 border-t border-gray-100">
                <button
                    onClick={handleLogout}
                    className="flex items-center w-full px-4 py-3 text-sm font-medium text-red-500 hover:bg-red-50 rounded-xl transition-colors"
                >
                    <LogOut className="mr-3 h-5 w-5" />
                    Log Out
                </button>
            </div>
        </div>
    );
}
