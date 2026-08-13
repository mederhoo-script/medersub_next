"use client";
import { useEffect, useState } from 'react';
import { Loader2, Plus, Trash2, Edit } from 'lucide-react';

type Earning = any;

export default function AdminEarningsPage() {
  const [earnings, setEarnings] = useState<Earning[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ userId: '', amount: '', reference: '', note: '' });

  useEffect(() => {
    fetchEarnings();
  }, []);

  const fetchEarnings = async () => {
    try {
      const res = await fetch('/api/admin/earnings');
      const data = await res.json();
      if (Array.isArray(data)) setEarnings(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    try {
      const res = await fetch('/api/admin/earnings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: form.userId, amount: Number(form.amount), reference: form.reference, note: form.note })
      });
      const payload = await res.json();
      if (res.ok) {
        setForm({ userId: '', amount: '', reference: '', note: '' });
        fetchEarnings();
      } else {
        alert(payload.error || 'Failed');
      }
    } catch (e) {
      alert('Error creating earning');
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this earning and debit user?')) return;
    try {
      const res = await fetch('/api/admin/earnings', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ transactionId: id }) });
      const data = await res.json();
      if (res.ok) fetchEarnings(); else alert(data.error || 'Failed');
    } catch (e) { alert('Error'); }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl md:text-2xl font-bold">Admin Earnings</h1>
        <button onClick={() => window.scrollTo(0, 0)} className="inline-flex items-center gap-2 rounded bg-blue-600 px-3 py-2 text-white">
          <Plus className="h-4 w-4" /> New Earning
        </button>
      </div>

      <div className="bg-white p-4 rounded-xl border border-gray-200">
        <form onSubmit={handleCreate} className="grid grid-cols-1 md:grid-cols-4 gap-2">
          <input placeholder="User ID" value={form.userId} onChange={(e) => setForm({ ...form, userId: e.target.value })} className="border p-2 rounded" />
          <input placeholder="Amount" type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} className="border p-2 rounded" />
          <input placeholder="Reference (optional)" value={form.reference} onChange={(e) => setForm({ ...form, reference: e.target.value })} className="border p-2 rounded" />
          <div className="flex gap-2">
            <input placeholder="Note" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} className="border p-2 rounded flex-1" />
            <button disabled={creating} className="px-4 py-2 bg-green-600 text-white rounded">
              {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Credit'}
            </button>
          </div>
        </form>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-x-auto">
        <table className="min-w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="p-2 text-left">Ref</th>
              <th className="p-2 text-left">User</th>
              <th className="p-2 text-left">Amount</th>
              <th className="p-2 text-left">Date</th>
              <th className="p-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} className="p-6 text-center"><Loader2 className="h-6 w-6 animate-spin" /></td></tr>
            ) : earnings.length === 0 ? (
              <tr><td colSpan={5} className="p-6 text-center text-gray-500">No earnings</td></tr>
            ) : earnings.map((e: any) => (
              <tr key={e.id} className="border-t">
                <td className="p-2">{e.reference}</td>
                <td className="p-2">{e.profiles?.email || e.user_id}</td>
                <td className="p-2">₦{Number(e.amount).toLocaleString()}</td>
                <td className="p-2">{new Date(e.created_at).toLocaleString()}</td>
                <td className="p-2 text-right">
                  <button onClick={() => handleDelete(e.id)} className="inline-flex items-center gap-2 text-red-600 px-2 py-1 rounded bg-red-50"><Trash2 className="h-4 w-4" />Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
