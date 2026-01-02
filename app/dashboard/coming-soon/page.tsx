'use client';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Clock } from 'lucide-react';
import { Suspense } from 'react';

function ComingSoonContent() {
    const searchParams = useSearchParams();
    const feature = searchParams.get('feature') || 'This Feature';

    return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
            <div className="bg-blue-50 p-6 rounded-full mb-6">
                <Clock className="h-12 w-12 text-blue-600" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">{feature} is Coming Soon</h1>
            <p className="text-gray-500 max-w-md mb-8">
                We are currently working hard to bring {feature} to the platform. Please check back later!
            </p>
            <Link href="/dashboard" className="flex items-center text-blue-600 font-medium hover:underline">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Dashboard
            </Link>
        </div>
    );
}

export default function ComingSoonPage() {
    return (
        <Suspense fallback={<div>Loading...</div>}>
            <ComingSoonContent />
        </Suspense>
    );
}
