'use client';

import { ArrowLeft } from 'lucide-react';
import { usePathname, useRouter } from 'next/navigation';

export default function DashboardBackButton() {
  const pathname = usePathname();
  const router = useRouter();

  const routesWithOwnBackButton = ['/dashboard/airtime', '/dashboard/cable', '/dashboard/coming-soon', '/dashboard/data', '/dashboard/education', '/dashboard/electricity', '/dashboard/fund', '/dashboard/history'];
  if (!pathname || pathname === '/dashboard' || !pathname.startsWith('/dashboard/') || routesWithOwnBackButton.includes(pathname)) return null;

  const goBack = () => {
    if (window.history.length > 1) window.history.back();
    else router.push('/dashboard');
  };

  return (
    <button type="button" onClick={goBack} aria-label="Go back" title="Go back" className="mb-4 inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm transition-colors hover:bg-gray-50">
      <ArrowLeft className="h-4 w-4" />
      Back
    </button>
  );
}
