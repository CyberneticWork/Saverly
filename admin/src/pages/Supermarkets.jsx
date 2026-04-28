import React, { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import api from '../services/api';
import toast from 'react-hot-toast';
import {
  PlusIcon,
  PencilSquareIcon,
  TrashIcon,
  GlobeAltIcon,
  BuildingStorefrontIcon,
  SwatchIcon,
} from '@heroicons/react/24/outline';

const defaultForm = {
  name: '',
  slug: '',
  website: '',
  logoUrl: '',
  primaryColor: '#1B5E20',
};

const slugify = (value = '') => value
  .toString()
  .toLowerCase()
  .trim()
  .replace(/[^a-z0-9\s-]/g, '')
  .replace(/\s+/g, '-')
  .replace(/-+/g, '-');

export default function Supermarkets() {
  const qc = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(defaultForm);

  const { data, isLoading } = useQuery('supermarkets', () =>
    api.get('/supermarkets').then((r) => r.data.data)
  );

  const saveMut = useMutation(
    (payload) => (editing ? api.put(`/supermarkets/${editing.id}`, payload) : api.post('/supermarkets', payload)),
    {
      onSuccess: () => {
        qc.invalidateQueries('supermarkets');
        setShowModal(false);
        setEditing(null);
        setForm(defaultForm);
        toast.success(editing ? 'Supermarket updated' : 'Supermarket created');
      },
      onError: (e) => toast.error(e?.response?.data?.message || 'Failed to save supermarket'),
    }
  );

  const deleteMut = useMutation((id) => api.delete(`/supermarkets/${id}`), {
    onSuccess: () => {
      qc.invalidateQueries('supermarkets');
      toast.success('Supermarket deleted');
    },
    onError: (e) => toast.error(e?.response?.data?.message || 'Failed to delete supermarket'),
  });

  const supermarkets = data || [];

  const palette = useMemo(() => supermarkets.slice(0, 5), [supermarkets]);

  const openEdit = (item) => {
    setEditing(item);
    setForm({
      name: item.name || '',
      slug: item.slug || '',
      website: item.website || '',
      logoUrl: item.logoUrl || '',
      primaryColor: item.primaryColor || '#1B5E20',
    });
    setShowModal(true);
  };

  const openCreate = () => {
    setEditing(null);
    setForm(defaultForm);
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditing(null);
    setForm(defaultForm);
  };

  const handleNameChange = (value) => {
    setForm((prev) => ({
      ...prev,
      name: value,
      slug: editing ? prev.slug : slugify(value),
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const payload = {
      name: form.name.trim(),
      slug: (form.slug || slugify(form.name)).trim(),
      website: form.website.trim() || null,
      logoUrl: form.logoUrl.trim() || null,
      primaryColor: form.primaryColor,
    };

    saveMut.mutate(payload);
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="rounded-3xl border border-emerald-100 bg-gradient-to-r from-emerald-50 via-white to-cyan-50 p-6 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <p className="text-xs font-semibold tracking-wide uppercase text-emerald-700">Store Management</p>
            <h1 className="text-3xl font-black text-gray-900 mt-1">Supermarkets</h1>
            <p className="text-gray-600 mt-1">Manage store branding, identity, and storefront links.</p>
          </div>
          <button
            onClick={openCreate}
            className="inline-flex items-center gap-2 bg-primary text-white px-5 py-3 rounded-2xl font-semibold hover:bg-primary-dark transition-all shadow-sm hover:shadow"
          >
            <PlusIcon className="w-5 h-5" /> Add Supermarket
          </button>
        </div>

        <div className="mt-5 grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="rounded-2xl bg-white/80 border border-emerald-100 p-4">
            <p className="text-xs text-gray-500">Total Chains</p>
            <p className="text-2xl font-bold text-gray-900">{supermarkets.length}</p>
          </div>
          <div className="rounded-2xl bg-white/80 border border-emerald-100 p-4">
            <p className="text-xs text-gray-500">With Websites</p>
            <p className="text-2xl font-bold text-gray-900">{supermarkets.filter((s) => !!s.website).length}</p>
          </div>
          <div className="rounded-2xl bg-white/80 border border-emerald-100 p-4">
            <p className="text-xs text-gray-500">Active Locations</p>
            <p className="text-2xl font-bold text-gray-900">{supermarkets.reduce((acc, s) => acc + (s.locations?.length || 0), 0)}</p>
          </div>
          <div className="rounded-2xl bg-white/80 border border-emerald-100 p-4">
            <p className="text-xs text-gray-500">Price Records</p>
            <p className="text-2xl font-bold text-gray-900">{supermarkets.reduce((acc, s) => acc + (s._count?.prices || 0), 0)}</p>
          </div>
        </div>

        {palette.length > 0 && (
          <div className="mt-5 flex items-center gap-2 flex-wrap">
            <span className="text-xs text-gray-500">Brand palette:</span>
            {palette.map((s) => (
              <span
                key={s.id}
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-gray-200 bg-white text-xs font-medium text-gray-700"
              >
                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: s.primaryColor || '#1B5E20' }} />
                {s.name}
              </span>
            ))}
          </div>
        )}
      </div>

      {isLoading ? (
        <div className="rounded-2xl border border-gray-100 bg-white p-8 text-gray-500">Loading supermarkets...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {supermarkets.map((s) => (
            <div key={s.id} className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm hover:shadow-md transition-all">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className="w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold text-lg shrink-0"
                    style={{ backgroundColor: s.primaryColor || '#1B5E20' }}
                  >
                    {s.logoUrl ? (
                      <img src={s.logoUrl} alt={s.name} className="w-12 h-12 rounded-xl object-cover" />
                    ) : (
                      s.name?.[0]?.toUpperCase()
                    )}
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-bold text-gray-900 truncate">{s.name}</h3>
                    <p className="text-xs text-gray-500 truncate">/{s.slug}</p>
                  </div>
                </div>
                <div className="flex gap-1.5">
                  <button
                    onClick={() => openEdit(s)}
                    className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg"
                    title="Edit supermarket"
                  >
                    <PencilSquareIcon className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => {
                      if (confirm(`Delete ${s.name}?`)) deleteMut.mutate(s.id);
                    }}
                    className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg"
                    title="Delete supermarket"
                  >
                    <TrashIcon className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="mt-4 space-y-2 text-sm text-gray-600">
                <p className="flex items-center gap-2">
                  <BuildingStorefrontIcon className="w-4 h-4 text-gray-400" />
                  {(s.locations?.length || 0)} active locations
                </p>
                <p className="flex items-center gap-2">
                  <SwatchIcon className="w-4 h-4 text-gray-400" />
                  {s.primaryColor || 'No brand color'}
                </p>
                <p className="flex items-center gap-2 truncate">
                  <GlobeAltIcon className="w-4 h-4 text-gray-400 shrink-0" />
                  {s.website ? (
                    <a href={s.website} target="_blank" rel="noreferrer" className="text-primary hover:underline truncate">
                      {s.website}
                    </a>
                  ) : (
                    <span className="text-gray-400">No website</span>
                  )}
                </p>
              </div>

              <div className="mt-4 pt-4 border-t border-gray-100 flex items-center justify-between text-xs">
                <span className="text-gray-500">{s._count?.prices || 0} prices tracked</span>
                <button
                  onClick={() => openEdit(s)}
                  className="font-semibold text-primary hover:text-primary-dark"
                >
                  Edit details
                </button>
              </div>
            </div>
          ))}

          {supermarkets.length === 0 && (
            <div className="col-span-full rounded-2xl border border-dashed border-gray-300 bg-white p-10 text-center">
              <p className="text-lg font-semibold text-gray-800">No supermarkets yet</p>
              <p className="text-gray-500 mt-1">Create your first supermarket to start managing prices.</p>
              <button onClick={openCreate} className="mt-4 inline-flex items-center gap-2 bg-primary text-white px-4 py-2.5 rounded-xl font-medium">
                <PlusIcon className="w-4 h-4" /> Add Supermarket
              </button>
            </div>
          )}
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-[1px] flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-gray-100 overflow-hidden">
            <div className="px-6 py-5 border-b border-gray-100 bg-gradient-to-r from-emerald-50 to-cyan-50">
              <h2 className="text-xl font-black text-gray-900">{editing ? 'Edit Supermarket' : 'New Supermarket'}</h2>
              <p className="text-sm text-gray-600 mt-1">Maintain clean store metadata for better search and reports.</p>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
                <input
                  value={form.name}
                  onChange={(e) => handleNameChange(e.target.value)}
                  required
                  className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="Cargills Food City"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Slug *</label>
                <input
                  value={form.slug}
                  onChange={(e) => setForm((f) => ({ ...f, slug: slugify(e.target.value) }))}
                  required
                  className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="cargills-food-city"
                />
                <p className="text-xs text-gray-500 mt-1">Used in URLs and integrations. Lowercase letters, numbers, and dashes only.</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Website</label>
                  <input
                    value={form.website}
                    onChange={(e) => setForm((f) => ({ ...f, website: e.target.value }))}
                    className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder="https://example.com"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Logo URL</label>
                  <input
                    value={form.logoUrl}
                    onChange={(e) => setForm((f) => ({ ...f, logoUrl: e.target.value }))}
                    className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder="https://cdn.site/logo.png"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Brand Color</label>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={form.primaryColor}
                    onChange={(e) => setForm((f) => ({ ...f, primaryColor: e.target.value }))}
                    className="w-12 h-10 rounded border border-gray-300 cursor-pointer"
                  />
                  <span className="text-sm text-gray-600 font-medium">{form.primaryColor}</span>
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={closeModal}
                  className="flex-1 border border-gray-300 rounded-xl py-2.5 text-sm font-medium hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saveMut.isLoading}
                  className="flex-1 bg-primary text-white rounded-xl py-2.5 text-sm font-semibold hover:bg-primary-dark disabled:opacity-60"
                >
                  {saveMut.isLoading ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
