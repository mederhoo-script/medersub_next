import AdminSidebar from '@/components/admin/admin-sidebar';
import AdminMobileNav from '@/components/admin/admin-mobile-nav';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
    return (
        <div className="min-h-screen bg-gray-100 flex">
            <AdminSidebar />
            <main className="flex-1 p-4 md:p-8 pb-20 md:pb-8 overflow-y-auto">
                {children}
            </main>
            <AdminMobileNav />
        </div>
    );
}
