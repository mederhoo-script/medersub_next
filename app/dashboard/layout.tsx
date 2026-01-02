import DashboardLayoutWrapper from '@/components/dashboard/dashboard-layout';

export default function Layout({ children }: { children: React.ReactNode }) {
    return (
        <DashboardLayoutWrapper>
            {children}
        </DashboardLayoutWrapper>
    );
}
