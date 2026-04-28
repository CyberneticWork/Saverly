import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  timeout: 30000,
});

const token = localStorage.getItem('adminToken');
if (token) api.defaults.headers.Authorization = `Bearer ${token}`;

export default api;
