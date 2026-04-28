import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  const extractAuthPayload = (responseData) => {
    const payload = responseData?.data ?? responseData ?? {};
    const accessToken = payload.accessToken ?? payload.token;
    const userData = payload.user ?? payload.data?.user;
    return { accessToken, userData };
  };

  useEffect(() => {
    const token = localStorage.getItem('adminToken');
    if (token) {
      api.defaults.headers.Authorization = `Bearer ${token}`;
      api.get('/auth/me')
        .then(res => setUser(res.data.data))
        .catch(() => { localStorage.removeItem('adminToken'); })
        .finally(() => setIsLoading(false));
    } else {
      setIsLoading(false);
    }
  }, []);

  const login = async (email, password) => {
    const res = await api.post('/auth/login', { email, password });
    const { accessToken, userData } = extractAuthPayload(res.data);
    if (!accessToken || !userData) {
      throw new Error('Unexpected login response from server.');
    }
    if (userData.role !== 'ADMIN') throw new Error('Not authorised. Admin access required.');
    localStorage.setItem('adminToken', accessToken);
    api.defaults.headers.Authorization = `Bearer ${accessToken}`;
    setUser(userData);
  };

  const logout = () => {
    localStorage.removeItem('adminToken');
    delete api.defaults.headers.Authorization;
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, isAuthenticated: !!user, isLoading, login, logout }}>
      {!isLoading && children}
    </AuthContext.Provider>
  );
}

export function useAuth() { return useContext(AuthContext); }
