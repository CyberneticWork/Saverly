import React, { useState } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  HomeIcon, CubeIcon, BuildingStorefrontIcon,
  DocumentTextIcon, UsersIcon, TagIcon, Bars3Icon,
  ArrowRightOnRectangleIcon,
} from '@heroicons/react/24/outline';

const navItems = [
  { to: '/dashboard', icon: HomeIcon, label: 'Dashboard' },
  { to: '/products', icon: CubeIcon, label: 'Products' },
  { to: '/supermarkets', icon: BuildingStorefrontIcon, label: 'Supermarkets' },
  { to: '/prices', icon: TagIcon, label: 'Price Records' },
  { to: '/invoices', icon: DocumentTextIcon, label: 'Invoices' },
  { to: '/users', icon: UsersIcon, label: 'Users' },
];

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      {/* Logo - Saverly Brand */}
      <div className="px-5 py-5 border-b border-white/10 bg-gradient-to-br from-[#14765A] via-[#1C9A76] to-[#2CA482]">
        <div className="rounded-3xl bg-white/96 px-4 py-4 shadow-[0_18px_32px_rgba(8,49,37,0.18)]">
          <img src="/brand/saverly-logo.svg" alt="Saverly" className="w-full max-w-[168px]" />
        </div>
        <p className="mt-3 text-[11px] uppercase tracking-[0.2em] text-white/72">Admin workspace</p>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {navItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            onClick={() => setSidebarOpen(false)}
            className={({ isActive }) =>
              `flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
                isActive
                  ? 'bg-gradient-to-r from-[#14765A] to-[#1C9A76] text-white shadow-[0_10px_18px_rgba(20,118,90,0.24)]'
                  : 'text-[#5F6772] hover:bg-[#E6F6F0] hover:text-[#14765A]'
              }`
            }
          >
            <Icon className="w-5 h-5 flex-shrink-0" />
            {label}
          </NavLink>
        ))}
      </nav>

      {/* User */}
      <div className="border-t border-[#D4E8E5] px-4 py-4">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#FFA11A] to-[#FFC15C] flex items-center justify-center font-bold text-white shadow-sm">
            {user?.name?.[0]?.toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[#2F3136] text-sm font-medium truncate">{user?.name}</p>
            <p className="text-[#97A1AC] text-xs truncate">{user?.email}</p>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="flex items-center gap-2 text-[#5F6772] hover:text-[#14765A] text-sm w-full font-medium"
        >
          <ArrowRightOnRectangleIcon className="w-4 h-4" />
          Sign Out
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen bg-[#F8FBFA]">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex flex-col w-64 bg-white border-r border-[#E5F0EC] shrink-0">
        <SidebarContent />
      </aside>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setSidebarOpen(false)} />
          <div className="absolute left-0 top-0 bottom-0 w-64 bg-white flex flex-col shadow-2xl">
            <SidebarContent />
          </div>
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Topbar (mobile) */}
        <header className="md:hidden flex items-center justify-between px-4 py-3 bg-white border-b border-[#D4E8E5] shadow-sm">
          <button onClick={() => setSidebarOpen(true)} className="p-1">
            <Bars3Icon className="w-6 h-6 text-[#14765A]" />
          </button>
          <img src="/brand/saverly-logo.svg" alt="Saverly" className="h-9 w-auto" />
          <div className="w-8" />
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
