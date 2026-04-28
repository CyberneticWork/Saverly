import React, { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import api from '../services/api';
import toast from 'react-hot-toast';
import {
  CheckCircleIcon, XCircleIcon, PencilSquareIcon,
  MagnifyingGlassIcon, ChevronLeftIcon, ChevronRightIcon,
  DocumentTextIcon, CheckIcon, XMarkIcon,
} from '@heroicons/react/24/outline';

const STATUS_META = {
  PENDING:    { bg: 'bg-amber-50',   text: 'text-amber-700',  dot: 'bg-amber-400',  label: 'Pending' },
  PROCESSING: { bg: 'bg-blue-50',    text: 'text-blue-700',   dot: 'bg-blue-400',   label: 'Processing' },
  REVIEW:     { bg: 'bg-violet-50',  text: 'text-violet-700', dot: 'bg-violet-400', label: 'Review' },
  VERIFIED:   { bg: 'bg-emerald-50', text: 'text-emerald-700',dot: 'bg-emerald-400',label: 'Verified' },
  REJECTED:   { bg: 'bg-red-50',     text: 'text-red-600',    dot: 'bg-red-400',    label: 'Rejected' },
};

function StatusBadge({ status }) {
  const m = STATUS_META[status] || { bg: 'bg-gray-100', text: 'text-gray-600', dot: 'bg-gray-400', label: status };
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${m.bg} ${m.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${m.dot}`} />
      {m.label}
    </span>
  );
}

export default function Invoices() {
  const qc = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialStatus = ['PENDING', 'REVIEW', 'VERIFIED', 'REJECTED', 'PROCESSING'].includes(searchParams.get('status'))
    ? searchParams.get('status') : '';
  const [status, setStatus] = useState(initialStatus);
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState(null);
  const [rejectModal, setRejectModal] = useState(null);
  const [rejectReason, setRejectReason] = useState('');
  const [editingItem, setEditingItem] = useState(null);

  const { data, isLoading } = useQuery(['invoices', page, status], () =>
    api.get('/invoices/admin/all', { params: { page, limit: 20, status: status || undefined } }).then(r => r.data),
    { keepPreviousData: true }
  );

  const verifyMut = useMutation((id) => api.put(`/invoices/admin/${id}/verify`), {
    onSuccess: () => { qc.invalidateQueries('invoices'); setSelected(null); toast.success('Invoice verified & prices updated'); },
    onError: (e) => toast.error(e?.response?.data?.message || 'Failed to verify'),
  });
  const rejectMut = useMutation(({ id, reason }) => api.put(`/invoices/admin/${id}/reject`, { reason }), {
    onSuccess: () => { qc.invalidateQueries('invoices'); setSelected(null); setRejectModal(null); setRejectReason(''); toast.success('Invoice rejected'); },
    onError: () => toast.error('Failed to reject'),
  });
  const updateItemMut = useMutation(
    ({ invoiceId, itemId, data }) => api.put(`/invoices/admin/${invoiceId}/items/${itemId}`, data),
    {
      onSuccess: (res, vars) => {
        setSelected(prev => prev ? {
          ...prev,
          items: prev.items.map(it => it.id === vars.itemId ? { ...it, ...vars.data } : it),
        } : prev);
        setEditingItem(null);
        toast.success('Item updated');
      },
      onError: () => toast.error('Failed to update item'),
    }
  );

  const invoices = data?.data || [];
  const meta = data?.pagination || {};
  const FILTER_TABS = ['', 'PENDING', 'REVIEW', 'VERIFIED', 'REJECTED'];

  const handleSaveEdit = () => {
    if (!editingItem || !selected) return;
    const item = selected.items[editingItem.index];
    if (!item?.id) return;
    updateItemMut.mutate({ invoiceId: selected.id, itemId: item.id, data: { [editingItem.field]: editingItem.value } });
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Page Header */}
      <div className="mb-8 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <DocumentTextIcon className="w-7 h-7 text-primary" />
            Invoice Management
          </h1>
          <p className="text-gray-500 mt-1 text-sm">Review, correct and verify user-submitted receipts</p>
        </div>
        {meta.total > 0 && (
          <div className="bg-primary/10 text-primary rounded-xl px-4 py-2 text-sm font-semibold">{meta.total} total</div>
        )}
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2 mb-5 flex-wrap">
        {FILTER_TABS.map(s => (
          <button key={s}
            onClick={() => { setStatus(s); setPage(1); s ? setSearchParams({ status: s }) : setSearchParams({}); }}
            className={`px-4 py-2 rounded-xl text-sm font-semibold border-2 transition-all ${
              status === s ? 'bg-primary text-white border-primary shadow-sm' : 'bg-white text-gray-500 border-gray-200 hover:border-primary hover:text-primary'
            }`}
          >
            {s ? (STATUS_META[s]?.label || s) : 'All Invoices'}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center h-40 text-gray-400">
            <svg className="animate-spin w-6 h-6 mr-2 text-primary" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
            </svg>
            Loading invoices...
          </div>
        ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-100">
              <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Store / User</th>
              <th className="text-center px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Items</th>
              <th className="text-right px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Total (LKR)</th>
              <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Date</th>
              <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
              <th className="text-right px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {invoices.map(inv => (
              <tr key={inv.id} className="hover:bg-gray-50/60 transition-colors group">
                <td className="px-5 py-4">
                  <p className="font-semibold text-gray-900 group-hover:text-primary transition-colors">
                    {inv.supermarket?.name || inv.parsedData?.storeName || 'Unknown Store'}
                  </p>
                  <p className="text-gray-400 text-xs mt-0.5">{inv.user?.name} · {inv.user?.email}</p>
                </td>
                <td className="px-5 py-4 text-center">
                  <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-gray-100 text-gray-700 font-semibold text-xs">
                    {inv._count?.items || 0}
                  </span>
                </td>
                <td className="px-5 py-4 text-right font-semibold text-gray-800">
                  {inv.totalAmount ? `LKR ${Number(inv.totalAmount).toLocaleString('en-LK', { minimumFractionDigits: 2 })}` : '–'}
                </td>
                <td className="px-5 py-4 text-gray-500 text-xs">
                  {new Date(inv.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                </td>
                <td className="px-5 py-4"><StatusBadge status={inv.status} /></td>
                <td className="px-5 py-4">
                  <div className="flex items-center justify-end gap-1.5">
                    <button
                      onClick={() => { setSelected(inv); setEditingItem(null); }}
                      className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 bg-gray-100 hover:bg-primary hover:text-white text-gray-700 rounded-lg font-medium transition-all"
                    >
                      <MagnifyingGlassIcon className="w-3.5 h-3.5" /> Review
                    </button>
                    {(inv.status === 'REVIEW' || inv.status === 'PENDING') && (
                      <>
                        <button onClick={() => verifyMut.mutate(inv.id)} disabled={verifyMut.isLoading}
                          className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors disabled:opacity-50" title="Verify">
                          <CheckCircleIcon className="w-5 h-5" />
                        </button>
                        <button onClick={() => { setRejectModal(inv); setRejectReason(''); }}
                          className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors" title="Reject">
                          <XCircleIcon className="w-5 h-5" />
                        </button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {invoices.length === 0 && (
              <tr><td colSpan={6} className="px-6 py-16 text-center">
                <div className="flex flex-col items-center gap-2 text-gray-400">
                  <DocumentTextIcon className="w-10 h-10 opacity-40" />
                  <p className="font-medium">No invoices found</p>
                </div>
              </td></tr>
            )}
          </tbody>
        </table>
        )}
      </div>

      {/* Pagination */}
      {meta.pages > 1 && (
        <div className="flex items-center justify-between mt-4 px-1">
          <p className="text-sm text-gray-500">Page {page} of {meta.pages}</p>
          <div className="flex gap-2">
            <button disabled={page === 1} onClick={() => setPage(p => p - 1)}
              className="inline-flex items-center gap-1 px-3 py-2 border border-gray-200 rounded-xl text-sm font-medium disabled:opacity-40 hover:bg-gray-50">
              <ChevronLeftIcon className="w-4 h-4" /> Prev
            </button>
            <button disabled={page >= meta.pages} onClick={() => setPage(p => p + 1)}
              className="inline-flex items-center gap-1 px-3 py-2 border border-gray-200 rounded-xl text-sm font-medium disabled:opacity-40 hover:bg-gray-50">
              Next <ChevronRightIcon className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Invoice Detail Modal */}
      {selected && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl max-h-[88vh] flex flex-col">
            <div className="flex items-start justify-between p-6 border-b border-gray-100">
              <div>
                <h2 className="text-xl font-bold text-gray-900">
                  {selected.supermarket?.name || selected.parsedData?.storeName || 'Receipt Details'}
                </h2>
                <p className="text-gray-500 text-sm mt-1">{selected.user?.name} · {new Date(selected.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
              </div>
              <div className="flex items-center gap-2">
                <StatusBadge status={selected.status} />
                <button onClick={() => { setSelected(null); setEditingItem(null); }} className="text-gray-400 hover:text-gray-700 p-1 rounded-lg hover:bg-gray-100 ml-2">
                  <XMarkIcon className="w-5 h-5" />
                </button>
              </div>
            </div>
            <div className="overflow-y-auto flex-1 p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-gray-800 text-sm uppercase tracking-wide">Items ({(selected.items || []).length})</h3>
                <p className="text-xs text-gray-400 flex items-center gap-1"><PencilSquareIcon className="w-3.5 h-3.5" /> Click name to edit</p>
              </div>
              <div className="space-y-2">
                {(selected.items || []).map((item, i) => {
                  const isEditing = editingItem?.index === i && editingItem?.field === 'productName';
                  return (
                    <div key={item.id || i} className={`flex items-center gap-3 px-4 py-3 rounded-xl border transition-all ${isEditing ? 'border-primary bg-primary/5' : 'border-gray-100 bg-gray-50/50 hover:border-gray-200'}`}>
                      <span className="text-xs font-bold text-gray-400 w-5 shrink-0">{i + 1}</span>
                      {isEditing ? (
                        <div className="flex-1 flex items-center gap-2">
                          <input autoFocus
                            className="flex-1 text-sm border border-primary rounded-lg px-3 py-1.5 outline-none focus:ring-2 focus:ring-primary/20"
                            value={editingItem.value}
                            onChange={e => setEditingItem(prev => ({ ...prev, value: e.target.value }))}
                            onKeyDown={e => { if (e.key === 'Enter') handleSaveEdit(); if (e.key === 'Escape') setEditingItem(null); }}
                          />
                          <button onClick={handleSaveEdit} disabled={updateItemMut.isLoading} className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg disabled:opacity-50" title="Save">
                            <CheckIcon className="w-4 h-4" />
                          </button>
                          <button onClick={() => setEditingItem(null)} className="p-1.5 text-gray-400 hover:bg-gray-100 rounded-lg" title="Cancel">
                            <XMarkIcon className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <button
                          className="flex-1 text-left text-sm text-gray-800 font-medium hover:text-primary transition-colors group/name flex items-center gap-1"
                          onClick={() => setEditingItem({ index: i, field: 'productName', value: item.productName })}
                        >
                          <span className="truncate">{item.productName || <span className="text-gray-400 italic">Unknown</span>}</span>
                          <PencilSquareIcon className="w-3.5 h-3.5 opacity-0 group-hover/name:opacity-50 shrink-0" />
                        </button>
                      )}
                      <div className="text-right shrink-0 ml-2">
                        <p className="text-sm font-bold text-gray-900">LKR {Number(item.totalPrice || item.unitPrice || 0).toLocaleString('en-LK', { minimumFractionDigits: 2 })}</p>
                        {item.quantity && item.quantity !== 1 && (
                          <p className="text-xs text-gray-400">{item.quantity} × LKR {Number(item.unitPrice || 0).toLocaleString('en-LK', { minimumFractionDigits: 2 })}</p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="p-6 border-t border-gray-100">
              {(selected.totalAmount || selected.parsedData?.total) && (
                <div className="flex items-center justify-between mb-4">
                  <span className="text-sm text-gray-600">Total</span>
                  <span className="text-lg font-bold text-gray-900">
                    LKR {Number(selected.totalAmount || selected.parsedData?.total || 0).toLocaleString('en-LK', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              )}
              {(selected.status === 'REVIEW' || selected.status === 'PENDING') && (
                <div className="flex gap-3">
                  <button onClick={() => verifyMut.mutate(selected.id)} disabled={verifyMut.isLoading}
                    className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-semibold text-sm transition-colors disabled:opacity-50">
                    <CheckCircleIcon className="w-5 h-5" />
                    {verifyMut.isLoading ? 'Verifying…' : 'Verify & Update Prices'}
                  </button>
                  <button onClick={() => { setRejectModal(selected); setRejectReason(''); }}
                    className="px-4 py-2.5 border-2 border-red-200 text-red-600 hover:bg-red-50 rounded-xl font-semibold text-sm transition-colors">
                    Reject
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Reject Modal */}
      {rejectModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-1">Reject Invoice</h3>
            <p className="text-sm text-gray-500 mb-4">Provide a reason so the user knows what went wrong.</p>
            <textarea autoFocus
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 resize-none"
              rows={3} placeholder="e.g. Image is blurry, cannot read prices"
              value={rejectReason} onChange={e => setRejectReason(e.target.value)}
            />
            <div className="flex gap-3 mt-4">
              <button onClick={() => { setRejectModal(null); setRejectReason(''); }}
                className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl text-sm font-medium hover:bg-gray-50">Cancel</button>
              <button onClick={() => rejectMut.mutate({ id: rejectModal.id, reason: rejectReason || 'Invoice could not be verified.' })}
                disabled={rejectMut.isLoading}
                className="flex-1 px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-sm font-semibold transition-colors disabled:opacity-50">
                {rejectMut.isLoading ? 'Rejecting…' : 'Confirm Reject'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
