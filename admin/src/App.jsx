import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './context/AuthContext';
import Layout from './components/Layout';
import LoginPage from './pages/Login';
import Dashboard from './pages/Dashboard';
import Products from './pages/Products';
import Supermarkets from './pages/Supermarkets';
import Invoices from './pages/Invoices';
import Users from './pages/Users';
import PriceRecords from './pages/PriceRecords';

function ProtectedRoute({ children }) {
  const { isAuthenticated } = useAuth();
  return isAuthenticated ? children : <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Toaster position="top-right" toastOptions={{ duration: 3000 }} />
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="products" element={<Products />} />
            <Route path="supermarkets" element={<Supermarkets />} />
            <Route path="invoices" element={<Invoices />} />
            <Route path="users" element={<Users />} />
            <Route path="prices" element={<PriceRecords />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
