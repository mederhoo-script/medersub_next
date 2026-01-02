'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { ArrowLeft, Clock, ArrowDownLeft, ArrowUpRight } from 'lucide-react';
import Link from 'next/link';
import clsx from 'clsx';

export default function HistoryPage() {
    const [transactions, setTransactions] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchHistory = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                const { data } = await supabase
                    .from('transactions')
                    .select('*')
                    .eq('user_id', user.id)
                    .order('created_at', { ascending: false });
                setTransactions(data || []);
            }
            setLoading(false);
        };
        fetchHistory();
    }, []);

    return (
        <div className="max-w-2xl mx-auto">
            <div className="flex items-center gap-4 mb-6">
                <Link href="/dashboard" className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                    <ArrowLeft className="h-5 w-5 text-gray-600" />
                </Link>
                <h1 className="text-xl font-bold text-gray-900">Transaction History</h1>
                <h1 className="text-2xl  font-bold text-blue-600 tracking-tight">MEDERSUB</h1>
            </div>

            <div className="space-y-4">
                {loading ? (
                    <div className="text-center py-10 text-gray-400">Loading...</div>
                ) : transactions.length === 0 ? (
                    <div className="text-center py-10 bg-white rounded-xl border border-gray-100">
                        <Clock className="h-10 w-10 text-gray-300 mx-auto mb-3" />
                        <p className="text-gray-500">No transactions yet.</p>
                    </div>
                ) : (
                    transactions.map((tx) => (
                        <div key={tx.id} className="bg-white p-4 rounded-xl border border-gray-100 flex justify-between items-center shadow-sm">
                            <div className="flex items-center gap-4">
                                <div className={clsx("h-10 w-10 rounded-full flex items-center justify-center",
                                    tx.type === 'deposit' ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'
                                )}>
                                    {tx.type === 'deposit' ? <ArrowDownLeft className="h-5 w-5" /> : <ArrowUpRight className="h-5 w-5" />}
                                </div>
                                <div>
                                    <h4 className="font-semibold text-gray-900 leading-tight">
                                        {(tx.meta?.service_type || tx.type).toUpperCase()}
                                    </h4>
                                    <p className="text-xs text-gray-500 mt-1">
                                        {new Date(tx.created_at).toLocaleDateString()} • {new Date(tx.created_at).toLocaleTimeString()}
                                    </p>
                                </div>
                            </div>
                            <div className="text-right">
                                <span className={clsx("font-bold block",
                                    tx.type === 'deposit' ? 'text-green-600' : 'text-gray-900'
                                )}>
                                    {tx.type === 'deposit' ? '+' : '-'}₦{tx.amount?.toLocaleString()}
                                </span>
                                <span className={clsx("text-xs capitalize px-2 py-0.5 rounded-full inline-block mt-1",
                                    tx.status === 'success' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                                )}>
                                    {tx.status}
                                </span>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
