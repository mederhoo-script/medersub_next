'use client';
import { useState, useEffect } from 'react';
import { Loader2, Search, Plus, Edit, Trash2, X, Send } from 'lucide-react';

interface TelegramUser {
    id: string;
    email: string;
    full_name: string | null;
    role: string;
    telegram_id: string;
    telegram_username: string | null;
    telegram_linked_at: string | null;
    created_at: string;
}

interface AllUser {
    id: string;
    email: string;
    full_name: string | null;
}

export default function AdminTelegramUsersPage() {
    const [telegramUsers, setTelegramUsers] = useState<TelegramUser[]>([]);
    const [allUsers, setAllUsers] = useState<AllUser[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [showModal, setShowModal] = useState(false);
    const [editingUser, setEditingUser] = useState<TelegramUser | null>(null);
    const [saving, setSaving] = useState(false);
    const [form, setForm] = useState({ user_id: '', telegram_id: '', telegram_username: '' });

    useEffect(() => {
        fetchTelegramUsers();
        fetchAllUsers();
    }, []);

    const fetchTelegramUsers = async () => {
        try {
            const res = await fetch('/api/admin/telegram-users');
            const data = await res.json();
            if (Array.isArray(data)) setTelegramUsers(data);
        } catch (error) {
            console.error('Failed to fetch telegram users', error);
        } finally {
            setLoading(false);
        }
    };

    const fetchAllUsers = async () => {
        try {
            const res = await fetch('/api/admin/users');
            const data = await res.json();
            if (Array.isArray(data)) setAllUsers(data);
        } catch (error) {
            console.error('Failed to fetch users', error);
        }
    };

    const openCreateModal = () => {
        setEditingUser(null);
        setForm({ user_id: '', telegram_id: '', telegram_username: '' });
        setShowModal(true);
    };

    const openEditModal = (user: TelegramUser) => {
        setEditingUser(user);
        setForm({ user_id: user.id, telegram_id: user.telegram_id, telegram_username: user.telegram_username || '' });
        setShowModal(true);
    };

    const closeModal = () => {
        setShowModal(false);
        setEditingUser(null);
        setForm({ user_id: '', telegram_id: '', telegram_username: '' });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!form.user_id || !form.telegram_id) return;
        setSaving(true);
        try {
            const res = await fetch('/api/admin/telegram-users', {
                method: editingUser ? 'PUT' : 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(form),
            });
            const data = await res.json();
            if (res.ok) {
                closeModal();
                fetchTelegramUsers();
            } else {
                alert('Error: ' + (data.error || 'Unknown error'));
            }
        } catch (error) {
            alert('Failed to save');
        } finally {
            setSaving(false);
        }
    };

    const handleUnlink = async (user: TelegramUser) => {
        if (!confirm(`Unlink Telegram (@${user.telegram_username || user.telegram_id}) from "${user.full_name || user.email}"?`)) return;
        try {
            const res = await fetch('/api/admin/telegram-users', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ user_id: user.id }),
            });
            if (res.ok) {
                fetchTelegramUsers();
            } else {
                const data = await res.json();
                alert('Failed to unlink: ' + (data.error || 'Unknown error'));
            }
        } catch (error) {
            alert('Error unlinking');
        }
    };

    const filtered = telegramUsers.filter(u =>
        u.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        u.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        u.telegram_id?.includes(searchTerm) ||
        u.telegram_username?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    // Users without telegram linked (for the create form dropdown)
    const unlinkedUsers = allUsers.filter(u => !telegramUsers.some(t => t.id === u.id));

    return (
        <div className="space-y-6 relative">
            <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4">
                <h1 className="text-xl md:text-2xl font-bold text-gray-900">Telegram Users</h1>
                <div className="flex gap-3">
                    <div className="relative flex-1 md:flex-none">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Search..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full md:w-auto pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                    </div>
                    <button
                        onClick={openCreateModal}
                        className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition whitespace-nowrap"
                    >
                        <Plus className="h-4 w-4 mr-2" /> Link Telegram
                    </button>
                </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">User</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Telegram ID</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Username</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Linked At</th>
                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {loading ? (
                            <tr>
                                <td colSpan={5} className="px-6 py-8 text-center">
                                    <div className="flex justify-center"><Loader2 className="h-8 w-8 animate-spin text-blue-500" /></div>
                                </td>
                            </tr>
                        ) : filtered.length === 0 ? (
                            <tr>
                                <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                                    No telegram-linked users found.
                                </td>
                            </tr>
                        ) : (
                            filtered.map((user) => (
                                <tr key={user.id} className="hover:bg-gray-50">
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="flex items-center">
                                            <div className="h-9 w-9 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold flex-shrink-0">
                                                <Send className="h-4 w-4" />
                                            </div>
                                            <div className="ml-3">
                                                <div className="text-sm font-medium text-gray-900">{user.full_name || 'N/A'}</div>
                                                <div className="text-sm text-gray-500">{user.email}</div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 font-mono">
                                        {user.telegram_id}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                        {user.telegram_username ? (
                                            <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800">
                                                @{user.telegram_username}
                                            </span>
                                        ) : '—'}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                        {user.telegram_linked_at
                                            ? new Date(user.telegram_linked_at).toLocaleDateString()
                                            : '—'}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium flex justify-end gap-2">
                                        <button
                                            onClick={() => openEditModal(user)}
                                            className="text-blue-600 hover:text-blue-900 p-1 bg-blue-50 rounded" title="Edit"
                                        >
                                            <Edit className="h-4 w-4" />
                                        </button>
                                        <button
                                            onClick={() => handleUnlink(user)}
                                            className="text-red-600 hover:text-red-900 p-1 bg-red-50 rounded" title="Unlink Telegram"
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

            {/* Create / Edit Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-2xl">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-lg font-bold">{editingUser ? 'Edit Telegram Link' : 'Link Telegram Account'}</h3>
                            <button onClick={closeModal}><X className="h-5 w-5 text-gray-500" /></button>
                        </div>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            {!editingUser && (
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">User</label>
                                    <select
                                        required
                                        value={form.user_id}
                                        onChange={(e) => setForm({ ...form, user_id: e.target.value })}
                                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 border p-2"
                                    >
                                        <option value="">Select a user…</option>
                                        {unlinkedUsers.map(u => (
                                            <option key={u.id} value={u.id}>
                                                {u.full_name ? `${u.full_name} (${u.email})` : u.email}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            )}
                            {editingUser && (
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">User</label>
                                    <p className="mt-1 text-sm text-gray-700 font-medium">{editingUser.full_name || editingUser.email}</p>
                                </div>
                            )}
                            <div>
                                <label className="block text-sm font-medium text-gray-700">Telegram ID</label>
                                <input
                                    type="text"
                                    required
                                    placeholder="e.g. 123456789"
                                    value={form.telegram_id}
                                    onChange={(e) => setForm({ ...form, telegram_id: e.target.value })}
                                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 border p-2"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700">Telegram Username <span className="text-gray-400">(optional)</span></label>
                                <input
                                    type="text"
                                    placeholder="e.g. johndoe (without @)"
                                    value={form.telegram_username}
                                    onChange={(e) => setForm({ ...form, telegram_username: e.target.value })}
                                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 border p-2"
                                />
                            </div>
                            <div className="pt-4 flex justify-end gap-2">
                                <button type="button" onClick={closeModal} className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg">Cancel</button>
                                <button type="submit" disabled={saving} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
                                    {saving ? 'Saving...' : editingUser ? 'Save Changes' : 'Link Account'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
