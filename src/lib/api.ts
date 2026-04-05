const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

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
  createCategory: (data: { name: string; type: 'income' | 'expense' }) =>
    request('/categories', { method: 'POST', body: JSON.stringify(data) }),
  deleteCategory: (id: string) =>
    request(`/categories/${id}`, { method: 'DELETE' }),

  // Dashboard
  getDashboard: (params?: { month?: number; year?: number }) => {
    const query = new URLSearchParams();
    if (params?.month) query.set('month', String(params.month));
    if (params?.year) query.set('year', String(params.year));
    return request(`/dashboard?${query.toString()}`);
  },
};
