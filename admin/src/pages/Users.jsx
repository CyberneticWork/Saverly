import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import api from '../services/api';
import toast from 'react-hot-toast';
import { PencilSquareIcon, TrashIcon, ShieldCheckIcon } from '@heroicons/react/24/outline';

export default function Users() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const { data } = useQuery(['admin-users', page, search], () =>
    api.get('/admin/users', { params: { page, limit: 20, search: search || undefined } }).then(r => r.data),
    { keepPreviousData: true }
  );

  const toggleMut = useMutation((id) => api.patch(`/admin/users/${id}/toggle-active`), {
    onSuccess: () => { qc.invalidateQueries('admin-users'); toast.success('User status updated'); },
    onError: () => toast.error('Failed to update user'),
  });

  const deleteMut = useMutation((id) => api.delete(`/admin/users/${id}`), {
    onSuccess: () => { qc.invalidateQueries('admin-users'); toast.success('User deleted'); },
    onError: (e) => toast.error(e?.response?.data?.message || 'Failed to delete'),
  });

  const users = data?.data || [];
  const meta = data?.meta || {};

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Users</h1>
        <p className="text-gray-500">{meta.total || 0} registered users</p>
      </div>

      <div className="relative mb-4">
        <input
          value={search}
          onChange={e => { setSearch(e.target.value); setPage(1); }}
          placeholder="Search by name or email..."
          className="w-full pl-4 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary"
        />
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50 text-gray-500 text-xs uppercase">
              <th className="text-left px-6 py-3">User</th>
              <th className="text-left px-6 py-3">Role</th>
              <th className="text-left px-6 py-3">Lists</th>
              <th className="text-left px-6 py-3">Invoices</th>
              <th className="text-left px-6 py-3">Joined</th>
              <th className="text-left px-6 py-3">Status</th>
              <th className="text-right px-6 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map(user => (
              <tr key={user.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-green-100 text-green-700 font-bold text-sm flex items-center justify-center">
                      {user.name?.[0]?.toUpperCase()}
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">{user.name}</p>
                      <p className="text-gray-400 text-xs">{user.email}</p>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${user.role === 'ADMIN' ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-600'}`}>
                    {user.role}
                  </span>
                </td>
                <td className="px-6 py-4 text-gray-600">{user._count?.shoppingLists || 0}</td>
                <td className="px-6 py-4 text-gray-600">{user._count?.invoices || 0}</td>
                <td className="px-6 py-4 text-gray-500">{new Date(user.createdAt).toLocaleDateString()}</td>
                <td className="px-6 py-4">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${user.isActive !== false ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
                    {user.isActive !== false ? 'Active' : 'Disabled'}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <div className="flex items-center justify-end gap-1">
                    <button
                      onClick={() => toggleMut.mutate(user.id)}
                      className="text-xs px-3 py-1.5 border border-gray-200 rounded-lg hover:bg-gray-50"
                    >
                      {user.isActive !== false ? 'Disable' : 'Enable'}
                    </button>
                    {user.role !== 'ADMIN' && (
                      <button
                        onClick={() => { if (confirm(`Delete ${user.name}?`)) deleteMut.mutate(user.id); }}
                        className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg"
                      >
                        <TrashIcon className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {users.length === 0 && (
              <tr><td colSpan={7} className="px-6 py-12 text-center text-gray-400">No users found</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {meta.totalPages > 1 && (
        <div className="flex justify-center gap-2 mt-4">
          <button disabled={page === 1} onClick={() => setPage(p => p - 1)} className="px-4 py-2 border rounded-xl disabled:opacity-40 hover:bg-gray-50">Prev</button>
          <span className="px-4 py-2 text-gray-600">Page {page} of {meta.totalPages}</span>
          <button disabled={page >= meta.totalPages} onClick={() => setPage(p => p + 1)} className="px-4 py-2 border rounded-xl disabled:opacity-40 hover:bg-gray-50">Next</button>
        </div>
      )}
    </div>
  );
}
