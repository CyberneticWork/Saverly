import React from 'react';
import { useQuery } from 'react-query';
import { useNavigate } from 'react-router-dom';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';
import api from '../services/api';
import toast from 'react-hot-toast';

function StatCard({ title, value, subtitle, icon, color, onClick, accent = false }) {
  const isClickable = typeof onClick === 'function';
  return (
    <button
      type="button"
      onClick={onClick}
      className={`bg-white rounded-2xl p-6 shadow-sm border text-left w-full transition-all ${
        accent
          ? 'border-amber-200 hover:border-amber-300 hover:shadow-md hover:-translate-y-0.5'
          : 'border-gray-100 hover:border-gray-200 hover:shadow-md'
      } ${isClickable ? 'cursor-pointer' : 'cursor-default'}`}
      disabled={!isClickable}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-gray-500 font-medium">{title}</p>
          <p className={`text-3xl font-bold mt-1 ${color}`}>{value}</p>
          {subtitle && <p className="text-xs text-gray-400 mt-1">{subtitle}</p>}
          {isClickable && <p className="text-xs mt-2 text-amber-700 font-semibold">Open review queue</p>}
        </div>
        <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl ${color.replace('text-', 'bg-').replace('700', '100').replace('600', '100')}`}>
          {icon}
        </div>
      </div>
    </button>
  );
}

export default function Dashboard() {
  const navigate = useNavigate();
  const { data, isLoading } = useQuery('dashboard', () =>
    api.get('/admin/dashboard').then(r => r.data.data),
    { onError: () => toast.error('Failed to load dashboard') }
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading dashboard...</div>
      </div>
    );
  }

  const stats = data?.stats || {};
  const recentInvoices = data?.recentInvoices || [];
  const recentUsers = data?.recentUsers || [];

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-500">Overview of platform activity</p>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard title="Total Users" value={stats.totalUsers || 0} icon="👤" color="text-blue-700" />
        <StatCard title="Products" value={stats.totalProducts || 0} icon="📦" color="text-green-700" />
        <StatCard title="Supermarkets" value={stats.totalSupermarkets || 0} icon="🏪" color="text-orange-700" />
        <StatCard title="Price Records" value={stats.totalPrices || 0} icon="🏷️" color="text-purple-700" />
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard title="Invoices" value={stats.totalInvoices || 0} icon="🧾" color="text-red-700" />
        <StatCard
          title="Pending Review"
          value={stats.pendingInvoices || 0}
          subtitle="Need verification"
          icon="⏳"
          color="text-yellow-700"
          accent
          onClick={() => navigate('/invoices?status=REVIEW')}
        />
        <StatCard title="Shopping Lists" value={stats.totalShoppingLists || 0} icon="📋" color="text-cyan-700" />
        <StatCard title="Price Alerts" value={stats.totalAlerts || 0} icon="🔔" color="text-pink-700" />
      </div>

      {/* Recent activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent invoices */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <h2 className="text-lg font-bold text-gray-900 mb-4">Recent Invoice Scans</h2>
          <div className="space-y-3">
            {recentInvoices.length === 0 && <p className="text-gray-400 text-sm">No invoices yet</p>}
            {recentInvoices.map(inv => (
              <div key={inv.id} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                <div>
                  <p className="text-sm font-medium text-gray-800">{inv.storeName || 'Unknown Store'}</p>
                  <p className="text-xs text-gray-400">{inv.user?.name} · {new Date(inv.createdAt).toLocaleDateString()}</p>
                </div>
                <StatusBadge status={inv.status} />
              </div>
            ))}
          </div>
        </div>

        {/* Recent users */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <h2 className="text-lg font-bold text-gray-900 mb-4">Recent Users</h2>
          <div className="space-y-3">
            {recentUsers.length === 0 && <p className="text-gray-400 text-sm">No users yet</p>}
            {recentUsers.map(user => (
              <div key={user.id} className="flex items-center gap-3 py-2 border-b border-gray-50 last:border-0">
                <div className="w-8 h-8 rounded-full bg-green-100 text-green-700 font-bold text-sm flex items-center justify-center">
                  {user.name?.[0]?.toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800 truncate">{user.name}</p>
                  <p className="text-xs text-gray-400 truncate">{user.email}</p>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${user.role === 'ADMIN' ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-600'}`}>
                  {user.role}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ status }) {
  const classes = {
    PENDING: 'bg-yellow-100 text-yellow-700',
    PROCESSING: 'bg-blue-100 text-blue-700',
    REVIEW: 'bg-purple-100 text-purple-700',
    VERIFIED: 'bg-green-100 text-green-700',
    REJECTED: 'bg-red-100 text-red-700',
  };
  const labels = {
    PENDING: 'Pending', PROCESSING: 'Processing',
    REVIEW: 'Review', VERIFIED: 'Verified', REJECTED: 'Rejected',
  };
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${classes[status] || 'bg-gray-100 text-gray-600'}`}>
      {labels[status] || status}
    </span>
  );
}
