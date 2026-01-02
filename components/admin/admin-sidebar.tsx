'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Users, FileText, Settings, LogOut, Wallet } from 'lucide-react';
import clsx from 'clsx';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';

const navItems = [
    { icon: Home, label: 'Overview', href: '/admin' },
    { icon: Users, label: 'Users', href: '/admin/users' },
    { icon: FileText, label: 'Transactions', href: '/admin/transactions' },
    { icon: Settings, label: 'Settings', href: '/admin/settings' },
];

export default function AdminSidebar() {
    const pathname = usePathname();
    const router = useRouter();

    const handleLogout = async () => {
        await supabase.auth.signOut();
        router.push('/login');
    };

    return (
        <div className="hidden md:flex flex-col w-64 bg-slate-900 text-white h-screen sticky top-0">
            <div className="p-6 border-b border-slate-800">
                <h1 className="text-xl font-bold tracking-wider">ADMIN PANEL</h1>
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
                                    "flex items-center px-4 py-3 text-sm font-medium rounded-lg transition-colors",
                                    isActive
                                        ? "bg-blue-600 text-white"
                                        : "text-slate-400 hover:bg-slate-800 hover:text-white"
                                )}
                            >
                                <item.icon className="mr-3 h-5 w-5" />
                                {item.label}
                            </Link>
                        );
                    })}
                </nav>
            </div>

            <div className="p-4 border-t border-slate-800">
                <button
                    onClick={handleLogout}
                    className="flex items-center w-full px-4 py-3 text-sm font-medium text-red-400 hover:bg-red-900/20 rounded-lg transition-colors"
                >
                    <LogOut className="mr-3 h-5 w-5" />
                    Sign Out
                </button>
            </div>
        </div>
    );
}
