import React, { useState } from 'react';
import { useQuery } from 'react-query';
import api from '../services/api';

const formatLkr = (value) => `LKR ${Number(value || 0).toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function PriceRecords() {
  const [page, setPage] = useState(1);
  const [supermarketId, setSupermarketId] = useState('');

  const { data } = useQuery(['prices', page, supermarketId], () =>
    api.get('/admin/prices', { params: { page, limit: 25, supermarketId: supermarketId || undefined } }).then(r => r.data),
    { keepPreviousData: true }
  );
  const { data: supermarkets } = useQuery('supermarkets-list', () => api.get('/supermarkets').then(r => r.data.data));

  const prices = data?.data || [];
  const meta = data?.meta || {};

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Price Records</h1>
        <p className="text-gray-500">{meta.total || 0} total price records</p>
      </div>

      <div className="mb-4">
        <select
          value={supermarketId}
          onChange={e => { setSupermarketId(e.target.value); setPage(1); }}
          className="border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
        >
          <option value="">All Supermarkets</option>
          {(supermarkets || []).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50 text-gray-500 text-xs uppercase">
              <th className="text-left px-6 py-3">Product</th>
              <th className="text-left px-6 py-3">Supermarket</th>
              <th className="text-left px-6 py-3">Price</th>
              <th className="text-left px-6 py-3">Sale Price</th>
              <th className="text-left px-6 py-3">Stock</th>
              <th className="text-left px-6 py-3">Recorded</th>
            </tr>
          </thead>
          <tbody>
            {prices.map(p => (
              <tr key={p.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                <td className="px-6 py-4">
                  <p className="font-medium text-gray-900">{p.product?.name}</p>
                  {p.product?.brand && <p className="text-gray-400 text-xs">{p.product.brand}</p>}
                </td>
                <td className="px-6 py-4 text-gray-600">{p.supermarket?.name}</td>
                <td className="px-6 py-4 font-medium text-gray-900">{formatLkr(p.price)}</td>
                <td className="px-6 py-4">
                  {p.salePrice ? (
                    <span className="text-pink-600 font-medium">{formatLkr(p.salePrice)}</span>
                  ) : '–'}
                </td>
                <td className="px-6 py-4">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
                    p.stockStatus === 'IN_STOCK' ? 'bg-green-100 text-green-700' :
                    p.stockStatus === 'LOW_STOCK' ? 'bg-yellow-100 text-yellow-700' :
                    'bg-red-100 text-red-700'
                  }`}>
                    {p.stockStatus?.replace(/_/g, ' ') || 'In Stock'}
                  </span>
                </td>
                <td className="px-6 py-4 text-gray-500">{new Date(p.recordedAt).toLocaleDateString()}</td>
              </tr>
            ))}
            {prices.length === 0 && (
              <tr><td colSpan={6} className="px-6 py-12 text-center text-gray-400">No price records found</td></tr>
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
