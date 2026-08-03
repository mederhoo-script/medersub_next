'use client';
import { useState, useEffect } from 'react';
import { Loader2, Search, Edit, FileText, X, Trash2 } from 'lucide-react';
import Link from 'next/link';

type AdminUser = {
    id: string;
    email?: string | null;
    full_name?: string | null;
    role?: string | null;
    telegram_id?: string | number | null;
    telegram_username?: string | null;
    balance?: number | string | null;
    created_at: string;
    is_blocked?: boolean | null;
};

export default function AdminUsersPage() {
    const [users, setUsers] = useState<AdminUser[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [editingUser, setEditingUser] = useState<AdminUser | null>(null);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        fetchUsers();
    }, []);

    const fetchUsers = async () => {
        try {
            const res = await fetch('/api/admin/users');
            const data = await res.json();
            if (Array.isArray(data)) setUsers(data);
        } catch (error) {
            console.error('Failed to fetch users', error);
        } finally {
            setLoading(false);
        }
    };

    const handleUpdateUser = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingUser) return;
        setSaving(true);
        try {
            const res = await fetch('/api/admin/users', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id: editingUser.id,
                    full_name: editingUser.full_name,
                    role: editingUser.role,
                    balance: editingUser.balance
                })
            });
            if (res.ok) {
                alert('User updated successfully');
                setEditingUser(null);
                fetchUsers();
            } else {
                alert('Failed to update user');
            }
        } catch {
            alert('Error updating user');
        } finally {
            setSaving(false);
        }
    };

    const getNormalizedRole = (role: string | null | undefined) => String(role || '').toLowerCase();

    const handleDeleteUser = async (user: AdminUser) => {
        if (!confirm(`Are you sure you want to permanently delete user "${user.full_name || user.email}"? This action cannot be undone.`)) return;
        try {
            const res = await fetch('/api/admin/users', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: user.id })
            });
            if (res.ok) {
                fetchUsers();
            } else {
                const data = await res.json();
                alert('Failed to delete user: ' + (data.error || 'Unknown error'));
            }
        } catch {
            alert('Error deleting user');
        }
    };

    const normalizedSearch = searchTerm.toLowerCase();
    const filteredUsers = users.filter(u =>
        u.email?.toLowerCase().includes(normalizedSearch) ||
        u.full_name?.toLowerCase().includes(normalizedSearch) ||
        String(u.telegram_id || '').toLowerCase().includes(normalizedSearch) ||
        String(u.telegram_username || '').toLowerCase().includes(normalizedSearch)
    );

    return (
        <div className="space-y-6 relative">
            <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4">
                <h1 className="text-xl md:text-2xl font-bold text-gray-900">User Management</h1>
                <div className="flex gap-3">
                    <div className="relative flex-1 md:flex-none">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Search users..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full md:w-auto pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                    </div>
                    {/* Manual Add User is complex with Supabase Auth (requires admin API), usually invite only or manual db insert. keeping button as placeholder or for manual funding flow? */}
                </div>
            </div>

            <div className="hidden md:block bg-white rounded-xl shadow-sm border border-gray-200 overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">User</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Role</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Telegram</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Balance</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Joined</th>
                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {loading ? (
                            <tr>
                                <td colSpan={6} className="px-6 py-8 text-center">
                                    <div className="flex justify-center"><Loader2 className="h-8 w-8 animate-spin text-blue-500" /></div>
                                </td>
                            </tr>
                        ) : filteredUsers.length === 0 ? (
                            <tr>
                                <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                                    No users found.
                                </td>
                            </tr>
                        ) : (
                            filteredUsers.map((user) => (
                                <tr key={user.id} className="hover:bg-gray-50">
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="flex items-center">
                                            <div className="h-10 w-10 flex-shrink-0">
                                                <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold">
                                                    {user.full_name?.charAt(0) || user.email?.charAt(0)}
                                                </div>
                                            </div>
                                            <div className="ml-4">
                                                <div className="text-sm font-medium text-gray-900">{user.full_name || 'N/A'}</div>
                                                <div className="text-sm text-gray-500">{user.email}</div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getNormalizedRole(user.role) === 'admin' ? 'bg-purple-100 text-purple-800' : 'bg-green-100 text-green-800'}`}>
                                            {user.role}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        {user.telegram_id ? (
                                            <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800" title={`Telegram: @${user.telegram_username || user.telegram_id}`}>
                                                @{user.telegram_username || user.telegram_id}
                                            </span>
                                        ) : (
                                            <span className="text-gray-500 text-sm">—</span>
                                        )}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                        ₦{user.balance?.toLocaleString()}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                        {new Date(user.created_at).toLocaleDateString()}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium flex justify-end gap-2">
                                        <button
                                            onClick={() => setEditingUser(user)}
                                            className="text-blue-600 hover:text-blue-900 p-1 bg-blue-50 rounded" title="Edit User"
                                        >
                                            <Edit className="h-4 w-4" />
                                        </button>
                                        <Link
                                            href={`/admin/transactions?search=${user.email}`}
                                            className="text-gray-600 hover:text-gray-900 p-1 bg-gray-100 rounded" title="View Transactions"
                                        >
                                            <FileText className="h-4 w-4" />
                                        </Link>
                                        <button
                                            onClick={async () => {
                                                const action = user.is_blocked ? 'UNBLOCK' : 'BLOCK';
                                                if (!confirm(`Are you sure you want to ${action} this user?`)) return;
                                                try {
                                                    await fetch('/api/admin/users/block', {
                                                        method: 'POST', body: JSON.stringify({ userId: user.id, action })
                                                    });
                                                    fetchUsers();
                                                } catch (e) { console.error(e); }
                                            }}
                                            className={`text-xs px-2 py-1 rounded border ${user.is_blocked ? 'text-green-600 border-green-200 bg-green-50' : 'text-red-600 border-red-200 bg-red-50'}`}
                                        >
                                            {user.is_blocked ? 'Unblock' : 'Block'}
                                        </button>
                                        <button
                                            onClick={() => handleDeleteUser(user)}
                                            className="text-red-600 hover:text-red-900 p-1 bg-red-50 rounded" title="Delete User"
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </button>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            <div className="space-y-4 md:hidden">
                {loading ? (
                    <div className="flex justify-center rounded-xl border border-gray-200 bg-white py-8 shadow-sm">
                        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
                    </div>
                ) : filteredUsers.length === 0 ? (
                    <div className="rounded-xl border border-gray-200 bg-white px-4 py-8 text-center text-gray-500 shadow-sm">
                        No users found.
                    </div>
                ) : (
                    filteredUsers.map((user) => (
                        <div key={user.id} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                            <div className="flex items-start justify-between gap-3">
                                <div className="flex min-w-0 items-center gap-3">
                                    <div className="h-10 w-10 flex-shrink-0 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold">
                                        {user.full_name?.charAt(0) || user.email?.charAt(0)}
                                    </div>
                                    <div className="min-w-0">
                                        <p className="truncate text-sm font-semibold text-gray-900">{user.full_name || 'N/A'}</p>
                                        <p className="truncate text-xs text-gray-500">{user.email}</p>
                                    </div>
                                </div>
                                <span className={`shrink-0 rounded-full px-2 py-1 text-xs font-semibold ${getNormalizedRole(user.role) === 'admin' ? 'bg-purple-100 text-purple-800' : 'bg-green-100 text-green-800'}`}>
                                    {String(user.role || 'user').toUpperCase()}
                                </span>
                            </div>

                            <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                                <div>
                                    <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Balance</p>
                                    <p className="font-semibold text-gray-900">₦{user.balance?.toLocaleString()}</p>
                                </div>
                                <div>
                                    <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Joined</p>
                                    <p className="font-semibold text-gray-900">{new Date(user.created_at).toLocaleDateString()}</p>
                                </div>
                                <div className="col-span-2">
                                    <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Telegram</p>
                                    <p className="truncate font-semibold text-gray-900">{user.telegram_id ? `@${user.telegram_username || user.telegram_id}` : '—'}</p>
                                </div>
                            </div>

                            <div className="mt-4 grid grid-cols-2 gap-2">
                                <button
                                    type="button"
                                    onClick={() => setEditingUser(user)}
                                    className="flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700"
                                >
                                    <Edit className="h-4 w-4" />
                                    Edit role
                                </button>
                                <Link
                                    href={`/admin/transactions?search=${user.email}`}
                                    className="flex items-center justify-center gap-2 rounded-lg bg-gray-100 px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-200"
                                >
                                    <FileText className="h-4 w-4" />
                                    Transactions
                                </Link>
                                <button
                                    type="button"
                                    onClick={async () => {
                                        const action = user.is_blocked ? 'UNBLOCK' : 'BLOCK';
                                        if (!confirm(`Are you sure you want to ${action} this user?`)) return;
                                        try {
                                            await fetch('/api/admin/users/block', {
                                                method: 'POST', body: JSON.stringify({ userId: user.id, action })
                                            });
                                            fetchUsers();
                                        } catch (e) { console.error(e); }
                                    }}
                                    className={`rounded-lg border px-3 py-2 text-sm font-semibold ${user.is_blocked ? 'border-green-200 bg-green-50 text-green-700' : 'border-red-200 bg-red-50 text-red-700'}`}
                                >
                                    {user.is_blocked ? 'Unblock' : 'Block'}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => handleDeleteUser(user)}
                                    className="flex items-center justify-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700"
                                >
                                    <Trash2 className="h-4 w-4" />
                                    Delete
                                </button>
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* Edit Modal */}
            {editingUser && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-2xl">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-lg font-bold">Edit User</h3>
                            <button onClick={() => setEditingUser(null)}><X className="h-5 w-5 text-gray-500" /></button>
                        </div>
                        <form onSubmit={handleUpdateUser} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700">Full Name</label>
                                <input
                                    type="text"
                                    value={editingUser.full_name || ''}
                                    onChange={(e) => setEditingUser({ ...editingUser, full_name: e.target.value })}
                                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 border p-2"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700">Role</label>
                                <select
                                    value={editingUser.role || 'user'}
                                    onChange={(e) => setEditingUser({ ...editingUser, role: e.target.value })}
                                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 border p-2"
                                >
                                    <option value="user">USER</option>
                                    <option value="admin">ADMIN</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700">Wallet Balance (₦)</label>
                                <input
                                    type="number"
                                    value={editingUser.balance ?? ''}
                                    onChange={(e) => setEditingUser({ ...editingUser, balance: e.target.value })}
                                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 border p-2"
                                />
                                <p className="text-xs text-gray-500 mt-1">Directly overriding the balance.</p>
                            </div>
                            <div className="pt-4 flex justify-end gap-2">
                                <button type="button" onClick={() => setEditingUser(null)} className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg">Cancel</button>
                                <button type="submit" disabled={saving} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
                                    {saving ? 'Saving...' : 'Save Changes'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
