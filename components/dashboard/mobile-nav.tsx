'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Settings, History, CreditCard, User, ShieldAlert } from 'lucide-react';
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
    const [isAdmin, setIsAdmin] = useState(false);

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

    return (
        <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 py-2 px-4 z-50 pb-safe">
            <div className="flex justify-between items-center max-w-sm mx-auto">
                {navItems.map((item) => {
                    const isActive = pathname === item.href;
                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={clsx(
                                "flex flex-col items-center justify-center w-16 py-1",
                                isActive ? "text-blue-600" : "text-gray-400 hover:text-gray-600"
                            )}
                        >
                            <item.icon className={clsx("h-6 w-6 mb-1", isActive && "fill-current")} />
                            <span className="text-[10px] font-medium">{item.label}</span>
                        </Link>
                    );
                })}

                {isAdmin && (
                    <Link
                        href="/admin"
                        className="flex flex-col items-center justify-center w-16 py-1 text-purple-600"
                    >
                        <ShieldAlert className="h-6 w-6 mb-1" />
                        <span className="text-[10px] font-medium">Admin</span>
                    </Link>
                )}
            </div>
        </div>
    );
}
