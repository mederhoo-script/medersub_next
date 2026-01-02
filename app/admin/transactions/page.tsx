'use client';
import { useState, useEffect } from 'react';
import { Loader2, Search, ArrowUpRight, ArrowDownLeft } from 'lucide-react';
import clsx from 'clsx';

export default function AdminTransactionsPage() {
    const [transactions, setTransactions] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

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
        tx.profiles?.email?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-2xl font-bold text-gray-900">Transaction Logs</h1>
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <input
                        type="text"
                        placeholder="Search ref or email..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 w-64"
                    />
                </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Reference</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">User</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {loading ? (
                            <tr>
                                <td colSpan={6} className="px-6 py-8 text-center">
                                    <div className="flex justify-center"><Loader2 className="h-8 w-8 animate-spin text-blue-500" /></div>
                                </td>
                            </tr>
                        ) : filteredTx.length === 0 ? (
                            <tr>
                                <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
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
                                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-500">
                                        {new Date(tx.created_at).toLocaleDateString()}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
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
                                                    } catch (e) { alert('Error processing refund'); }
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
        </div>
    );
}
