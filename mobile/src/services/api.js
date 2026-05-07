import axios from 'axios';
import * as SecureStore from 'expo-secure-store';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:5000/api';

const api = axios.create({
  baseURL: API_URL,
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
});

// ── Request interceptor: attach access token ──────────────
api.interceptors.request.use(async (config) => {
  try {
    const token = await SecureStore.getItemAsync('accessToken');
    if (token) config.headers.Authorization = `Bearer ${token}`;
  } catch {}
  return config;
});

// ── Response interceptor: auto-refresh on 401 ────────────
let isRefreshing = false;
let queue = [];

api.interceptors.response.use(
  res => res,
  async (error) => {
    const original = error.config;
    if (error.response?.status === 401 && !original._retry) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          queue.push({ resolve, reject });
        }).then(token => {
          original.headers.Authorization = `Bearer ${token}`;
          return api(original);
        });
      }

      original._retry = true;
      isRefreshing = true;

      try {
        const refreshToken = await SecureStore.getItemAsync('refreshToken');
        if (!refreshToken) throw new Error('No refresh token');

        const { data } = await axios.post(`${API_URL}/auth/refresh`, { refreshToken });
        const newToken = data.data.accessToken;

        await SecureStore.setItemAsync('accessToken', newToken);
        queue.forEach(p => p.resolve(newToken));
        queue = [];

        original.headers.Authorization = `Bearer ${newToken}`;
        return api(original);
      } catch {
        queue.forEach(p => p.reject(error));
        queue = [];
        await SecureStore.deleteItemAsync('accessToken');
        await SecureStore.deleteItemAsync('refreshToken');
        // Emit logout event
        throw error;
      } finally {
        isRefreshing = false;
      }
    }
    return Promise.reject(error);
  }
);

// ── Auth ──────────────────────────────────────────────────
export const authAPI = {
  register: (data) => api.post('/auth/register', data),
  login: (data) => api.post('/auth/login', data),
  logout: () => api.post('/auth/logout'),
  getMe: () => api.get('/auth/me'),
  refresh: (refreshToken) => api.post('/auth/refresh', { refreshToken }),
};

// ── Products ──────────────────────────────────────────────
export const productsAPI = {
  list: (params) => api.get('/products', { params }),
  search: (q, params) => api.get('/products/search', { params: { q, ...params } }),
  getById: (id) => api.get(`/products/${id}`),
  getPrices: (id) => api.get(`/products/${id}/prices`),
  getHistory: (id, params) => api.get(`/products/${id}/history`, { params }),
  getPriceHistory: (id, params) => api.get(`/products/${id}/history`, { params }),
  getCheapest: (id) => api.get(`/products/${id}/cheapest`),
  toggleFavourite: (id) => api.post(`/products/${id}/favourite`),
  getFavourites: () => api.get('/products/me/favourites'),
};

// ── Categories ────────────────────────────────────────────
export const categoriesAPI = {
  list: () => api.get('/categories'),
};

// ── Supermarkets ──────────────────────────────────────────
export const supermarketsAPI = {
  list: () => api.get('/supermarkets'),
  getById: (id) => api.get(`/supermarkets/${id}`),
  getNearby: (params) => api.get('/supermarkets/nearby', { params }),
  getPrices: (id, params) => api.get(`/supermarkets/${id}/prices`, { params }),
};

// ── Prices ────────────────────────────────────────────────
export const pricesAPI = {
  compare: (productIds) => api.get('/prices/compare', { params: { productIds: productIds.join(',') } }),
};

// ── Shopping Lists ────────────────────────────────────────
export const shoppingListsAPI = {
  list: () => api.get('/shopping-lists'),
  create: (data) => api.post('/shopping-lists', data),
  getById: (id) => api.get(`/shopping-lists/${id}`),
  update: (id, data) => api.put(`/shopping-lists/${id}`, data),
  remove: (id) => api.delete(`/shopping-lists/${id}`),
  addItem: (id, data) => api.post(`/shopping-lists/${id}/items`, data),
  updateItem: (id, itemId, data) => api.put(`/shopping-lists/${id}/items/${itemId}`, data),
  removeItem: (id, itemId) => api.delete(`/shopping-lists/${id}/items/${itemId}`),
  toggleCheck: (id, itemId) => api.patch(`/shopping-lists/${id}/items/${itemId}/check`),
  optimize: (id) => api.get(`/shopping-lists/${id}/optimize`),
};

// ── Invoices ──────────────────────────────────────────────
export const invoicesAPI = {
  // Legacy image upload (kept for reference)
  scan: (formData) => api.post('/invoices/scan', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 120000,
  }),
  // Send OCR text extracted on-device (legacy path, kept for fallback)
  scanText: (data) => api.post('/invoices/scan-text', data, { timeout: 60000 }),
  // New: send pre-parsed structured JSON from on-device Gemini — server just saves, no AI needed
  scanStructured: (data) => api.post('/invoices/scan-structured', data, { timeout: 30000 }),
  list: (params) => api.get('/invoices', { params }),
  getById: (id) => api.get(`/invoices/${id}`),
  confirm: (id, data) => api.put(`/invoices/${id}/confirm`, data),
  remove: (id) => api.delete(`/invoices/${id}`),
  transcribeVoice: (formData) => api.post('/invoices/voice-search', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 15000,
  }),
  scanShoppingList: (formData) => api.post('/invoices/scan-list', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 60000,
  }),
};

// ── Users ─────────────────────────────────────────────────
export const usersAPI = {
  getProfile: () => api.get('/users/me'),
  updateProfile: (formData) => api.put('/users/me', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
  changePassword: (data) => api.put('/users/me/password', data),
  updatePushToken: (pushToken) => api.put('/users/me/push-token', { pushToken }),
  getNotifications: (params) => api.get('/users/me/notifications', { params }),
  markNotificationRead: (id) => api.patch(`/users/me/notifications/${id}/read`),
  markAllRead: () => api.post('/users/me/notifications/read-all'),
  markAllNotificationsRead: () => api.post('/users/me/notifications/read-all'),
  getAlerts: () => api.get('/users/me/alerts'),
  createAlert: (data) => api.post('/users/me/alerts', data),
  deleteAlert: (id) => api.delete(`/users/me/alerts/${id}`),
};

export default api;
