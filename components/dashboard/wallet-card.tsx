'use client';
import { useState } from 'react';
import Link from 'next/link';
import { Copy, Eye, EyeOff, Plus, Send } from 'lucide-react';

export default function WalletCard({
    mainBalance = 0,
    rewardBalance = 0,
    loading = false,
    virtualAccount = null,
}: {
    mainBalance?: number;
    rewardBalance?: number;
    loading?: boolean;
    virtualAccount?: { account_number: string; bank_name: string; account_name?: string } | null;
} = {}) {
    const [visible, setVisible] = useState(true);
    const [copied, setCopied] = useState(false);

    const copyAccountNumber = async () => {
        if (!virtualAccount?.account_number) return;
        await navigator.clipboard.writeText(virtualAccount.account_number);
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1500);
    };

    return (
        <div className="bg-blue-600 rounded-2xl p-6 text-white shadow-lg shadow-blue-200 mb-8 relative overflow-hidden">
            {/* Background Pattern */}
            <div className="absolute top-0 right-0 -mt-4 -mr-4 w-32 h-32 bg-blue-500 rounded-full opacity-50 blur-2xl"></div>
            <div className="absolute bottom-0 left-0 -mb-4 -ml-4 w-24 h-24 bg-blue-400 rounded-full opacity-30 blur-xl"></div>

            <div className="relative z-10">
                <div className="mb-4 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                        <p className="text-blue-100 text-sm font-medium mb-1">Balances</p>
                        <div className="flex items-center gap-3">
                            <div className="space-y-1">
                                <p className="text-sm text-blue-100">
                                    Main Wallet:{' '}
                                    <span className="font-bold text-white">
                                        {loading ? 'Loading...' : (visible ? `₦${mainBalance.toLocaleString()}` : '••••••••')}
                                    </span>
                                </p>
                                <p className="text-sm text-blue-100">
                                    Reward Balance:{' '}
                                    <span className="font-bold text-white">
                                        {loading ? 'Loading...' : (visible ? `₦${rewardBalance.toLocaleString()}` : '••••••••')}
                                    </span>
                                </p>
                            </div>
                            {!loading && (
                                <button
                                    onClick={() => setVisible(!visible)}
                                    className="p-1.5 hover:bg-blue-500/30 rounded-full transition-colors"
                                >
                                    {visible ? <Eye className="h-4 w-4 text-blue-100" /> : <EyeOff className="h-4 w-4 text-blue-100" />}
                                </button>
                            )}
                        </div>
                    </div>

                    {virtualAccount && (
                    <div className='rounded-xl border border-blue-400/30 bg-blue-500/30 p-3 text-sm sm:w-64 sm:shrink-0'>
                        <p className='text-xs font-medium text-blue-100'>Your KoraPay account</p>
                        <p className='mt-1 text-xs text-blue-100'>{virtualAccount.bank_name}</p>
                        <div className='mt-1 flex items-center justify-between gap-3'>
                            <span className='font-bold tracking-wide'>{virtualAccount.account_number}</span>
                            <button onClick={copyAccountNumber} className='inline-flex items-center gap-1 rounded-lg bg-white/15 px-2 py-1 text-xs font-semibold hover:bg-white/25' aria-label='Copy account number'>
                                <Copy className='h-3.5 w-3.5' /> {copied ? 'Copied' : 'Copy'}
                            </button>
                        </div>
                    </div>
                    )}
                </div>

                <div className='flex gap-3 mt-6'>
                    <Link href="/dashboard/fund" className="flex-1 bg-white text-blue-600 py-2.5 px-4 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 hover:bg-blue-50 transition-colors shadow-sm">
                        <Plus className="h-4 w-4" /> Fund Wallet
                    </Link>
                    {/* Transfer feature not yet implemented, hidden or disabled */}
                    <button className="flex-1 bg-blue-500/40 text-white py-2.5 px-4 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 hover:bg-blue-500/50 transition-colors backdrop-blur-sm border border-blue-400/30">
                        <Send className="h-4 w-4" /> Transfer
                    </button>
                </div>
            </div>
        </div>
    );
}
