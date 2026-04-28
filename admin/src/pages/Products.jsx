import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import api from '../services/api';
import toast from 'react-hot-toast';
import { MagnifyingGlassIcon, PlusIcon, PencilSquareIcon, TrashIcon } from '@heroicons/react/24/outline';

export default function Products() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ name: '', brand: '', description: '', defaultUnit: 'unit', categoryId: '' });

  const { data } = useQuery(['products', page, search], () =>
    api.get('/products', { params: { page, limit: 20, search: search || undefined } }).then(r => r.data),
    { keepPreviousData: true }
  );
  const { data: categories } = useQuery('categories', () => api.get('/categories').then(r => r.data.data));

  const deleteMut = useMutation((id) => api.delete(`/products/${id}`), {
    onSuccess: () => { qc.invalidateQueries('products'); toast.success('Product deleted'); },
    onError: () => toast.error('Failed to delete'),
  });

  const saveMut = useMutation(
    (payload) => editing ? api.put(`/products/${editing.id}`, payload) : api.post('/products', payload),
    {
      onSuccess: () => { qc.invalidateQueries('products'); setShowModal(false); setEditing(null); toast.success('Saved'); },
      onError: (e) => toast.error(e?.response?.data?.message || 'Failed to save'),
    }
  );

  const openEdit = (product) => {
    setEditing(product);
    setForm({ name: product.name, brand: product.brand || '', description: product.description || '', defaultUnit: product.defaultUnit, categoryId: product.categoryId || '' });
    setShowModal(true);
  };

  const openCreate = () => {
    setEditing(null);
    setForm({ name: '', brand: '', description: '', defaultUnit: 'unit', categoryId: '' });
    setShowModal(true);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    saveMut.mutate(form);
  };

  const products = data?.data || [];
  const meta = data?.meta || {};

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Products</h1>
          <p className="text-gray-500">{meta.total || 0} total products</p>
        </div>
        <button onClick={openCreate} className="flex items-center gap-2 bg-primary text-white px-4 py-2 rounded-xl font-medium hover:bg-primary-dark transition-colors">
          <PlusIcon className="w-5 h-5" /> Add Product
        </button>
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
        <input
          value={search}
          onChange={e => { setSearch(e.target.value); setPage(1); }}
          placeholder="Search products..."
          className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary"
        />
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50 text-gray-500 text-xs uppercase">
              <th className="text-left px-6 py-3">Product</th>
              <th className="text-left px-6 py-3">Category</th>
              <th className="text-left px-6 py-3">Unit</th>
              <th className="text-left px-6 py-3">Prices</th>
              <th className="text-right px-6 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {products.map(product => (
              <tr key={product.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                <td className="px-6 py-4">
                  <p className="font-medium text-gray-900">{product.name}</p>
                  {product.brand && <p className="text-gray-400 text-xs">{product.brand}</p>}
                </td>
                <td className="px-6 py-4 text-gray-600">{product.category?.name || '–'}</td>
                <td className="px-6 py-4 text-gray-600">{product.defaultUnit}</td>
                <td className="px-6 py-4 text-gray-600">{product._count?.prices || 0}</td>
                <td className="px-6 py-4">
                  <div className="flex items-center justify-end gap-2">
                    <button onClick={() => openEdit(product)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg">
                      <PencilSquareIcon className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => { if (confirm('Delete this product?')) deleteMut.mutate(product.id); }}
                      className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg"
                    >
                      <TrashIcon className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {products.length === 0 && (
              <tr><td colSpan={5} className="px-6 py-12 text-center text-gray-400">No products found</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {meta.totalPages > 1 && (
        <div className="flex justify-center gap-2 mt-4">
          <button disabled={page === 1} onClick={() => setPage(p => p - 1)} className="px-4 py-2 border rounded-xl disabled:opacity-40 hover:bg-gray-50">Prev</button>
          <span className="px-4 py-2 text-gray-600">Page {page} of {meta.totalPages}</span>
          <button disabled={page >= meta.totalPages} onClick={() => setPage(p => p + 1)} className="px-4 py-2 border rounded-xl disabled:opacity-40 hover:bg-gray-50">Next</button>
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <h2 className="text-xl font-bold text-gray-900 mb-4">{editing ? 'Edit Product' : 'New Product'}</h2>
            <form onSubmit={handleSubmit} className="space-y-3">
              <FormField label="Product Name *" value={form.name} onChange={v => setForm(f => ({ ...f, name: v }))} required />
              <FormField label="Brand" value={form.brand} onChange={v => setForm(f => ({ ...f, brand: v }))} />
              <FormField label="Description" value={form.description} onChange={v => setForm(f => ({ ...f, description: v }))} />
              <FormField label="Default Unit" value={form.defaultUnit} onChange={v => setForm(f => ({ ...f, defaultUnit: v }))} placeholder="kg, L, unit..." />
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                <select
                  value={form.categoryId}
                  onChange={e => setForm(f => ({ ...f, categoryId: e.target.value }))}
                  className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="">Select category</option>
                  {(categories || []).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)} className="flex-1 border border-gray-300 rounded-xl py-2.5 text-sm font-medium hover:bg-gray-50">Cancel</button>
                <button type="submit" disabled={saveMut.isLoading} className="flex-1 bg-primary text-white rounded-xl py-2.5 text-sm font-medium hover:bg-primary-dark disabled:opacity-60">
                  {saveMut.isLoading ? 'Saving...' : 'Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function FormField({ label, value, onChange, required, placeholder }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <input
        value={value}
        onChange={e => onChange(e.target.value)}
        required={required}
        placeholder={placeholder}
        className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
      />
    </div>
  );
}
