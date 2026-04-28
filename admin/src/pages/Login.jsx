import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      await login(email, password);
      navigate('/dashboard', { replace: true });
    } catch (err) {
      toast.error(err?.response?.data?.message || err?.message || 'Login failed');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="brand-auth-shell min-h-screen flex items-center justify-center p-4">
      <div className="brand-orb brand-orb-left" />
      <div className="brand-orb brand-orb-right" />
      <div className="relative w-full max-w-md rounded-[32px] border border-white/60 bg-white/95 shadow-[0_30px_80px_rgba(8,49,37,0.22)] backdrop-blur p-8">
        {/* Logo */}
        <div className="text-center mb-8">
          <img src="/brand/saverly-logo.svg" alt="Saverly" className="mx-auto w-[220px] max-w-full" />
          <div className="mt-5 inline-flex items-center rounded-full bg-[rgba(28,154,118,0.1)] px-4 py-1 text-xs font-semibold tracking-[0.18em] text-[#14765A] uppercase">
            Admin Console
          </div>
          <p className="text-[#5F6772] mt-3">Monitor products, stores, prices, and invoice reviews from one clean dashboard.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-[#2D3B39] mb-1">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="admin@saverly.com"
              className="w-full border border-[#CFE5DE] rounded-2xl px-4 py-3.5 text-sm text-[#2F3136] bg-white focus:outline-none focus:ring-2 focus:ring-[#CBEFE3] focus:border-[#1C9A76]"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-[#2D3B39] mb-1">Password</label>
            <input
              type="password"
              required
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full border border-[#CFE5DE] rounded-2xl px-4 py-3.5 text-sm text-[#2F3136] bg-white focus:outline-none focus:ring-2 focus:ring-[#CBEFE3] focus:border-[#1C9A76]"
            />
          </div>
          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-gradient-to-r from-[#14765A] via-[#1C9A76] to-[#39B58F] text-white rounded-2xl py-3.5 font-semibold shadow-[0_14px_30px_rgba(20,118,90,0.28)] hover:-translate-y-0.5 hover:shadow-[0_18px_34px_rgba(20,118,90,0.34)] transition-all disabled:opacity-60 mt-2"
          >
            {isLoading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <p className="text-center text-xs text-[#97A1AC] mt-6">
          Default: admin@pricewise.com / Admin@123
        </p>
      </div>
    </div>
  );
}
