import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  const parseBearerToken = (value) => {
    if (typeof value !== 'string') return null;
    const trimmed = value.trim();
    if (!trimmed) return null;
    if (/^bearer\s+/i.test(trimmed)) {
      return trimmed.replace(/^bearer\s+/i, '').trim() || null;
    }
    return trimmed;
  };

  const findValueByKeys = (obj, keys, maxDepth = 4, seen = new Set(), depth = 0) => {
    if (!obj || typeof obj !== 'object' || depth > maxDepth || seen.has(obj)) return null;
    seen.add(obj);

    for (const key of keys) {
      if (obj[key] != null) return obj[key];
    }

    for (const value of Object.values(obj)) {
      if (value && typeof value === 'object') {
        const found = findValueByKeys(value, keys, maxDepth, seen, depth + 1);
        if (found != null) return found;
      }
    }
    return null;
  };

  const extractAuthPayload = (responseData, responseHeaders = {}) => {
    const root = responseData ?? {};
    const nested = root.data ?? {};
    const deepNested = nested.data ?? {};

    const tokenCandidate =
      findValueByKeys(root, ['accessToken', 'token', 'access_token', 'jwt', 'idToken', 'authToken']) ??
      responseHeaders['x-access-token'] ??
      responseHeaders['authorization'] ??
      responseHeaders.Authorization;

    const accessToken = parseBearerToken(tokenCandidate);

    const userData =
      findValueByKeys(root, ['user']) ??
      (nested && nested.role ? nested : null) ??
      (deepNested && deepNested.role ? deepNested : null);

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
    const { accessToken, userData } = extractAuthPayload(res.data, res.headers);

    if (!accessToken) {
      throw new Error('Unexpected login response from server.');
    }

    let resolvedUser = userData;
    if (!resolvedUser) {
      const meRes = await api.get('/auth/me', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      resolvedUser = meRes?.data?.data ?? meRes?.data?.user ?? meRes?.data?.data?.user;
    }

    if (!resolvedUser) {
      throw new Error('Unexpected login response from server.');
    }

    if ((resolvedUser.role || '').toUpperCase() !== 'ADMIN') {
      throw new Error('Not authorised. Admin access required.');
    }

    localStorage.setItem('adminToken', accessToken);
    api.defaults.headers.Authorization = `Bearer ${accessToken}`;
    setUser(resolvedUser);
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
