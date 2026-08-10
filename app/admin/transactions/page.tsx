'use client';
import { useState, useEffect } from 'react';
import { Loader2, Search, Receipt, X } from 'lucide-react';
import clsx from 'clsx';

type AdminTransaction = {
    id: string;
    user_id?: string;
    type?: string;
    amount?: number | string | null;
    charged_amount?: number | string | null;
    service_type?: string | null;
    status?: string | null;
    reference?: string | null;
    created_at: string;
    profiles?: { full_name?: string | null; email?: string | null } | null;
    meta?: {
        provider_ref?: string;
        inlomax_id?: string;
        service_type?: string;
        mobile?: string;
        network?: string;
        payment_source?: string;
        [key: string]: unknown;
    } | null;
};

export default function AdminTransactionsPage() {
    const [transactions, setTransactions] = useState<AdminTransaction[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedReceipt, setSelectedReceipt] = useState<AdminTransaction | null>(null);

    useEffect(() => {
        const fetchTx = async () => {
            try {
                const res = await fetch('/api/admin/transactions');
                const data = await res.json();
                if (Array.isArray(data)) {
                    setTransactions(data);
                }
            } catch (error) {
                console.error('Failed to fetch transactions', error);
            } finally {
                setLoading(false);
            }
        };
        fetchTx();
    }, []);

    const filteredTx = transactions.filter(tx =>
        tx.reference?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        tx.meta?.inlomax_id?.toLowerCase?.().includes(searchTerm.toLowerCase()) ||
        tx.meta?.provider_ref?.toLowerCase?.().includes(searchTerm.toLowerCase()) ||
        tx.profiles?.email?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4">
                <h1 className="text-xl md:text-2xl font-bold text-gray-900">Transaction Logs</h1>
                <div className="relative flex-1 md:flex-none md:w-64">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <input
                        type="text"
                        placeholder="Search ref or email..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Reference</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">User</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Inlomax ID</th>
                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {loading ? (
                            <tr>
                                <td colSpan={8} className="px-6 py-8 text-center">
                                    <div className="flex justify-center"><Loader2 className="h-8 w-8 animate-spin text-blue-500" /></div>
                                </td>
                            </tr>
                        ) : filteredTx.length === 0 ? (
                            <tr>
                                <td colSpan={8} className="px-6 py-8 text-center text-gray-500">
                                    No transactions found.
                                </td>
                            </tr>
                        ) : (
                            filteredTx.map((tx) => (
                                <tr key={tx.id} className="hover:bg-gray-50">
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                        {tx.reference}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                        <div>{tx.profiles?.full_name || 'Unknown'}</div>
                                        <div className="text-xs text-gray-400">{tx.profiles?.email}</div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 uppercase">
                                        {tx.type}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold">
                                        <span className={tx.type === 'deposit' ? 'text-green-600' : 'text-gray-900'}>
                                            {tx.type === 'deposit' ? '+' : '-'}₦{tx.amount?.toLocaleString()}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <span className={clsx("px-2 inline-flex text-xs leading-5 font-semibold rounded-full capitalize",
                                            tx.status === 'success' ? 'bg-green-100 text-green-800' :
                                                tx.status === 'pending' ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-800'
                                        )}>
                                            {tx.status}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-xs text-gray-600">
                                        {tx.meta?.inlomax_id || tx.meta?.provider_ref || 'N/A'}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-500">
                                        {new Date(tx.created_at).toLocaleDateString()}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                        <button
                                            type="button"
                                            onClick={() => setSelectedReceipt(tx)}
                                            className="mr-2 inline-flex items-center gap-1 rounded-md bg-blue-50 px-3 py-1 text-xs text-blue-700 hover:bg-blue-100"
                                        >
                                            <Receipt className="h-3 w-3" /> Receipt
                                        </button>
                                        {(tx.status === 'success' || tx.status === 'failed') && tx.type !== 'refund' && tx.type !== 'deposit' && (
                                            <button
                                                onClick={async () => {
                                                    if (!confirm('Are you sure you want to refund this transaction?')) return;
                                                    try {
                                                        const res = await fetch('/api/admin/transactions/refund', {
                                                            method: 'POST',
                                                            body: JSON.stringify({ transactionId: tx.id, reason: 'Admin Manual Refund' })
                                                        });
                                                        if (res.ok) {
                                                            alert('Refund Successful');
                                                            window.location.reload();
                                                        } else {
                                                            alert('Refund Failed');
                                                        }
                                                    } catch { alert('Error processing refund'); }
                                                }}
                                                className="text-red-600 hover:text-red-900 bg-red-50 px-3 py-1 rounded-md text-xs"
                                            >
                                                Refund
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {selectedReceipt && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4" role="dialog" aria-modal="true">
                    <div className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
                        <div className="mb-5 flex items-start justify-between border-b border-gray-100 pb-4">
                            <div>
                                <p className="text-sm font-semibold uppercase tracking-wider text-blue-600">Admin Receipt</p>
                                <h2 className="text-xl font-bold text-gray-900">Transaction Trace Details</h2>
                            </div>
                            <button onClick={() => setSelectedReceipt(null)} className="rounded-full p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700" aria-label="Close receipt">
                                <X className="h-5 w-5" />
                            </button>
                        </div>
                        <div className="grid gap-3 text-sm">
                            {[
                                ['Receipt Ref', selectedReceipt.reference || 'N/A'],
                                ['Inlomax ID', selectedReceipt.meta?.inlomax_id || 'N/A'],
                                ['Provider Reference', selectedReceipt.meta?.provider_ref || selectedReceipt.reference || 'N/A'],
                                ['User', selectedReceipt.profiles?.email || selectedReceipt.user_id || 'Unknown'],
                                ['Service', (selectedReceipt.meta?.service_type || selectedReceipt.service_type || selectedReceipt.type || 'Transaction').toString().toUpperCase()],
                                ['Customer / Meter / IUC', selectedReceipt.meta?.mobile || 'N/A'],
                                ['Network / Provider', selectedReceipt.meta?.network || 'N/A'],
                                ['Amount', `₦${Number(selectedReceipt.amount || 0).toLocaleString()}`],
                                ['Total Charged', `₦${Number(selectedReceipt.charged_amount || selectedReceipt.amount || 0).toLocaleString()}`],
                                ['Payment Source', selectedReceipt.meta?.payment_source || 'wallet'],
                                ['Status', selectedReceipt.status || 'pending'],
                                ['Date', new Date(selectedReceipt.created_at).toLocaleString()],
                            ].map(([label, value]) => (
                                <div key={label} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)] gap-4 border-b border-dashed border-gray-100 pb-2">
                                    <span className="text-gray-500">{label}</span>
                                    <span className="min-w-0 break-words text-right font-semibold text-gray-900">{value}</span>
                                </div>
                            ))}
                        </div>
                        <p className="mt-5 rounded-lg bg-amber-50 p-3 text-xs text-amber-700">The Inlomax ID is shown only in the admin receipt so you can trace the transaction with your API provider.</p>
                    </div>
                </div>
            )}
        </div>
    );
}

