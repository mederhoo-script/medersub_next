'use client';
import { ReactNode } from 'react';
import Sidebar from '@/components/dashboard/sidebar';
import MobileNav from '@/components/dashboard/mobile-nav';

export default function DashboardLayoutWrapper({ children }: { children: ReactNode }) {
    return (
        <div className="min-h-screen bg-gray-50 flex">
            {/* Sidebar for Desktop */}
            <Sidebar />

            {/* Main Content Area */}
            <main className="flex-1 pb-20 md:pb-0 overflow-x-hidden">
                <div className="max-w-4xl mx-auto p-4 md:p-8">
                    {children}
                </div>
            </main>

            {/* Mobile Navigation */}
            <MobileNav />
        </div>
    );
}
