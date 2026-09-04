'use client';

import { ArrowLeft } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function AdminBackButton() {
  const router = useRouter();

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