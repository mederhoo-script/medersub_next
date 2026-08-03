'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { ArrowLeft, Clock, ArrowDownLeft, ArrowUpRight, Receipt, X } from 'lucide-react';
import Link from 'next/link';
import clsx from 'clsx';

type TransactionReceipt = {
    id: string;
    user_id?: string;
    type?: string;
    amount?: number | string | null;
    charged_amount?: number | string | null;
    service_type?: string | null;
    status?: string | null;
    reference?: string | null;
    created_at: string;
    meta?: {
        service_type?: string;
        payment_source?: string;
        network?: string;
        mobile?: string;
        [key: string]: unknown;
    } | null;
};

type ReceiptRow = [string, string];

const formatCurrency = (value: number | string | null | undefined) => `₦${Number(value || 0).toLocaleString()}`;

const receiptRows = (tx: TransactionReceipt): ReceiptRow[] => [
    ['Receipt Ref', tx.reference || 'N/A'],
    ['Service', (tx.meta?.service_type || tx.service_type || tx.type || 'Transaction').toString().toUpperCase()],
    ['Status', tx.status || 'pending'],
    ['Amount Paid', formatCurrency(tx.charged_amount || tx.amount)],
    ...(tx.meta?.payment_source ? ([['Payment Source', tx.meta.payment_source]] as ReceiptRow[]) : []),
    ...(tx.meta?.network ? ([['Network / Provider', tx.meta.network]] as ReceiptRow[]) : []),
    ...(tx.meta?.mobile ? ([['Customer / Meter / IUC', tx.meta.mobile]] as ReceiptRow[]) : []),
    ['Date', new Date(tx.created_at).toLocaleString()],
];

export default function HistoryPage() {
    const [transactions, setTransactions] = useState<TransactionReceipt[]>([]);
    const [selectedReceipt, setSelectedReceipt] = useState<TransactionReceipt | null>(null);
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
                        <div key={tx.id} className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
                            <div className="flex justify-between items-center">
                                <div className="flex items-center gap-4">
                                    <div className={clsx("h-10 w-10 rounded-full flex items-center justify-center",
                                        tx.type === 'deposit' ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'
                                    )}>
                                        {tx.type === 'deposit' ? <ArrowDownLeft className="h-5 w-5" /> : <ArrowUpRight className="h-5 w-5" />}
                                    </div>
                                    <div>
                                        <h4 className="font-semibold text-gray-900 leading-tight">
                                            {(tx.meta?.service_type || tx.type || 'transaction').toUpperCase()}
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
                                        {tx.type === 'deposit' ? '+' : '-'}{formatCurrency(tx.charged_amount || tx.amount)}
                                    </span>
                                    <span className={clsx("text-xs capitalize px-2 py-0.5 rounded-full inline-block mt-1",
                                        tx.status === 'success' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                                    )}>
                                        {tx.status}
                                    </span>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => setSelectedReceipt(tx)}
                                className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg border border-blue-100 bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-100"
                            >
                                <Receipt className="h-4 w-4" /> View detailed receipt
                            </button>
                        </div>
                    ))
                )}
            </div>

            {selectedReceipt && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4" role="dialog" aria-modal="true">
                    <div className="max-h-[85vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
                        <div className="mb-5 flex items-start justify-between border-b border-gray-100 pb-4">
                            <div>
                                <p className="text-sm font-semibold uppercase tracking-wider text-blue-600">MEDERSUB Receipt</p>
                                <h2 className="text-xl font-bold text-gray-900">Transaction Details</h2>
                            </div>
                            <button onClick={() => setSelectedReceipt(null)} className="rounded-full p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700" aria-label="Close receipt">
                                <X className="h-5 w-5" />
                            </button>
                        </div>
                        <div className="space-y-3">
                            {receiptRows(selectedReceipt).map(([label, value]) => (
                                <div key={label} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] gap-4 border-b border-dashed border-gray-100 pb-2 text-sm">
                                    <span className="text-gray-500">{label}</span>
                                    <span className="min-w-0 break-words text-right font-semibold text-gray-900 capitalize">{value}</span>
                                </div>
                            ))}
                        </div>
                        <p className="mt-5 rounded-lg bg-gray-50 p-3 text-center text-xs text-gray-500">Keep this receipt for your records. Contact support with the receipt reference if you need help.</p>
                    </div>
                </div>
            )}
        </div>
    );
}
