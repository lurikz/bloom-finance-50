const API_URL = (() => {
  const env = import.meta.env.VITE_API_URL?.trim();
  // If a non-localhost URL is explicitly configured, use it
  if (env && !/localhost|127\.0\.0\.1/.test(env)) return env;
  // If running locally, use local backend
  if (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')) {
    return env || 'http://localhost:3001/api';
  }
  // Production: always use the public backend
  return 'https://evolution-bloom-backend.exf0ty.easypanel.host/api';
})();

async function request(endpoint: string, options: RequestInit = {}) {
  const token = localStorage.getItem('token');
  const res = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });
  if (res.status === 401) {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = '/login';
    throw new Error('Unauthorized');
  }
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Erro na requisição');
  return data;
}

export const api = {
  // Auth
  register: (email: string, password: string, name: string) =>
    request('/auth/register', { method: 'POST', body: JSON.stringify({ email, password, name }) }),
  login: (email: string, password: string) =>
    request('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
  forgotPassword: (email: string) =>
    request('/auth/forgot-password', { method: 'POST', body: JSON.stringify({ email }) }),
  resetPassword: (token: string, password: string) =>
    request('/auth/reset-password', { method: 'POST', body: JSON.stringify({ token, password }) }),

  // Transactions
  getTransactions: (params?: { month?: number; year?: number; type?: string; category?: string }) => {
    const query = new URLSearchParams();
    if (params?.month) query.set('month', String(params.month));
    if (params?.year) query.set('year', String(params.year));
    if (params?.type) query.set('type', params.type);
    if (params?.category) query.set('category', params.category);
    return request(`/transactions?${query.toString()}`);
  },
  createTransaction: (data: { description: string; amount: number; type: 'income' | 'expense'; category_id: string; date: string }) =>
    request('/transactions', { method: 'POST', body: JSON.stringify(data) }),
  updateTransaction: (id: string, data: any) =>
    request(`/transactions/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteTransaction: (id: string) =>
    request(`/transactions/${id}`, { method: 'DELETE' }),

  // Categories
  getCategories: () => request('/categories'),
  createCategory: (data: { name: string; type: 'income' | 'expense'; color?: string }) =>
    request('/categories', { method: 'POST', body: JSON.stringify(data) }),
  updateCategory: (id: string, data: { name?: string; color?: string }) =>
    request(`/categories/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteCategory: (id: string) =>
    request(`/categories/${id}`, { method: 'DELETE' }),

  // Dashboard
  getDashboard: (params?: { month?: number; year?: number }) => {
    const query = new URLSearchParams();
    if (params?.month) query.set('month', String(params.month));
    if (params?.year) query.set('year', String(params.year));
    return request(`/dashboard?${query.toString()}`);
  },

  // Fixed Expenses
  getFixedExpenses: () => request('/fixed-expenses'),
  createFixedExpense: (data: { description: string; amount: number; category_id: string; start_date: string; recurrence_months: number }) =>
    request('/fixed-expenses', { method: 'POST', body: JSON.stringify(data) }),
  updateFixedExpense: (id: string, data: any) =>
    request(`/fixed-expenses/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteFixedExpense: (id: string) =>
    request(`/fixed-expenses/${id}`, { method: 'DELETE' }),

  // Reports
  getMonthlyReport: (params?: { month?: number; year?: number }) => {
    const query = new URLSearchParams();
    if (params?.month) query.set('month', String(params.month));
    if (params?.year) query.set('year', String(params.year));
    return request(`/reports/monthly?${query.toString()}`);
  },

  // Admin
  getDbStatus: () => request('/admin/db-status'),
  initDb: () => request('/admin/init-db', { method: 'POST' }),
  syncCategories: () => request('/admin/sync-categories', { method: 'POST' }),
};
