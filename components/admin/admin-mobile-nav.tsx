'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Home, Users, FileText, Settings, Wallet, LogOut } from 'lucide-react';
import clsx from 'clsx';
import { supabase } from '@/lib/supabase';
import { useState } from 'react';

const navItems = [
    { icon: Home, label: 'Overview', href: '/admin' },
    { icon: Users, label: 'Users', href: '/admin/users' },
    { icon: Wallet, label: 'Services', href: '/admin/services' },
    { icon: FileText, label: 'Trans', href: '/admin/transactions' },
    { icon: Settings, label: 'Settings', href: '/admin/settings' },
];

export default function AdminMobileNav() {
    const pathname = usePathname();
    const router = useRouter();
    const [loggingOut, setLoggingOut] = useState(false);

    const handleLogout = async () => {
        if (loggingOut) return;
        setLoggingOut(true);
        await supabase.auth.signOut();
        router.push('/login');
    };

    return (
        <div className="md:hidden fixed bottom-0 left-0 right-0 bg-slate-900 border-t border-slate-800 py-2 px-2 z-50 pb-safe">
            <div className="flex justify-between items-center max-w-full mx-auto">
                {navItems.map((item) => {
                    const isActive = pathname === item.href;
                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={clsx(
                                "flex flex-col items-center justify-center flex-1 py-1 min-w-0",
                                isActive ? "text-blue-400" : "text-slate-400 hover:text-slate-200"
                            )}
                        >
                            <item.icon className={clsx("h-5 w-5 mb-1", isActive && "fill-current")} />
                            <span className="text-[9px] font-medium truncate">{item.label}</span>
                        </Link>
                    );
                })}
                
                {/* Logout Button */}
                <button
                    onClick={handleLogout}
                    disabled={loggingOut}
                    className="flex flex-col items-center justify-center flex-1 py-1 text-red-400 hover:text-red-300 disabled:opacity-50 min-w-0"
                >
                    <LogOut className="h-5 w-5 mb-1" />
                    <span className="text-[9px] font-medium">Logout</span>
                </button>
            </div>
        </div>
    );
}
