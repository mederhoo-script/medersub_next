'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Home, Settings, History, CreditCard, User, ShieldAlert, LogOut } from 'lucide-react';
import clsx from 'clsx';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

const navItems = [
    { icon: Home, label: 'Home', href: '/dashboard' },
    { icon: History, label: 'History', href: '/dashboard/history' },
    { icon: CreditCard, label: 'Finance', href: '/dashboard/finance' },
    { icon: User, label: 'Me', href: '/dashboard/profile' },
    { icon: Settings, label: 'Settings', href: '/dashboard/settings' },
];

export default function MobileNav() {
    const pathname = usePathname();
    const router = useRouter();
    const [isAdmin, setIsAdmin] = useState(false);
    const [loggingOut, setLoggingOut] = useState(false);

    useEffect(() => {
        const checkRole = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                const { data } = await supabase.from('profiles').select('role').eq('id', user.id).single();
                if (data?.role === 'ADMIN') setIsAdmin(true);
            }
        };
        checkRole();
    }, []);

    const handleLogout = async () => {
        if (loggingOut) return;
        setLoggingOut(true);
        await supabase.auth.signOut();
        router.push('/login');
    };

    return (
        <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 py-2 px-2 z-50 pb-safe">
            <div className="flex justify-between items-center max-w-full mx-auto">
                {navItems.map((item) => {
                    const isActive = pathname === item.href;
                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={clsx(
                                "flex flex-col items-center justify-center flex-1 py-1 min-w-0",
                                isActive ? "text-blue-600" : "text-gray-400 hover:text-gray-600"
                            )}
                        >
                            <item.icon className={clsx("h-5 w-5 mb-1", isActive && "fill-current")} />
                            <span className="text-[9px] font-medium truncate">{item.label}</span>
                        </Link>
                    );
                })}

                {isAdmin && (
                    <Link
                        href="/admin"
                        className="flex flex-col items-center justify-center flex-1 py-1 text-purple-600 min-w-0"
                    >
                        <ShieldAlert className="h-5 w-5 mb-1" />
                        <span className="text-[9px] font-medium">Admin Panel</span>
                    </Link>
                )}

                {/* Logout Button */}
                <button
                    onClick={handleLogout}
                    disabled={loggingOut}
                    className="flex flex-col items-center justify-center flex-1 py-1 text-red-500 hover:text-red-600 disabled:opacity-50 min-w-0"
                >
                    <LogOut className="h-5 w-5 mb-1" />
                    <span className="text-[9px] font-medium">Logout</span>
                </button>
            </div>
        </div>
    );
}
